import { afterEach, expect, it, vi } from 'vitest';
import { bfastFixture } from '../../loaders/test/bfast-fixture.js';
import { loadBosModel } from '../src/loading.js';

afterEach(() => vi.unstubAllGlobals());
const ref = { id: 'model', revision: 'bfast' };
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
