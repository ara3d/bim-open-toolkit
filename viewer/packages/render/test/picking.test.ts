import { describe, expect, it } from 'vitest';
import { identityMatrix, type Matrix4, type Vec3 } from '@bim-open-toolkit/model';
import { boxPlanes } from '../src/clipping.js';
import { buildInstanceTable } from '../src/instance-table.js';
import {
  defaultPickOptions,
  groupOrdinals,
  instanceSource,
  intersectMesh,
  intersectTriangle,
  isPickable,
  nearestHit,
  pick,
  pickInstances,
  pointOnRay,
  projectPoint,
  rayThroughNdc,
  resolveHit,
  rowOfSlot,
  type ObjectHit,
  type Ray,
  type RaycastHit,
} from '../src/picking.js';
import { writeOpacity, writeVisibility } from '../src/updates.js';
import { cube, fixtureKey, standardKeys, standardScene } from './fixture.js';

const built = () => {
  const result = buildInstanceTable(standardScene(), standardKeys);
  if (!result.ok) throw new Error('fixture did not build');
  return result.value;
};

const hit = (group: number, slot: number, distance: number, point: Vec3 = [0, 0, 0]): RaycastHit => ({
  group,
  slot,
  point,
  distance,
});

describe('rowOfSlot', () => {
  it('maps a group and slot to a table row', () => {
    const table = built();
    expect(rowOfSlot(table, 0, 0)).toBe(0);
    expect(rowOfSlot(table, 1, 1)).toBe(3);
    expect(rowOfSlot(table, 2, 0)).toBe(4);
  });

  it('rejects a slot past the end of its group and an unknown group', () => {
    const table = built();
    expect(rowOfSlot(table, 2, 1)).toBe(-1);
    expect(rowOfSlot(table, 0, -1)).toBe(-1);
    expect(rowOfSlot(table, 9, 0)).toBe(-1);
  });
});

describe('groupOrdinals', () => {
  it('gives a renderer the ordinal of each group object', () => {
    const table = built();
    const ordinals = groupOrdinals(table);
    expect(ordinals.size).toBe(3);
    for (let g = 0; g < table.groups.length; g++) {
      const group = table.groups[g];
      if (group !== undefined) expect(ordinals.get(group)).toBe(g);
    }
  });
});

describe('isPickable', () => {
  it('is true for a shown row and false once it is hidden', () => {
    const table = built();
    expect(isPickable(table, 0)).toBe(true);
    writeVisibility(table, Int32Array.of(0), Uint8Array.of(0));
    expect(isPickable(table, 0)).toBe(false);
  });

  it('is false for a row the renderer discards for being too transparent', () => {
    const table = built();
    writeOpacity(table, Int32Array.of(1), Float32Array.of(0.0001));
    expect(isPickable(table, 1)).toBe(false);
  });

  it('stays true for a ghosted row, which is still pointed at', () => {
    const table = built();
    writeOpacity(table, Int32Array.of(1), Float32Array.of(0.2));
    expect(isPickable(table, 1)).toBe(true);
  });
});

describe('resolveHit', () => {
  it('reports the object key, not the group and slot', () => {
    const table = built();
    const found = resolveHit(table, hit(1, 1, 5, [1, 2, 3]));
    expect(found?.key).toBe(fixtureKey(1));
    expect(found?.row).toBe(3);
    expect(found?.point).toEqual([1, 2, 3]);
    expect(found?.source).toBe(instanceSource);
  });

  it('drops a hit on a hidden row unless hidden rows are asked for', () => {
    const table = built();
    writeVisibility(table, Int32Array.of(0), Uint8Array.of(0));
    expect(resolveHit(table, hit(0, 0, 1))).toBeUndefined();
    expect(resolveHit(table, hit(0, 0, 1), { includeHidden: true, planes: [] })?.row).toBe(0);
  });

  it('drops a hit the clipping planes removed, so a cut surface does not block a pick', () => {
    const table = built();
    const planes = boxPlanes([0, 0, 0], [1, 1, 1]);
    if (!planes.ok) throw new Error('bad fixture');
    expect(resolveHit(table, hit(0, 0, 1, [0.5, 0.5, 0.5]), { includeHidden: false, planes: planes.value })?.row).toBe(0);
    expect(resolveHit(table, hit(0, 0, 1, [9, 9, 9]), { includeHidden: false, planes: planes.value })).toBeUndefined();
  });

  it('drops a hit that addresses nothing', () => {
    expect(resolveHit(built(), hit(7, 0, 1))).toBeUndefined();
  });
});

describe('nearestHit', () => {
  const at = (distance: number, source: string): ObjectHit => ({
    key: fixtureKey(0),
    object: 0,
    row: 0,
    point: [0, 0, 0],
    distance,
    source,
  });

  it('takes the closest', () => {
    expect(nearestHit([at(5, 'a'), at(2, 'b'), at(9, 'c')])?.source).toBe('b');
  });

  it('ignores hits behind the ray and at infinity', () => {
    expect(nearestHit([at(-1, 'a'), at(Number.POSITIVE_INFINITY, 'b'), at(3, 'c')])?.source).toBe('c');
    expect(nearestHit([])).toBeUndefined();
  });
});

describe('pickInstances', () => {
  it('takes the closest visible hit', () => {
    const table = built();
    const found = pickInstances(table, [hit(2, 0, 8), hit(0, 1, 3), hit(1, 0, 5)]);
    expect(found?.key).toBe(fixtureKey(2));
    expect(found?.distance).toBe(3);
  });

  it('falls through a hidden object to what is behind it', () => {
    const table = built();
    writeVisibility(table, Int32Array.of(1), Uint8Array.of(0));
    const found = pickInstances(table, [hit(0, 1, 3), hit(1, 0, 5)]);
    expect(found?.key).toBe(fixtureKey(1));
    expect(found?.distance).toBe(5);
  });

  it('returns nothing when everything was rejected', () => {
    expect(pickInstances(built(), [hit(9, 9, 1)])).toBeUndefined();
  });
});

