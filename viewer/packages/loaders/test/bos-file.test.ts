// Integration test against a real .bos file. The file is local-only test data
// (never committed — see data/README.md), so the suite skips when it is absent.
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import JSZip from 'jszip';
import * as parquet from 'hyparquet';
import { ViewerScene } from '@ara3d/viewer-core';
import { parseBosGeometry, loadBos } from '../src/bos-loader.js';
import { bosToBfast } from '../src/bos-to-bfast.js';
import { parseBfastModel, loadBfast } from '../src/bfast-loader.js';
import { readBimTable } from '../src/bim-data.js';
import { bfastFixture } from './bfast-fixture.js';

vi.mock('hyparquet', async importOriginal => {
  const actual = await importOriginal<typeof import('hyparquet')>();
  return { ...actual, parquetMetadataAsync: vi.fn(actual.parquetMetadataAsync), parquetRead: vi.fn(actual.parquetRead) };
});

const bosPath = fileURLToPath(
  new URL('../../../../platoflow/data/duplex.bos', import.meta.url),
);

describe('BOS column chunks', () => {
  it('accumulates out-of-order chunks at their declared row offsets', async () => {
    const zip = new JSZip();
    for (const table of ['Instances', 'VertexBuffer', 'IndexBuffer', 'Meshes', 'Materials', 'Transforms']) zip.file(`${table}.parquet`, new Uint8Array([1]));
    // Isolate the column reader from parquet encoding: every synthetic table exposes one column.
    const metadata = vi.spyOn(parquet, 'parquetMetadataAsync').mockResolvedValue({ num_rows: 4n, schema: [{ name: 'VertexX', type: 1 }] } as unknown as Awaited<ReturnType<typeof parquet.parquetMetadataAsync>>);
    const read = vi.spyOn(parquet, 'parquetRead').mockImplementation(async options => {
      options.onChunk?.({ columnName: 'VertexX', rowStart: 2, rowEnd: 4, columnData: [3, 4] });
      options.onChunk?.({ columnName: 'VertexX', rowStart: 0, rowEnd: 2, columnData: [1, 2] });
    });
    try {
      const bos = await parseBosGeometry(await zip.generateAsync({ type: 'arraybuffer' }));
      expect(Array.from(bos.VertexX)).toEqual([1, 2, 3, 4]);
      expect(read).toHaveBeenCalledTimes(6);
    } finally { read.mockRestore(); metadata.mockRestore(); }
  });
});

describe.skipIf(!existsSync(bosPath))('BOS container (duplex.bos)', () => {
  const buffer = (): ArrayBuffer => {
    const b = readFileSync(bosPath);
    return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
  };

  it('reads embedded original Parquet tables and source identities', async () => {
    const source = buffer(), zip = await JSZip.loadAsync(source);
    const sourceIds = (await parseBosGeometry(source)).EntityLocalId!;
    const sourceRow = sourceIds.findIndex(id => id > 0);
    const tables = Object.values(zip.files).filter(f => !f.dir && f.name.toLowerCase().endsWith('.parquet'));
    const payloads = await Promise.all(tables.map(async file => [file.name, await file.async('uint8array')] as const));
    const prepared = bfastFixture(buffers => {
      for (const [name, bytes] of payloads) buffers.set(`BOS/${name}`, bytes);
      const instances = buffers.get('InstanceData')!;
      const words = new Int32Array(instances.buffer, instances.byteOffset, instances.byteLength / 4);
      words[13] = words[29] = sourceRow;
    });
    const parsed = parseBfastModel(prepared);
    expect(parsed.bimData.size).toBe(tables.length);
    for (const file of tables) expect(parsed.bimData.get(file.name)).toEqual(await file.async('uint8array'));
    const combined = await loadBfast(prepared, new ViewerScene());
    expect(combined.instanceCount).toBe(2);
    expect(combined.groupEntities.map(g => g.entities)).toEqual([[sourceIds[sourceRow]], [sourceIds[sourceRow]]]);
    const entities = await readBimTable(parsed.bimData, 'Entities.parquet', ['LocalId']);
    expect(entities.map(row => Number(row.LocalId))).toEqual([...combined.entityLocalIds!]);
  });

  it('rejects a prepared export when source transforms are nonfinite', async () => {
    // This legacy duplex fixture contains Infinity in transform row 484.
    await expect(bosToBfast(buffer())).rejects.toThrow(/Invalid BFAST transform/);
  });

  it('decodes the geometry tables', async () => {
    const bos = await parseBosGeometry(buffer());
    expect(bos.InstanceMeshIndex.length).toBeGreaterThan(0);
    expect(bos.MeshVertexOffset.length).toBeGreaterThan(0);
    expect(bos.VertexX.length).toBe(bos.VertexY.length);
    expect(bos.TransformTX.length).toBe(bos.TransformQW.length);
  });

  it('reports instances under their source entity ids, not BOS row indices', async () => {
    const bos = await parseBosGeometry(buffer());
    const ids = bos.EntityLocalId!;
    expect(ids.length).toBeGreaterThan(0);
    const scene = new ViewerScene();
    const { groupEntities } = await loadBos(buffer(), scene);
    const entities = groupEntities.flatMap((g) => [...g.entities]);
    expect(entities.length).toBeGreaterThan(0);
    // Every reported id is the LocalId of some entity row, and differs from
    // the row index for at least most instances (the two are distinct spaces).
    const localIds = new Set([...ids]);
    expect(entities.every((e) => localIds.has(e))).toBe(true);
    const rowIndices = new Set([...bos.InstanceEntityIndex]);
    expect(entities.some((e) => !rowIndices.has(e))).toBe(true);
  });

  it('loads into a scene with progress reporting', async () => {
    const scene = new ViewerScene();
    const stages = new Set<string>();
    const result = await loadBos(buffer(), scene, {
      onProgress: (p) => stages.add(p.stage),
    });
    expect(result.instanceCount).toBeGreaterThan(0);
    expect(scene.groupCount).toBe(result.groups.length);
    expect(stages.has('parse')).toBe(true);
    expect(stages.has('convert')).toBe(true);
  });
});
