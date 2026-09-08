import { describe, expect, it } from 'vitest';
import {
  addVec3, boundsCenter, boundsContain, boundsOf, boundsSize, crossVec2, emptyBounds, expandBounds,
  identityMatrix, isEmptyBounds, multiplyMatrix, polygonArea, scaleVec3, scaling, subVec3, transformBounds,
  transformDirection, normalizeVec3, transformPoint, translation, turnVec2, unionBounds, vec3Length,
  type Vec2, type Vec3,
} from '../src/math.js';

describe('math', () => {
  it('measures and normalizes a vector, reporting no direction for a zero vector', () => {
    expect(vec3Length([3, 4, 0])).toBe(5);
    expect(normalizeVec3([0, 0, 2])).toEqual([0, 0, 1]);
    expect(normalizeVec3([0, 0, 0])).toBeUndefined();
  });

  it('stores a translation in the last column, column-major', () => {
    expect(translation([1, 2, 3])[12]).toBe(1);
    expect(translation([1, 2, 3])[13]).toBe(2);
    expect(translation([1, 2, 3])[14]).toBe(3);
  });

  it('applies the second transform after the first', () => {
    const moveThenScale = multiplyMatrix(scaling([2, 2, 2]), translation([1, 0, 0]));
    expect(transformPoint(moveThenScale, [0, 0, 0])).toEqual([2, 0, 0]);
    const scaleThenMove = multiplyMatrix(translation([1, 0, 0]), scaling([2, 2, 2]));
    expect(transformPoint(scaleThenMove, [1, 0, 0])).toEqual([3, 0, 0]);
  });

  it('leaves points and directions alone under the identity', () => {
    expect(transformPoint(identityMatrix, [1, 2, 3])).toEqual([1, 2, 3]);
    expect(transformDirection(identityMatrix, [1, 2, 3])).toEqual([1, 2, 3]);
  });

  it('ignores translation for directions', () => {
    expect(transformDirection(translation([5, 5, 5]), [1, 0, 0])).toEqual([1, 0, 0]);
  });

  it('adds, subtracts and scales vectors', () => {
    expect(addVec3([1, 2, 3], [1, 1, 1])).toEqual([2, 3, 4]);
    expect(subVec3([1, 2, 3], [1, 1, 1])).toEqual([0, 1, 2]);
    expect(scaleVec3([1, 2, 3], 2)).toEqual([2, 4, 6]);
  });

  it('has an empty box that absorbs any point', () => {
    expect(isEmptyBounds(emptyBounds)).toBe(true);
    expect(isEmptyBounds(expandBounds(emptyBounds, [0, 0, 0]))).toBe(false);
    expect(boundsCenter(emptyBounds)).toBeUndefined();
    expect(boundsSize(emptyBounds)).toBeUndefined();
  });

  it('bounds a set of points', () => {
    const points: readonly Vec3[] = [[0, 0, 0], [2, 4, 6]];
    const bounds = boundsOf(points);
    expect(bounds).toEqual({ min: [0, 0, 0], max: [2, 4, 6] });
    expect(boundsCenter(bounds)).toEqual([1, 2, 3]);
    expect(boundsSize(bounds)).toEqual([2, 4, 6]);
    expect(boundsContain(bounds, [1, 1, 1])).toBe(true);
    expect(boundsContain(bounds, [3, 1, 1])).toBe(false);
  });

  it('unions boxes', () => {
    const a = boundsOf([[0, 0, 0], [1, 1, 1]]);
    const b = boundsOf([[-1, 0, 0], [0, 0, 2]]);
    expect(unionBounds(a, b)).toEqual({ min: [-1, 0, 0], max: [1, 1, 2] });
    expect(unionBounds(a, emptyBounds)).toEqual(a);
  });

  it('bounds every corner after a transform and leaves an empty box empty', () => {
    const box = boundsOf([[0, 0, 0], [1, 1, 1]]);
    expect(transformBounds(translation([1, 0, 0]), box)).toEqual({ min: [1, 0, 0], max: [2, 1, 1] });
    expect(transformBounds(translation([1, 0, 0]), emptyBounds)).toEqual(emptyBounds);
  });
});

describe('plane vectors', () => {
  const square: readonly Vec2[] = [[0, 0], [2, 0], [2, 2], [0, 2]];

  it('crosses two plane vectors, signing the turn between them', () => {
    expect(crossVec2([1, 0], [0, 1])).toBe(1);
    expect(crossVec2([0, 1], [1, 0])).toBe(-1);
    expect(crossVec2([2, 0], [3, 0])).toBe(0);
  });

  it('signs the turn at a corner, reporting collinear points as no turn', () => {
    expect(turnVec2([0, 0], [1, 0], [1, 1])).toBe(1);
    expect(turnVec2([0, 0], [1, 1], [1, 0])).toBe(-1);
    expect(turnVec2([0, 0], [1, 1], [2, 2])).toBe(0);
  });

  it('measures a polygon, signing it by winding', () => {
    expect(polygonArea(square)).toBe(4);
    expect(polygonArea([...square].reverse())).toBe(-4);
    expect(polygonArea([[0, 0], [1, 0], [0, 1]])).toBe(0.5);
    expect(polygonArea([[0, 0], [1, 1]])).toBe(0);
    expect(polygonArea([])).toBe(0);
  });
});
