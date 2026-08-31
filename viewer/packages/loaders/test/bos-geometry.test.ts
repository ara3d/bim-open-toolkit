import { describe, expect, it } from 'vitest';
import { Matrix4, Quaternion, Vector3 } from 'three';
import {
  bosMeshBuffers,
  bosToGroups,
  composeTrs,
} from '../src/bos-geometry.js';
import { sampleBosGeometry } from './helpers.js';

describe('composeTrs', () => {
  it('matches THREE.Matrix4.compose for an arbitrary TRS', () => {
    const q = new Quaternion().setFromAxisAngle(new Vector3(0.3, 0.5, 0.8).normalize(), 1.1);
    const expected = new Matrix4().compose(
      new Vector3(1, -2, 3), q, new Vector3(2, 0.5, 4));
    const actual = composeTrs(1, -2, 3, q.x, q.y, q.z, q.w, 2, 0.5, 4);
    for (let i = 0; i < 16; i++)
      expect(actual[i]).toBeCloseTo(expected.elements[i], 5);
  });
});

describe('bosMeshBuffers', () => {
  it('descales fixed-point vertices and slices mesh-local indices', () => {
    const bos = sampleBosGeometry();
    const m0 = bosMeshBuffers(bos, 0)!;
    expect([...m0.positions]).toEqual([0, 0, 0, 1, 0, 0, 0, 1, 0]);
    expect([...m0.indices!]).toEqual([0, 1, 2]);
    const m1 = bosMeshBuffers(bos, 1)!;
    expect(m1.positions.length).toBe(12);
    expect([...m1.indices!]).toEqual([0, 1, 2, 0, 2, 3]);
  });

  it('returns null out of range', () => {
    expect(bosMeshBuffers(sampleBosGeometry(), -1)).toBeNull();
    expect(bosMeshBuffers(sampleBosGeometry(), 2)).toBeNull();
  });
});

describe('bosToGroups', () => {
  it('merges instances by mesh + material, skips hidden, maps entities', () => {
    const { groups, instanceCount, groupEntities } = bosToGroups(sampleBosGeometry());
    expect(groups.length).toBe(2);
    expect(instanceCount).toBe(3); // instance 3 is hidden

    const merged = groups[0];
    expect(merged.instanceCount).toBe(2);
    expect(merged.getTransform(0)[12]).toBe(0);
    expect(merged.getTransform(1)[12]).toBe(5); // transform 1 translation
    expect(merged.getTransform(1)[0]).toBe(2); // transform 1 scale
    expect(merged.getColor(0)[0]).toBeCloseTo(1); // material 0 is red
    expect(merged.material.roughness).toBeCloseTo(204 / 255);

    const single = groups[1];
    expect(single.instanceCount).toBe(1);
    expect(single.material.opacity).toBeCloseTo(128 / 255);
    expect(single.getColor(0)[1]).toBeCloseTo(1); // material 1 is green

    expect(groupEntities[0].entities).toEqual([10, 11]);
    expect(groupEntities[1].entities).toEqual([12]);
  });

  it('skips instances with meshIndex < 0 or empty meshes', () => {
    const bos = sampleBosGeometry({
      InstanceMeshIndex: new Int32Array([-1, 0, 1, 0]),
    });
    const { instanceCount } = bosToGroups(bos);
    expect(instanceCount).toBe(2); // -1 skipped, hidden skipped
  });

  it('emits groups incrementally with ordered index/total', () => {
    const seen: Array<[number, number]> = [];
    bosToGroups(sampleBosGeometry(), (_g, index, total) => seen.push([index, total]));
    expect(seen).toEqual([[0, 2], [1, 2]]);
  });
});
