import { describe, it, expect, vi } from 'vitest';
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

  it.each([0,1000])('does not scan unchanged groups and both mirrors see mutations (threshold %i)', threshold => {
    const model=new ViewerScene(), group=new InstancedGroup(triangle());
    group.append(identity(),red); model.addGroup(group);
    const a=new SceneObject(model,threshold), b=new SceneObject(model,threshold);
    a.sync(); b.sync();
    const groups=vi.spyOn(model,'groups','get');
    expect(a.sync()).toBe(false); expect(b.sync()).toBe(false); expect(groups).not.toHaveBeenCalled();
    group.setColor(0,0,1,0,1);
    expect(a.sync()).toBe(true); expect(b.sync()).toBe(true);
    groups.mockClear(); expect(a.sync()).toBe(false); expect(groups).not.toHaveBeenCalled();
    a.dispose(); b.dispose(); model.clear();
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
