import { describe, expect, it } from 'vitest';
import { identityMatrix, type ObjectRecord, type Vec3 } from '../src/contracts.js';
import { explodeLayout, gridLayout } from '../src/layouts.js';

const objects: readonly ObjectRecord[] = ['left', 'right'].map(objectId => Object.freeze({
  ref: Object.freeze({ modelId: 'm', objectId }),
  transform: Object.freeze([...identityMatrix]) as typeof identityMatrix,
  appearance: { color: [1,1,1] as const, opacity: 1, visible: true },
}));
const centers: readonly Vec3[] = [[-10,0,0], [10,0,0]];
const centerOf = (_object: ObjectRecord, index: number) => centers[index]!;

describe('reversible layouts', () => {
  it('explodes by supplied representation centers rather than identity transforms', () => {
    const result = explodeLayout(objects, { origin: [0,0,0], strength: 0.5, centerOf });
    expect(result.map(object => object.transform[12])).toEqual([-5,5]);
    expect(result[0]?.ref).toBe(objects[0]?.ref);
    expect(result[0]?.appearance).toBe(objects[0]?.appearance);
    expect(objects.map(object => object.transform[12])).toEqual([0,0]);
    expect(explodeLayout(objects, { origin: [0,0,0], strength: 0, centerOf })).toEqual(objects);
  });
  it('places centers on a grid while retaining rotations/scales', () => {
    const rotated: ObjectRecord = { ...objects[0]!, transform: [0,2,0,0,-2,0,0,0,0,0,2,0,1,2,3,1] };
    const result = gridLayout([rotated, objects[1]!], { origin: [0,0,0], spacing: 4, columns: 2, centerOf });
    // Center -10 moves to -2; world translation +8 is added to the base transform.
    expect(result[0]?.transform.slice(0,12)).toEqual(rotated.transform.slice(0,12));
    expect(result[0]?.transform[12]).toBe(9);
    expect(result[1]?.transform[12]).toBe(-8);
    expect(result.every(object => object.transform.every(Number.isFinite))).toBe(true);
    expect(rotated.transform[12]).toBe(1);
  });
  it('rejects invalid settings and nonfinite centers without changing input', () => {
    expect(() => explodeLayout(objects, { origin: [0,0,0], strength: -1, centerOf })).toThrow();
    expect(() => explodeLayout(objects, { origin: [0,0,0], strength: 1, centerOf: () => [NaN,0,0] })).toThrow();
    expect(() => gridLayout(objects, { origin: [0,0,0], spacing: 1, columns: 0, centerOf })).toThrow();
    expect(() => gridLayout(objects, { origin: [0,0,0], spacing: Infinity, columns: 1, centerOf })).toThrow();
    expect(gridLayout([], { origin: [0,0,0], spacing: 1, columns: 1, centerOf })).toEqual([]);
    expect(objects[0]?.transform).toEqual(identityMatrix);
  });
});
