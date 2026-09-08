import { describe, expect, it } from 'vitest';
import type { ClipPlane } from '../src/clipping.js';
import {
  applyClipping,
  boundsClipped,
  boxPlanes,
  clipPlane,
  isClipped,
  noClipping,
  planeThrough,
  planesOf,
  signedDistance,
} from '../src/clipping.js';

const unwrap = <T>(result: { ok: true; value: T } | { ok: false }): T => {
  if (!result.ok) throw new Error('expected a value');
  return result.value;
};

describe('clipPlane', () => {
  it('normalizes the plane so a distance is a world distance', () => {
    const plane = unwrap(clipPlane([0, 4, 0], 8));
    expect(plane.normal).toEqual([0, 1, 0]);
    expect(plane.constant).toBe(2);
    expect(signedDistance(plane, [0, 3, 0])).toBe(5);
  });

  it('refuses a normal with no direction', () => {
    const result = clipPlane([0, 0, 0], 1);
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe('bad-plane');
  });

  it('refuses values that are not finite', () => {
    expect(clipPlane([Number.NaN, 1, 0], 0).ok).toBe(false);
    expect(clipPlane([0, 1, 0], Number.POSITIVE_INFINITY).ok).toBe(false);
  });
});

describe('planeThrough', () => {
  it('puts the plane on the point and keeps the side the normal points to', () => {
    const plane = unwrap(planeThrough([1, 0, 0], [5, 0, 0]));
    expect(signedDistance(plane, [5, 0, 0])).toBe(0);
    expect(signedDistance(plane, [6, 0, 0])).toBe(1);
    expect(signedDistance(plane, [4, 0, 0])).toBe(-1);
  });
});

describe('boxPlanes', () => {
  it('keeps the interior and removes the outside', () => {
    const planes = unwrap(boxPlanes([0, 0, 0], [2, 2, 2]));
    expect(planes).toHaveLength(6);
    expect(isClipped(planes, [1, 1, 1])).toBe(false);
    expect(isClipped(planes, [3, 1, 1])).toBe(true);
    expect(isClipped(planes, [-1, 1, 1])).toBe(true);
    expect(isClipped(planes, [1, 1, 2])).toBe(false);
  });

  it('refuses a box whose minimum is above its maximum', () => {
    const result = boxPlanes([1, 0, 0], [0, 1, 1]);
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe('bad-box');
  });
});

describe('planesOf', () => {
  it('normalizes the planes of an explicit region', () => {
    const region = { kind: 'planes', planes: [{ normal: [0, 0, 3], constant: 6 }] } as const;
    const planes = unwrap(planesOf(region));
    expect(planes[0]?.normal).toEqual([0, 0, 1]);
    expect(planes[0]?.constant).toBe(2);
  });

  it('expands a box region', () => {
    expect(unwrap(planesOf({ kind: 'box', min: [0, 0, 0], max: [1, 1, 1] }))).toHaveLength(6);
  });

  it('removes nothing by default', () => {
    expect(unwrap(planesOf(noClipping))).toHaveLength(0);
    expect(isClipped([], [100, 100, 100])).toBe(false);
  });

  it('fails when one plane of a region is invalid', () => {
    const region = { kind: 'planes', planes: [{ normal: [0, 0, 0], constant: 1 }] } as const;
    expect(planesOf(region).ok).toBe(false);
  });
});

describe('boundsClipped', () => {
  const planes = unwrap(boxPlanes([0, 0, 0], [10, 10, 10]));

  it('removes a box entirely outside the region', () => {
    expect(boundsClipped(planes, { min: [20, 0, 0], max: [30, 10, 10] })).toBe(true);
  });

  it('keeps a box that straddles the boundary', () => {
    expect(boundsClipped(planes, { min: [-5, 0, 0], max: [5, 10, 10] })).toBe(false);
  });

  it('keeps a box wholly inside', () => {
    expect(boundsClipped(planes, { min: [1, 1, 1], max: [2, 2, 2] })).toBe(false);
  });

  it('removes nothing when there are no planes', () => {
    expect(boundsClipped([], { min: [0, 0, 0], max: [1, 1, 1] })).toBe(false);
  });
});

describe('applyClipping', () => {
  const fakeTarget = () => {
    const applied: ClipPlane[][] = [];
    return {
      applied,
      setPlanes: (planes: readonly ClipPlane[]) => {
        applied.push([...planes]);
      },
    };
  };

  it('puts a region in force and lifts it on disposal', () => {
    const target = fakeTarget();
    const result = applyClipping(target, { kind: 'box', min: [0, 0, 0], max: [1, 1, 1] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(target.applied[0]).toHaveLength(6);
    result.value.dispose();
    expect(target.applied[1]).toHaveLength(0);
  });

  it('touches the target only when the region is valid', () => {
    const target = fakeTarget();
    const result = applyClipping(target, { kind: 'box', min: [1, 1, 1], max: [0, 0, 0] });
    expect(result.ok).toBe(false);
    expect(target.applied).toHaveLength(0);
  });
});
