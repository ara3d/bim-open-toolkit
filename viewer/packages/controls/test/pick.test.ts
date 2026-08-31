import { describe, expect, it } from 'vitest';
import { PerspectiveCamera } from 'three';
import { SceneObject, ViewerScene } from '@ara3d/viewer-core';
import { Picker } from '../src/pick.js';
import { quadGroupAt, translation, white } from './helpers.js';

const makeCamera = (): PerspectiveCamera => {
  const camera = new PerspectiveCamera(50, 1, 0.1, 100);
  camera.position.set(0, 0, 5);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld(true);
  return camera;
};

describe('Picker', () => {
  it('hits the nearest instance through the center ray', () => {
    const scene = new ViewerScene();
    const group = quadGroupAt([[0, 0, 0], [0, 0, -2]]);
    scene.addGroup(group);
    const picker = new Picker(scene, new SceneObject(scene));

    const hit = picker.pick(makeCamera(), 0, 0);
    expect(hit).not.toBeNull();
    expect(hit!.group).toBe(group);
    expect(hit!.instanceIndex).toBe(0); // z=0 is nearer than z=-2
    expect(hit!.distance).toBeCloseTo(5);
  });

  it('returns null when the ray misses', () => {
    const scene = new ViewerScene();
    scene.addGroup(quadGroupAt([[100, 100, 0]]));
    const picker = new Picker(scene, new SceneObject(scene));
    expect(picker.pick(makeCamera(), 0, 0)).toBeNull();
  });

  it('skips invisible groups', () => {
    const scene = new ViewerScene();
    const group = quadGroupAt([[0, 0, 0]]);
    group.visible = false;
    scene.addGroup(group);
    const picker = new Picker(scene, new SceneObject(scene));
    expect(picker.pick(makeCamera(), 0, 0)).toBeNull();
  });

  it('picks instances appended after a capacity-growing rebuild (re-reads mesh)', () => {
    const scene = new ViewerScene();
    const group = quadGroupAt([[100, 100, 0]], 1); // capacity 1, off-axis
    scene.addGroup(group);
    const objects = new SceneObject(scene);
    const picker = new Picker(scene, objects);
    const camera = makeCamera();
    expect(picker.pick(camera, 0, 0)).toBeNull();
    const meshBefore = objects.getObject(group)!.mesh;

    group.append(translation(0, 0, 0), white()); // grows past capacity -> rebuild
    const hit = picker.pick(camera, 0, 0);
    expect(hit).not.toBeNull();
    expect(hit!.instanceIndex).toBe(1);
    expect(objects.getObject(group)!.mesh).not.toBe(meshBefore);
  });

  it('picks across multiple groups, preferring the nearest', () => {
    const scene = new ViewerScene();
    const near = quadGroupAt([[0, 0, 1]]);
    const far = quadGroupAt([[0, 0, -1]]);
    scene.addGroup(far);
    scene.addGroup(near);
    const picker = new Picker(scene, new SceneObject(scene));
    const hit = picker.pick(makeCamera(), 0, 0);
    expect(hit!.group).toBe(near);
  });
});
