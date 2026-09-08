import { describe, expect, it } from 'vitest';
import type { Vec3 } from '@bim-open-toolkit/model';
import { cross, dot, lerpVec3, perpendicularTo, unitSlerp } from '../src/vec.js';

const closeToVec = (actual: Vec3, expected: Vec3, digits = 10): void => {
  for (const axis of [0, 1, 2] as const) expect(actual[axis]).toBeCloseTo(expected[axis], digits);
};

describe('dot and cross', () => {
  it('agree with the right-hand rule and with orthogonality', () => {
    expect(dot([1, 2, 3], [4, -5, 6])).toBe(4 - 10 + 18);
    expect(cross([1, 0, 0], [0, 1, 0])).toEqual([0, 0, 1]);
    expect(dot(cross([1, 2, 3], [4, 5, 6]), [1, 2, 3])).toBeCloseTo(0, 12);
  });
});

describe('lerpVec3', () => {
  it('walks a straight line between two points', () => {
    expect(lerpVec3([0, 0, 0], [10, 20, -30], 0.25)).toEqual([2.5, 5, -7.5]);
    expect(lerpVec3([1, 1, 1], [3, 3, 3], 0)).toEqual([1, 1, 1]);
    expect(lerpVec3([1, 1, 1], [3, 3, 3], 1)).toEqual([3, 3, 3]);
  });
});

describe('perpendicularTo', () => {
  it('returns a unit vector at right angles to any direction', () => {
    const axes: readonly Vec3[] = [[0, 0, 1], [0, 1, 0], [1, 0, 0], [1, 1, 1], [-3, 0.5, 2]];
    for (const v of axes) {
      const p = perpendicularTo(v);
      expect(Math.hypot(...p)).toBeCloseTo(1, 12);
      expect(dot(p, v)).toBeCloseTo(0, 12);
    }
  });

  it('is deterministic, ignores length, and falls back to x for a zero direction', () => {
    expect(perpendicularTo([0, 0, 0])).toEqual([1, 0, 0]);
    expect(perpendicularTo([0, 0, 5])).toEqual(perpendicularTo([0, 0, 1]));
  });
});

describe('unitSlerp', () => {
  const a: Vec3 = [1, 0, 0];
  const b: Vec3 = [0, 0.6, 0.8];

  it('stays unit length all the way round and lands on both ends', () => {
    for (const t of [0, 0.1, 0.5, 0.9, 1]) expect(Math.hypot(...unitSlerp(a, b, t))).toBeCloseTo(1, 12);
    closeToVec(unitSlerp(a, b, 0), a, 12);
    closeToVec(unitSlerp(a, b, 1), b, 12);
  });

  it('turns at a steady rate, so half way is half the angle', () => {
    expect(Math.acos(dot(a, unitSlerp(a, [0, 1, 0], 0.5)))).toBeCloseTo(Math.PI / 4);
  });

  it('turns smoothly through a perpendicular between directly opposite directions', () => {
    const opposite: Vec3 = [-1, 0, 0];
    const half = unitSlerp(a, opposite, 0.5);
    expect(Math.hypot(...half)).toBeCloseTo(1, 12);
    expect(dot(half, a)).toBeCloseTo(0, 12);
    closeToVec(unitSlerp(a, opposite, 1), opposite, 9);
  });

  it('is already there when the two directions agree', () => {
    expect(unitSlerp(a, [2, 0, 0], 0.3)).toEqual([1, 0, 0]);
  });

  it('falls back sensibly when a direction has no length', () => {
    expect(unitSlerp([0, 0, 0], [1, 0, 0], 0.5)).toEqual([1, 0, 0]);
    expect(unitSlerp([1, 0, 0], [0, 0, 0], 0.5)).toEqual([1, 0, 0]);
    expect(unitSlerp([0, 0, 0], [0, 0, 0], 0.5)).toEqual([0, 0, 1]);
  });
});
