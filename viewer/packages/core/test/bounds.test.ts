import { describe, expect, it } from 'vitest';
import {
  meshBounds,
  transformBounds,
  unionBounds,
  groupBounds,
  sceneBounds,
} from '../src/bounds.js';
import { InstancedGroup } from '../src/instanced-group.js';
import { ViewerScene } from '../src/scene.js';
import { triangle, identity, translation, concat, rgba } from './helpers.js';

describe('meshBounds', () => {
  it('spans the vertex positions', () => {
    expect(meshBounds(triangle())).toEqual({ min: [0, 0, 0], max: [1, 1, 0] });
  });

  it('is null for an empty mesh', () => {
    expect(meshBounds({ positions: new Float32Array() })).toBeNull();
  });
});

describe('unionBounds', () => {
  it('handles nulls and merges boxes', () => {
    const a = { min: [0, 0, 0] as const, max: [1, 1, 1] as const };
    const b = { min: [-1, 0.5, 0] as const, max: [0.5, 2, 3] as const };
    expect(unionBounds(null, null)).toBeNull();
    expect(unionBounds(a, null)).toBe(a);
    expect(unionBounds(null, b)).toBe(b);
    expect(unionBounds(a, b)).toEqual({ min: [-1, 0, 0], max: [1, 2, 3] });
  });
});

describe('transformBounds', () => {
  it('is the identity under the identity matrix', () => {
    const box = { min: [-1, -2, -3] as const, max: [1, 2, 3] as const };
    expect(transformBounds(box, identity())).toEqual(box);
  });

  it('translates', () => {
    const box = { min: [0, 0, 0] as const, max: [1, 1, 1] as const };
    expect(transformBounds(box, translation(10, 20, 30))).toEqual({
      min: [10, 20, 30],
      max: [11, 21, 31],
    });
  });

  it('handles negative scale (min/max swap per axis)', () => {
    const m = identity();
    m[0] = -2; // scale x by -2
    const box = { min: [1, 0, 0] as const, max: [3, 1, 1] as const };
    expect(transformBounds(box, m)).toEqual({ min: [-6, 0, 0], max: [-2, 1, 1] });
  });

  it('rotates 90 degrees about Y (column-major)', () => {
    // +X -> -Z, +Z -> +X
    const m = new Float32Array([0, 0, -1, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 1]);
    const box = { min: [0, 0, 0] as const, max: [2, 1, 3] as const };
    const out = transformBounds(box, m);
    expect(out.min).toEqual([0, 0, -2]);
    expect(out.max).toEqual([3, 1, 0]);
  });
});

describe('groupBounds / sceneBounds', () => {
  it('unions instance transforms times mesh bounds', () => {
    const g = new InstancedGroup(triangle());
    g.append(
      concat(translation(0, 0, 0), translation(5, -1, 2)),
      concat(rgba(1, 1, 1, 1), rgba(1, 1, 1, 1)),
    );
    expect(groupBounds(g)).toEqual({ min: [0, -1, 0], max: [6, 1, 2] });
  });

  it('is null with no instances', () => {
    expect(groupBounds(new InstancedGroup(triangle()))).toBeNull();
  });

  it('sceneBounds unions groups and is null for an empty scene', () => {
    const scene = new ViewerScene();
    expect(sceneBounds(scene)).toBeNull();
    const a = new InstancedGroup(triangle());
    a.append(identity(), rgba(1, 1, 1, 1));
    const b = new InstancedGroup(triangle());
    b.append(translation(-3, 0, 0), rgba(1, 1, 1, 1));
    scene.addGroup(a);
    scene.addGroup(b);
    expect(sceneBounds(scene)).toEqual({ min: [-3, 0, 0], max: [1, 1, 0] });
  });
});
