import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseBosGeometry } from '@ara3d/viewer-loaders';
import { ViewerScene } from '@ara3d/viewer-core';
import { sampleBosGeometry } from '../../loaders/test/helpers.js';
import { loadBosModel } from '../src/loading.js';
import { RenderBinding } from '../src/render.js';
import { identityMatrix, type Matrix4 } from '../src/contracts.js';

vi.mock('@ara3d/viewer-loaders', async importOriginal => ({ ...await importOriginal<object>(), parseBosGeometry: vi.fn() }));
const parse = vi.mocked(parseBosGeometry);
const ref = { id: 'snowdon', revision: 'test' };
beforeEach(() => { parse.mockReset(); });
afterEach(() => vi.unstubAllGlobals());

describe('BOS model loading', () => {
  it('retains multiple placements under one entity, source IDs and geometry-free rows', async () => {
    parse.mockResolvedValue(sampleBosGeometry({ InstanceEntityIndex: new Int32Array([0, 0, 1, 2]), EntityLocalId: new Int32Array([1, 1, 0, 42]) }));
    const progress = vi.fn();
    const result = await loadBosModel(new ArrayBuffer(0), ref, { onProgress: progress });
    expect(result.ok).toBe(true); if (!result.ok) return;
    const { model, bindings } = result.value;
    expect(model.objects).toHaveLength(4);
    expect(model.objects[0]?.sourceId).toBe('1');
    expect(model.objects[1]?.ref.objectId).toBe('bos:1');
    expect(model.objects[3]?.sourceId).toBe('42');
    expect(bindings[0]?.ref).toEqual(bindings[1]?.ref);
    const scene = new ViewerScene(), render = new RenderBinding(scene, () => {});
    expect(render.addModel(ref.id, bindings).ok).toBe(true);
    render.update(model.objects);
    expect(bindings[0]?.group.getTransform(0)[12]).toBe(0);
    expect(bindings[1]?.group.getTransform(1)[12]).toBe(5);
    const transform = [...identityMatrix]; transform[12] = 10;
    render.update([{ ...model.objects[0]!, transform: transform as unknown as Matrix4 }]);
    expect(bindings[0]?.group.getTransform(0)[12]).toBe(10);
    expect(bindings[1]?.group.getTransform(1)[12]).toBe(15);
    expect(bindings[2]?.group.material.opacity).toBe(1);
    expect(bindings[2]?.group.getColor(0)[3]).toBeCloseTo(128 / 255);
    expect(progress.mock.calls.map(([p]) => p.stage)).toContain('convert');
  });

  it('converts explicit Z-up source placement to Y-up without changing logical transforms', async () => {
    parse.mockResolvedValue(sampleBosGeometry({ TransformTZ: new Float32Array([3, 4, 5]) }));
    const result = await loadBosModel(new ArrayBuffer(0), ref, { sourceUp: 'Z' });
    expect(result.ok).toBe(true); if (!result.ok) return;
    expect(result.value.model.coordinates).toEqual({ units: 'unknown', up: 'Y', registration: 'unknown' });
    expect(result.value.model.objects[0]?.transform).toEqual(identityMatrix);
    expect(result.value.bindings[0]?.localTransform?.[13]).toBeCloseTo(3);
  });

  it('returns diagnostics for malformed archives', async () => {
    const actual = await vi.importActual<typeof import('@ara3d/viewer-loaders')>('@ara3d/viewer-loaders');
    parse.mockImplementation(actual.parseBosGeometry);
    expect(await loadBosModel(new ArrayBuffer(8), ref)).toMatchObject({ ok: false, diagnostics: [{ code: 'load-failed' }] });
  });

  it('does not publish after cancellation while parsing or progress callbacks', async () => {
    const controller = new AbortController();
    parse.mockImplementation(async () => { controller.abort(); return sampleBosGeometry(); });
    expect(await loadBosModel(new ArrayBuffer(0), ref, { signal: controller.signal })).toMatchObject({ ok: false, diagnostics: [{ code: 'aborted' }] });
    parse.mockResolvedValue(sampleBosGeometry());
    const duringConversion = new AbortController();
    expect(await loadBosModel(new ArrayBuffer(0), ref, { signal: duringConversion.signal, onProgress: p => { if (p.stage === 'convert') duringConversion.abort(); } })).toMatchObject({ ok: false, diagnostics: [{ code: 'aborted' }] });
  });

  it('passes AbortSignal to fetch, reports bytes and avoids fetch when already aborted', async () => {
    const controller = new AbortController();
    const fetch = vi.fn().mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-length': '3' } }));
    vi.stubGlobal('fetch', fetch); parse.mockResolvedValue(sampleBosGeometry());
    const progress = vi.fn();
    expect((await loadBosModel('/fixture.bos', ref, { signal: controller.signal, onProgress: progress })).ok).toBe(true);
    expect(fetch).toHaveBeenCalledWith('/fixture.bos', { signal: controller.signal });
    expect(progress).toHaveBeenCalledWith({ stage: 'fetch', loaded: 3, total: 3 });
    controller.abort();
    expect((await loadBosModel('/fixture.bos', ref, { signal: controller.signal })).ok).toBe(false);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});
