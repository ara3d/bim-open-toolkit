import { describe, expect, it } from 'vitest';
import { BatchedMesh, BoxGeometry, Group, Mesh, MeshBasicMaterial, Plane, Vector3 } from 'three';
import { applyClipping, createSectionPlanes } from '../src/clipping.js';

describe('section planes', () => {
  it('normalizes equations without changing the retained half-space', () => {
    const plane = createSectionPlanes({ kind: 'planes', planes: [{ normal: [0, 2, 0], constant: -4 }] })[0]!;
    expect(plane.distanceToPoint(new Vector3(0, 2, 0))).toBe(0);
    expect(plane.distanceToPoint(new Vector3(0, 3, 0))).toBe(1);
    expect(() => createSectionPlanes({ kind: 'planes', planes: [{ normal: [0, 0, 0], constant: 1 }] })).toThrow();
  });
  it('keeps box interior and rejects points outside each of six faces', () => {
    const planes = createSectionPlanes({ kind: 'box', min: [-1, -2, -3], max: [1, 2, 3] });
    expect(planes).toHaveLength(6);
    expect(planes.every(plane => plane.distanceToPoint(new Vector3(0, 0, 0)) >= 0)).toBe(true);
    for (const point of [[-2,0,0], [2,0,0], [0,-3,0], [0,3,0], [0,0,-4], [0,0,4]])
      expect(planes.some(plane => plane.distanceToPoint(new Vector3(...point)) < 0)).toBe(true);
    expect(() => createSectionPlanes({ kind: 'box', min: [2,0,0], max: [1,1,1] })).toThrow();
    expect(() => createSectionPlanes({ kind: 'box', min: [0,0,0], max: [NaN,1,1] })).toThrow();
  });
});

describe('material clipping adapter', () => {
  it('handles shared/multiple/batched materials and restores their previous state', () => {
    const scene = new Group(), first = new MeshBasicMaterial(), second = new MeshBasicMaterial();
    const previous = [new Plane(new Vector3(1,0,0), 3)]; first.clippingPlanes = previous; first.clipIntersection = true;
    const geometry = new BoxGeometry();
    const mesh = new Mesh(geometry, [first, second]); scene.add(mesh, new Mesh(geometry, first));
    const batch = new BatchedMesh(1, 24, 36, second); scene.add(batch);
    const planes = createSectionPlanes({ kind: 'planes', planes: [{ normal: [0,1,0], constant: 0 }] });
    const restore = applyClipping(scene, planes);
    expect(first.clippingPlanes).toHaveLength(1);
    expect(first.clipIntersection).toBe(false);
    expect(batch.material.clippingPlanes).toBe(second.clippingPlanes);
    planes[0]!.constant = 42;
    expect(first.clippingPlanes?.[0]?.constant).toBe(0);
    restore(); restore();
    expect(first.clippingPlanes).toBe(previous);
    expect(first.clipIntersection).toBe(true);
    expect(second.clippingPlanes).toBeNull();
    batch.dispose(); geometry.dispose(); first.dispose(); second.dispose();
  });
});
