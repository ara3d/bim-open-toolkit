import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { twoNodeTriangleGlb } from '../../loaders/test/helpers.js';
import { loadAssetModel } from '../src/assets.js';
import { BoxGeometry, Mesh, MeshStandardMaterial, Texture } from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

const ref = { id: 'asset', revision: 'test' };
const encoded = (text: string) => new TextEncoder().encode(text).buffer;
const triangleObj = 'v 0 0 0\nv 1 0 0\nv 0 1 0\nf 1 2 3\n';
const triangleStl = 'solid test\nfacet normal 0 0 1\nouter loop\nvertex 0 0 0\nvertex 1 0 0\nvertex 0 1 0\nendloop\nendfacet\nendsolid test';

beforeAll(() => {
  // Three's FileLoader emits this DOM event even for an embedded data URI in Node.
  if (!globalThis.ProgressEvent) vi.stubGlobal('ProgressEvent', class { constructor(public type: string, public init: unknown) {} });
});
afterEach(() => { vi.restoreAllMocks(); });
afterAll(() => { vi.unstubAllGlobals(); });

function externalGltf() {
  const buffer = twoNodeTriangleGlb(), view = new DataView(buffer), jsonLength = view.getUint32(12, true);
  const json = JSON.parse(new TextDecoder().decode(new Uint8Array(buffer, 20, jsonLength)));
  const binOffset = 20 + jsonLength + 8;
  const binary = buffer.slice(binOffset);
  json.buffers[0].uri = 'geometry.bin';
  return { source: encoded(JSON.stringify(json)), binary };
}

describe('geometry asset adapters', () => {
  it('loads embedded GLB with generated scoped IDs and retained placement', async () => {
    const result = await loadAssetModel(twoNodeTriangleGlb(), 'glb', ref);
    expect(result.ok).toBe(true); if (!result.ok) throw new Error(JSON.stringify(result.diagnostics));
    expect(result.value.model.objects).toHaveLength(2);
    expect(result.value.bindings[1]?.localTransform?.[12]).toBe(2);
    expect(result.value.model.objects[0]?.sourceId).toBeUndefined();
    expect(result.value.model.coordinates.units).toBe('unknown');
    expect(result.value.bindings[0]?.group.mesh.positions.length).toBe(9);
  });
  it('requires and uses an explicit external glTF resource resolver', async () => {
    const fixture = externalGltf();
    const missing = await loadAssetModel(fixture.source, 'gltf', ref);
    expect(missing.ok).toBe(false);
    expect(missing.diagnostics[0]?.message).toContain('Explicit resource resolver');
    const resolver = vi.fn(async () => fixture.binary);
    const result = await loadAssetModel(fixture.source, 'gltf', ref, { resources: resolver });
    expect(result.ok).toBe(true);
    expect(resolver).toHaveBeenCalledWith('geometry.bin', undefined);
    if (result.ok) expect(result.value.bindings).toHaveLength(2);
  });
  it('loads OBJ geometry with explicit material fallback and source-up conversion', async () => {
    const result = await loadAssetModel(encoded(`mtllib unavailable.mtl\nusemtl custom\n${triangleObj}`), 'obj', ref, { sourceUp: 'Z' });
    expect(result.ok).toBe(true); if (!result.ok) return;
    expect(result.value.bindings).toHaveLength(1);
    expect(result.value.bindings[0]?.localTransform?.[6]).toBeCloseTo(-1);
    expect(result.diagnostics.some(d => d.code === 'obj-materials')).toBe(true);
  });
  it('loads ASCII and binary STL triangles', async () => {
    const binary = new ArrayBuffer(134), view = new DataView(binary);
    view.setUint32(80, 1, true); view.setFloat32(92, 1, true);
    view.setFloat32(108, 1, true); view.setFloat32(124, 1, true);
    for (const source of [encoded(triangleStl), binary]) {
      const result = await loadAssetModel(source, 'stl', ref);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.value.bindings[0]?.group.mesh.positions.length).toBe(9);
    }
  });
  it('rejects malformed/empty assets and does not publish after resource cancellation', async () => {
    expect((await loadAssetModel(encoded('invalid'), 'glb', ref)).ok).toBe(false);
    expect((await loadAssetModel(encoded(''), 'obj', ref)).ok).toBe(false);
    const controller = new AbortController(), fixture = externalGltf();
    const result = await loadAssetModel(fixture.source, 'gltf', ref, {
      signal: controller.signal, resources: async () => { controller.abort(); return fixture.binary; },
    });
    expect(result).toMatchObject({ ok: false, diagnostics: [{ code: 'aborted' }] });
    expect(result).not.toHaveProperty('value');
  });
  it('reports unsupported material features, applies alpha once and disposes temporary assets', async () => {
    const geometry = new BoxGeometry(), texture = new Texture(), first = new MeshStandardMaterial({ map: texture, opacity: 0.5 }), second = new MeshStandardMaterial();
    const mesh = new Mesh(geometry, [first, second]);
    const disposedGeometry = vi.spyOn(geometry, 'dispose'), disposedTexture = vi.spyOn(texture, 'dispose'), disposedMaterial = vi.spyOn(first, 'dispose');
    vi.spyOn(GLTFLoader.prototype, 'parseAsync').mockResolvedValue({ scene: mesh, scenes: [mesh], animations: [] } as unknown as GLTF);
    const result = await loadAssetModel(encoded('{"asset":{"version":"2.0"}}'), 'gltf', ref);
    expect(result.ok).toBe(true); if (!result.ok) return;
    expect(result.diagnostics.map(d => d.code)).toEqual(expect.arrayContaining(['textures', 'multi-material']));
    expect(result.value.bindings[0]?.group.material.opacity).toBe(1);
    expect(result.value.bindings[0]?.colorFactor?.[3]).toBe(0.5);
    expect(result.value.bindings[0]?.group.mesh.positions.length).toBeGreaterThan(0);
    expect(disposedGeometry).toHaveBeenCalledOnce(); expect(disposedTexture).toHaveBeenCalledOnce(); expect(disposedMaterial).toHaveBeenCalledOnce();
  });
});
