import { describe, it, expect } from 'vitest';
import { ViewerScene } from '../src/scene.js';
import { SceneObject } from '../src/scene-object.js';
import { InstancedGroup } from '../src/instanced-group.js';
import { triangle, identity, rgba } from './helpers.js';

const red = rgba(1, 0, 0, 1);

describe('SceneObject', () => {
  it('mirrors model groups into the THREE.Scene', () => {
    const model = new ViewerScene();
    const so = new SceneObject(model);
    const g = new InstancedGroup(triangle());
    g.append(identity(), red);
    model.addGroup(g);
    expect(so.sync()).toBe(true);
    expect(so.objectCount).toBe(1);
    expect(so.scene.children).toContain(so.getObject(g)!.root);
  });

  it('removes and disposes objects for removed groups', () => {
    const model = new ViewerScene();
    const so = new SceneObject(model);
    const g = new InstancedGroup(triangle());
    g.append(identity(), red);
    model.addGroup(g);
    so.sync();
    const obj = so.getObject(g)!;
    let disposed = false;
    obj.mesh!.geometry.addEventListener('dispose', () => (disposed = true));

    model.removeGroup(g);
    expect(so.sync()).toBe(true);
    expect(so.objectCount).toBe(0);
    expect(so.scene.children).not.toContain(obj.root);
    expect(disposed).toBe(true);
  });

  it('reports false when nothing changed', () => {
    const model = new ViewerScene();
    const so = new SceneObject(model);
    model.addGroup(new InstancedGroup(triangle()));
    so.sync();
    expect(so.sync()).toBe(false);
  });

  it('dispose releases every group object', () => {
    const model = new ViewerScene();
    const so = new SceneObject(model);
    model.addGroup(new InstancedGroup(triangle()));
    model.addGroup(new InstancedGroup(triangle()));
    so.sync();
    so.dispose();
    expect(so.objectCount).toBe(0);
    expect(so.scene.children.length).toBe(0);
    expect(() => so.sync()).toThrow(/disposed/);
  });
});
