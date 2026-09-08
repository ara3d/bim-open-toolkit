// Correctness contract of the columnar bounds helpers: they must agree with the
// alpha renderer's object-allocating implementation, or the comparison of the two
// in transform-updates.perf.ts measures two different computations.
import { describe, expect, it } from 'vitest';
import { ViewerScene, sceneBounds, groupBounds } from '@ara3d/viewer-core';
import {
  BOX_NUMBERS, allGroups, emptyBoxes, groupsOfRows, localBoxes, recomputeGroupBoxes, unionBoxes,
} from '../../src/perf/bounds.js';
import { createInstanceColumns } from '../../src/perf/columns.js';
import { createSyntheticScene, scaledShape } from '../../src/perf/scene.js';

const scene = createSyntheticScene(scaledShape(300, 7));
const local = localBoxes(scene.groups);

const worldBoxes = (): Float64Array => {
  const world = emptyBoxes(scene.groups.length);
  recomputeGroupBoxes(world, local, scene.groups, allGroups(scene.groups.length));
  return world;
};

const closeTo = (actual: number, expected: number): void =>
  expect(actual).toBeCloseTo(expected, 5);

describe('columnar bounds', () => {
  it('gives each group the same box as the alpha renderer', () => {
    const world = worldBoxes();
    for (let g = 0; g < scene.groups.length; g++) {
      const group = scene.groups[g];
      if (!group) throw new Error('missing group');
      const expected = groupBounds(group);
      if (!expected) throw new Error('the synthetic meshes are never empty');
      const at = g * BOX_NUMBERS;
      for (let axis = 0; axis < 3; axis++) {
        closeTo(world[at + axis] ?? 0, expected.min[axis] ?? 0);
        closeTo(world[at + 3 + axis] ?? 0, expected.max[axis] ?? 0);
      }
    }
  });

  it('gives the same union as the alpha scene bounds', () => {
    const viewerScene = new ViewerScene();
    for (const group of scene.groups) viewerScene.addGroup(group);
    const expected = sceneBounds(viewerScene);
    if (!expected) throw new Error('the scene is not empty');
    const union = new Float64Array(BOX_NUMBERS);
    expect(unionBoxes(worldBoxes(), union)).toBe(scene.groups.length);
    for (let axis = 0; axis < 3; axis++) {
      closeTo(union[axis] ?? 0, expected.min[axis] ?? 0);
      closeTo(union[3 + axis] ?? 0, expected.max[axis] ?? 0);
    }
  });

  it('recomputing only the changed groups matches recomputing all of them', () => {
    const columns = createInstanceColumns(scene.groups);
    const rows = Int32Array.of(4, 5, 200);
    const changed = groupsOfRows(columns.groupOf, rows);
    expect(changed.length).toBeGreaterThan(0);

    const world = worldBoxes();
    for (const row of rows) {
      const group = scene.groups[columns.groupOf[row] ?? 0];
      if (!group) throw new Error('missing group');
      const slot = (columns.indexInGroup[row] ?? 0) * 16;
      group.transforms[slot + 12] = 500;
    }
    recomputeGroupBoxes(world, local, scene.groups, changed);
    const fromScratch = worldBoxes();
    expect([...world]).toEqual([...fromScratch]);
  });

  it('lists the groups of a row set once each, ascending', () => {
    const columns = createInstanceColumns(scene.groups);
    const groups = groupsOfRows(columns.groupOf, Int32Array.of(0, 1, 2, 3, 0, 1));
    expect(new Set(groups).size).toBe(groups.length);
    expect([...groups]).toEqual([...groups].sort((a, b) => a - b));
  });
});
