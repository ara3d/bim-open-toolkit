import { describe, expect, it } from 'vitest';
import { identityMatrix, translation } from '../src/math.js';
import {
  boundsOfPositions, emptyInstances, geometryBounds, instanceColor, instanceOpacity, instanceRecords,
  instanceTransform, isGeometryFree, isInstanceVisible, mesh, noMesh, triangleCount, vertexCount,
  type Geometry, type InstanceRecord,
} from '../src/mesh.js';

const triangle = mesh(
  Float32Array.from([0, 0, 0, 1, 0, 0, 0, 1, 0]),
  Uint32Array.from([0, 1, 2]),
);

describe('mesh', () => {
  it('computes bounds, vertex and triangle counts from the buffers', () => {
    expect(triangle.bounds).toEqual({ min: [0, 0, 0], max: [1, 1, 0] });
    expect(vertexCount(triangle)).toBe(3);
    expect(triangleCount(triangle)).toBe(1);
    expect(triangle.normals).toBeUndefined();
  });

  it('bounds an empty position buffer as empty', () => {
    expect(boundsOfPositions(new Float32Array(0)).min[0]).toBe(Infinity);
  });

  it('starts every instance geometry-free, at the origin and opaque', () => {
    const records = emptyInstances(2);
    expect(records.count).toBe(2);
    expect(isGeometryFree(records, 0)).toBe(true);
    expect(instanceTransform(records, 1)).toEqual(identityMatrix);
    expect(instanceColor(records, 1)).toEqual([1, 1, 1]);
    expect(instanceOpacity(records, 1)).toBe(1);
  });

  it('builds columns from rows', () => {
    const records = instanceRecords([
      { meshIndex: 0, transform: translation([2, 0, 0]), color: [1, 0, 0], opacity: 0.5, objectIndex: 7 },
      { meshIndex: noMesh, transform: identityMatrix, color: [0, 1, 0], opacity: 1, objectIndex: 8 },
    ]);
    expect(records.meshIndex[0]).toBe(0);
    expect(records.objectIndex[1]).toBe(8);
    expect(instanceTransform(records, 0)[12]).toBe(2);
    expect(instanceColor(records, 0)).toEqual([1, 0, 0]);
    expect(instanceOpacity(records, 0)).toBeCloseTo(0.5);
    expect(isGeometryFree(records, 1)).toBe(true);
  });

  it('reads every row of records with no visibility column as visible', () => {
    const records = emptyInstances(2);
    expect(records.visible).toBeUndefined();
    expect(isInstanceVisible(records, 0)).toBe(true);
    expect(isInstanceVisible(records, 1)).toBe(true);
  });

  it('allocates a visibility column only when a row is hidden', () => {
    const row = (visible?: boolean): InstanceRecord => ({
      meshIndex: 0, transform: identityMatrix, color: [1, 1, 1], opacity: 1, objectIndex: 0,
      ...(visible === undefined ? {} : { visible }),
    });
    expect(instanceRecords([row(), row(true)]).visible).toBeUndefined();
    const mixed = instanceRecords([row(true), row(false), row()]);
    expect(mixed.visible).toEqual(Uint8Array.from([1, 0, 1]));
    expect([0, 1, 2].map((index) => isInstanceVisible(mixed, index))).toEqual([true, false, true]);
  });

  it('bounds the placed geometry and ignores geometry-free rows', () => {
    const geometry: Geometry = {
      meshes: [triangle],
      instances: instanceRecords([
        { meshIndex: 0, transform: translation([1, 0, 0]), color: [1, 1, 1], opacity: 1, objectIndex: 0 },
        { meshIndex: noMesh, transform: translation([100, 0, 0]), color: [1, 1, 1], opacity: 1, objectIndex: 1 },
      ]),
    };
    expect(geometryBounds(geometry)).toEqual({ min: [1, 0, 0], max: [2, 1, 0] });
  });

  it('bounds geometry with no drawn instances as empty', () => {
    expect(geometryBounds({ meshes: [], instances: emptyInstances(3) }).min[0]).toBe(Infinity);
  });
});
