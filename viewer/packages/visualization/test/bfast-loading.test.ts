import { afterEach, expect, it, vi } from 'vitest';
import { bfastFixture } from '../../loaders/test/bfast-fixture.js';
import { loadBosModel } from '../src/loading.js';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import JSZip from 'jszip';
import { parseBosGeometry, readBimTable } from '@ara3d/viewer-loaders';

afterEach(() => vi.unstubAllGlobals());
const ref = { id: 'model', revision: 'bfast' };
const duplex = fileURLToPath(new URL('../../../../platoflow/data/duplex.bos', import.meta.url));
it.skipIf(!existsSync(duplex))('restores all entity rows/source IDs and exposes lazy BIM data', async () => {
  const file = readFileSync(duplex), source = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength);
  const zip = await JSZip.loadAsync(source), bos = await parseBosGeometry(source);
  const entry = Object.values(zip.files).find(f => f.name.endsWith('Entities.parquet'))!;
  const entities = await entry.async('uint8array');
  const result = await loadBosModel(bfastFixture(buffers => buffers.set(`BOS/${entry.name}`, entities)), ref);
  expect(result.ok).toBe(true); if (!result.ok) return;
  expect(result.value.model.objects).toHaveLength(bos.EntityLocalId!.length);
  result.value.model.objects.forEach((object, row) => {
    expect(object.ref.objectId).toBe(`bos:${row}`);
    expect(object.sourceId).toBe(bos.EntityLocalId![row]! > 0 ? String(bos.EntityLocalId![row]) : undefined);
  });
  const rows = await readBimTable(result.value.bimData!, 'Entities.parquet', ['LocalId']);
  expect(rows.map(row => Number(row.LocalId))).toEqual([...bos.EntityLocalId!]);
});
it('normalizes BFAST bytes, blobs and URLs with shared identities and geometry-free records', async () => {
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve(new Response(bfastFixture()))));
  for (const source of [bfastFixture(), new Blob([bfastFixture()]), '/model.bfast']) {
    const result = await loadBosModel(source, ref, { sourceUp: 'Z' });
    expect(result.ok).toBe(true); if (!result.ok) continue;
    const { model, bindings } = result.value;
    expect(model.objects.map(o => o.ref.objectId)).toEqual(['bos:0', 'bos:2', 'bos:3']);
    expect(model.objects.every(o => o.sourceId === undefined)).toBe(true);
    expect(bindings).toHaveLength(2);
    expect(bindings[0]!.ref).toEqual(bindings[1]!.ref);
    expect(bindings[0]!.localTransform[13]).toBeCloseTo(30);
    expect(bindings[0]!.localTransform[14]).toBeCloseTo(-20);
    expect(bindings[1]!.group.material.opacity).toBe(1);
    expect(bindings[1]!.colorFactor![3]).toBeCloseTo(128 / 255);
  }
});
it('returns visible diagnostics and never publishes a cancelled BFAST load', async () => {
  const controller = new AbortController();
  const result = await loadBosModel(bfastFixture(), ref, { signal: controller.signal, onProgress: p => {
    if (p.stage === 'convert') controller.abort();
  } });
  expect(result).toMatchObject({ ok: false, diagnostics: [{ code: 'aborted' }] });
  expect(await loadBosModel(bfastFixture().slice(0, 80), ref)).toMatchObject({ ok: false, diagnostics: [{ code: 'load-failed' }] });
});

it('leaves properties lazy but reports corrupt identity tables during load', async () => {
  const badBytes = new Uint8Array([1, 2, 3]);
  const properties = await loadBosModel(bfastFixture(b => b.set('BOS/Parameters.parquet', badBytes)), ref);
  expect(properties.ok).toBe(true);
  if (properties.ok) await expect(readBimTable(properties.value.bimData!, 'Parameters.parquet')).rejects.toThrow();
  const entities = await loadBosModel(bfastFixture(b => b.set('BOS/Entities.parquet', badBytes)), ref);
  expect(entities).toMatchObject({ ok: false, diagnostics: [{ code: 'load-failed' }] });
});
