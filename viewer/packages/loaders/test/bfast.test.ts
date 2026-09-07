import { describe, expect, it } from 'vitest';
import { ViewerScene } from '@ara3d/viewer-core';
import { parseBfastModel, bfastToGroups, loadBfast } from '../src/bfast-loader.js';
import { loadBos } from '../src/bos-loader.js';
import { bfastFixture } from './bfast-fixture.js';

describe('BFAST render models', () => {
  it('uses file-backed meshes and preserves transforms, entity rows and materials', () => {
    const bytes = bfastFixture(), model = parseBfastModel(bytes);
    expect(model.vertices.buffer).toBe(bytes);
    const result = bfastToGroups(model);
    expect(result.instanceCount).toBe(2);
    expect(result.groups).toHaveLength(2);
    expect(result.groupEntities.map(g => g.entities)).toEqual([[0], [0]]);
    const [opaque, transparent] = result.groups;
    expect(opaque.mesh).toBe(transparent.mesh);
    expect(opaque.mesh.positions.buffer).toBe(bytes);
    expect(opaque.mesh.indices!.buffer).toBe(bytes);
    expect([...opaque.transforms]).toEqual([1,0,0,0, 0,2,0,0, 0,0,3,0, 10,20,30,1]);
    expect(transparent.material).toMatchObject({ roughness: 128 / 255, metalness: 64 / 255, opacity: 128 / 255 });
    expect(transparent.colors[0]).toBeCloseTo(16 / 255);
    expect(transparent.colors[3]).toBeCloseTo(128 / 255);
  });
  it('supports explicit loading and auto-detection through the BOS entry point', async () => {
    for (const load of [loadBfast, loadBos]) {
      const progress: string[] = [];
      const result = await load(new Blob([bfastFixture()]), new ViewerScene(), { onProgress: p => progress.push(p.stage) });
      expect(result.instanceCount).toBe(2);
      expect(progress).toContain('parse'); expect(progress).toContain('convert');
    }
  });
  it('rejects truncation, overlapping ranges and missing buffers', () => {
    const bytes = bfastFixture();
    expect(() => parseBfastModel(bytes.slice(0, -64))).toThrow(/BFAST/);
    new DataView(bytes).setBigInt64(48, 0n, true);
    expect(() => parseBfastModel(bytes)).toThrow(/range/);
    expect(() => parseBfastModel(bfastFixture(b => { b.delete('InstanceData'); }))).toThrow(/InstanceData/);
  });
  it('rejects invalid slices, indices, transforms and unsupported primitives', () => {
    for (const [name, offset, value] of [
      ['MeshSliceData', 4, 1000], ['IndexData', 0, 99], ['InstanceData', 48, 99], ['Meta', 40, 2],
    ] as const) {
      expect(() => parseBfastModel(bfastFixture(b => {
        const bytes = b.get(name)!;
        new DataView(bytes.buffer, bytes.byteOffset).setInt32(offset, value, true);
      }))).toThrow(/BFAST/);
    }
    expect(() => parseBfastModel(bfastFixture(b => {
      const bytes = b.get('InstanceData')!;
      new DataView(bytes.buffer, bytes.byteOffset).setFloat32(0, NaN, true);
    }))).toThrow(/transform/);
  });
});
