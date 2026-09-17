import { describe, expect, it } from 'vitest';
import { Material, Vector3, Plane } from 'three';
import { SceneObject, ViewerScene } from '@ara3d/viewer-core';
import { SectionPlanes } from '../src/section-planes.js';
import { quadGroupAt } from './helpers.js';

const materialsOf = (objects: SceneObject, scene: ViewerScene): Material[] => {
  const out: Material[] = [];
  for (const group of scene.groups) {
    const mesh = objects.getObject(group)?.mesh;
    if (!mesh) continue;
    out.push(...(Array.isArray(mesh.material) ? mesh.material : [mesh.material]));
  }
  return out;
};

describe('SectionPlanes', () => {
  it('axis planes keep the expected half-space', () => {
    const sp = new SectionPlanes();
    const keepBelow = sp.addAxisPlane('z', 5);
    // three keeps points where n.p + constant >= 0
    expect(keepBelow.distanceToPoint(new Vector3(0, 0, 4))).toBeGreaterThan(0);
    expect(keepBelow.distanceToPoint(new Vector3(0, 0, 6))).toBeLessThan(0);

    const keepAbove = sp.addAxisPlane('z', 5, true);
    expect(keepAbove.distanceToPoint(new Vector3(0, 0, 6))).toBeGreaterThan(0);
    expect(keepAbove.distanceToPoint(new Vector3(0, 0, 4))).toBeLessThan(0);
    expect(sp.planes.length).toBe(2);
  });

  it('applies planes to all group materials and clears when disabled', () => {
    const scene = new ViewerScene();
    scene.addGroup(quadGroupAt([[0, 0, 0]]));
    scene.addGroup(quadGroupAt([[2, 0, 0]]));
    const objects = new SceneObject(scene);

    const sp = new SectionPlanes();
    sp.addAxisPlane('y', 1);
    sp.apply(scene, objects);

    const mats = materialsOf(objects, scene);
    expect(mats.length).toBe(2);
    for (const m of mats) expect(m.clippingPlanes).toHaveLength(1);

    sp.enabled = false;
    sp.apply(scene, objects);
    for (const m of materialsOf(objects, scene)) expect(m.clippingPlanes).toBeNull();

    sp.enabled = true;
    sp.clear();
    sp.apply(scene, objects);
    for (const m of materialsOf(objects, scene)) expect(m.clippingPlanes).toBeNull();
  });

  it('supports arbitrary planes and removal', () => {
    const sp = new SectionPlanes();
    const p = sp.addPlane(new Plane(new Vector3(1, 1, 0).normalize(), -2));
    expect(sp.planes).toContain(p);
    expect(sp.remove(p)).toBe(true);
    expect(sp.remove(p)).toBe(false);
    expect(sp.planes.length).toBe(0);
  });

  it('covers groups added after the first apply (syncs first)', () => {
    const scene = new ViewerScene();
    const objects = new SceneObject(scene);
    const sp = new SectionPlanes();
    sp.addAxisPlane('x', 0);
    sp.apply(scene, objects);

    scene.addGroup(quadGroupAt([[0, 0, 0]]));
    sp.apply(scene, objects);
    const mats = materialsOf(objects, scene);
    expect(mats.length).toBe(1);
    expect(mats[0].clippingPlanes).toHaveLength(1);
  });
});