describe('pick', () => {
  const ray: Ray = { origin: [0, 0, 0], direction: [0, 0, 1] };

  it('lets a source that draws its own geometry win when it is in front', () => {
    const table = built();
    const replacement: ObjectHit = {
      key: fixtureKey(3),
      object: 3,
      row: -1,
      point: [0, 0, 1],
      distance: 1,
      source: 'unused',
    };
    const found = pick(table, ray, () => [hit(0, 0, 4)], [{ id: 'replacement', hits: () => [replacement] }]);
    expect(found?.source).toBe('replacement');
    expect(found?.key).toBe(fixtureKey(3));
  });

  it('keeps the instance hit when the extra source is behind it', () => {
    const table = built();
    const behind: ObjectHit = { key: fixtureKey(3), object: 3, row: -1, point: [0, 0, 9], distance: 9, source: 'x' };
    const found = pick(table, ray, () => [hit(0, 0, 4)], [{ id: 'overlay', hits: () => [behind] }]);
    expect(found?.source).toBe(instanceSource);
  });

  it('clips an extra source too', () => {
    const table = built();
    const planes = boxPlanes([0, 0, 0], [1, 1, 1]);
    if (!planes.ok) throw new Error('bad fixture');
    const outside: ObjectHit = { key: fixtureKey(3), object: 3, row: -1, point: [5, 5, 5], distance: 1, source: 'x' };
    const found = pick(table, ray, () => [], [{ id: 'overlay', hits: () => [outside] }], {
      includeHidden: false,
      planes: planes.value,
    });
    expect(found).toBeUndefined();
  });

  it('returns nothing when the renderer reported nothing', () => {
    expect(pick(built(), ray, () => [], [], defaultPickOptions)).toBeUndefined();
  });
});

describe('ray geometry', () => {
  it('finds the point a distance along a ray', () => {
    expect(pointOnRay({ origin: [1, 0, 0], direction: [0, 1, 0] }, 3)).toEqual([1, 3, 0]);
  });

  it('hits a triangle the ray passes through', () => {
    const ray: Ray = { origin: [0.25, 0.25, -1], direction: [0, 0, 1] };
    expect(intersectTriangle(ray, [0, 0, 0], [1, 0, 0], [0, 1, 0])).toBeCloseTo(1, 9);
  });

  it('misses a triangle beside the ray', () => {
    const ray: Ray = { origin: [5, 5, -1], direction: [0, 0, 1] };
    expect(intersectTriangle(ray, [0, 0, 0], [1, 0, 0], [0, 1, 0])).toBeUndefined();
  });

  it('misses a triangle behind the ray', () => {
    const ray: Ray = { origin: [0.25, 0.25, 1], direction: [0, 0, 1] };
    expect(intersectTriangle(ray, [0, 0, 0], [1, 0, 0], [0, 1, 0])).toBeUndefined();
  });

  it('hits a back face, because a section cut leaves them facing the camera', () => {
    const ray: Ray = { origin: [0.25, 0.25, 1], direction: [0, 0, -1] };
    expect(intersectTriangle(ray, [0, 0, 0], [1, 0, 0], [0, 1, 0])).toBeCloseTo(1, 9);
  });

  it('misses a triangle in the plane of the ray', () => {
    const ray: Ray = { origin: [0, 0, 0], direction: [1, 0, 0] };
    expect(intersectTriangle(ray, [0, 0, 0], [1, 0, 0], [0, 1, 0])).toBeUndefined();
  });
});

describe('intersectMesh', () => {
  it('reports the nearest face of a placed mesh', () => {
    const box = cube(2);
    const ray: Ray = { origin: [0, 0, -10], direction: [0, 0, 1] };
    const found = intersectMesh(ray, box);
    expect(found?.distance).toBeCloseTo(9, 6);
    expect(found?.point[2]).toBeCloseTo(-1, 6);
  });

  it('takes a transform into account', () => {
    const box = cube(2);
    const moved: Matrix4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 5, 1];
    const ray: Ray = { origin: [0, 0, -10], direction: [0, 0, 1] };
    expect(intersectMesh(ray, box, moved)?.distance).toBeCloseTo(14, 6);
    expect(intersectMesh(ray, box, identityMatrix)?.distance).toBeCloseTo(9, 6);
  });

  it('misses a mesh the ray does not cross', () => {
    const ray: Ray = { origin: [50, 50, -10], direction: [0, 0, 1] };
    expect(intersectMesh(ray, cube(2))).toBeUndefined();
  });
});

describe('rayThroughNdc', () => {
  // An orthographic camera looking down -z, in a cube two units on a side: the inverse maps the
  // normalized cube straight back to world coordinates.
  const inverse: Matrix4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1];

  it('makes a ray with a unit direction through the named point', () => {
    const ray = rayThroughNdc(inverse, 0.5, -0.25);
    expect(ray?.origin).toEqual([0.5, -0.25, 1]);
    expect(ray?.direction).toEqual([0, 0, -1]);
  });

  it('gives nothing when the point maps to infinity', () => {
    const degenerate: Matrix4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0];
    expect(rayThroughNdc(degenerate, 0, 0)).toBeUndefined();
    expect(projectPoint(degenerate, [0, 0, 0])).toBeUndefined();
  });
});
