import { describe, expect, it } from 'vitest';
import { identityMatrix, instanceRecords, mesh, noMesh, type Geometry } from '@bim-open-toolkit/model';
import { headlessScene } from '../../src/headless/scene.js';
import { headlessMirror, rayThrough } from '../../src/headless/picking.js';
import { smallBuilding } from '../../src/fixtures/catalog.js';

// One square facing down the negative z axis, so a ray from above hits it at a known depth.
const square = mesh(
  new Float32Array([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0]),
  new Uint32Array([0, 1, 2, 0, 2, 3]),
);

const atZ = (z: number, x = 0): readonly [
  number, number, number, number, number, number, number, number,
  number, number, number, number, number, number, number, number,
] => [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, 0, z, 1];

// Two squares stacked in depth plus a row that draws nothing.
const stacked: Geometry = {
  meshes: [square],
  instances: instanceRecords([
    { meshIndex: 0, transform: atZ(0), color: [1, 0, 0], opacity: 1, objectIndex: 10 },
    { meshIndex: noMesh, transform: identityMatrix, color: [1, 1, 1], opacity: 1, objectIndex: 11 },
    { meshIndex: 0, transform: atZ(5), color: [0, 1, 0], opacity: 1, objectIndex: 12 },
  ]),
};

describe('picking against a headless scene', () => {
  it('returns both hits nearest first, named by instance row and object', () => {
    const built = headlessScene(stacked);
    const mirror = headlessMirror(built, stacked);
    // Offset from the middle: the square's two triangles share the diagonal through (0, 0), and a
    // ray along that edge hits both of them.
    const ray = rayThrough([0.5, -0.2, 10], [0.5, -0.2, 0]);
    const hits = mirror.hits(ray.origin, ray.direction);
    expect(hits.map((hit) => hit.objectIndex)).toEqual([12, 10]);
    expect(hits.map((hit) => hit.row)).toEqual([2, 0]);
    expect(hits[0]?.distance).toBeCloseTo(5);
    expect(hits[1]?.distance).toBeCloseTo(10);
    expect(hits[0]?.point[2]).toBeCloseTo(5);
    mirror.dispose();
  });

  it('misses when the ray points away from everything', () => {
    const built = headlessScene(stacked);
    const mirror = headlessMirror(built, stacked);
    expect(mirror.hits([0.5, -0.2, 10], [0, 0, 1])).toEqual([]);
    expect(mirror.hits([50, 0, 10], [0, 0, -1])).toEqual([]);
    mirror.dispose();
  });

  it('leaves out an instance that has been made invisible', () => {
    const built = headlessScene(stacked);
    const mirror = headlessMirror(built, stacked);
    const nearest = built.groups[0];
    if (nearest === undefined) throw new Error('the scene lost its only group');
    nearest.setColor(1, 0, 1, 0, 0);
    mirror.sync();
    expect(mirror.hits([0.5, -0.2, 10], [0, 0, -1]).map((hit) => hit.objectIndex)).toEqual([10]);
    mirror.dispose();
  });

  it('mirrors one object per group and sees no change when nothing moved', () => {
    const built = headlessScene(stacked);
    const mirror = headlessMirror(built, stacked);
    expect(mirror.objectCount()).toBe(1);
    expect(mirror.sync()).toBe(false);
    mirror.dispose();
  });

  it('picks an object of the small building fixture', () => {
    const fixture = smallBuilding();
    const built = headlessScene(fixture.geometry);
    const mirror = headlessMirror(built, fixture.geometry);
    // Straight down the up axis through the middle of the building must meet a slab.
    const hits = mirror.hits([0, 0, 1000], [0, 0, -1]);
    expect(hits.length).toBeGreaterThan(0);
    const first = hits[0];
    if (first === undefined) throw new Error('a ray through the building hit nothing');
    expect(fixture.model.objects[first.objectIndex]?.category).toBeDefined();
    mirror.dispose();
  });
});
