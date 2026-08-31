import { describe, it, expect } from 'vitest';
import { InstancedGroup } from '../src/instanced-group.js';
import { GroupObject } from '../src/group-object.js';
import { triangle, identity, translation, concat, rgba } from './helpers.js';

const red = rgba(1, 0, 0, 1);
const blue = rgba(0, 0, 1, 0.5);

describe('GroupObject', () => {
  it('builds an InstancedMesh with the group instance count on first sync', () => {
    const g = new InstancedGroup(triangle());
    g.append(concat(identity(), translation(1, 2, 3)), concat(red, blue));
    const o = new GroupObject(g);
    expect(o.mesh).toBeNull();
    expect(o.sync()).toBe(true);
    expect(o.mesh!.count).toBe(2);
    expect(o.mesh!.geometry.getAttribute('position').count).toBe(3);
  });

  it('copies transforms into instanceMatrix', () => {
    const g = new InstancedGroup(triangle());
    g.append(translation(1, 2, 3), red);
    const o = new GroupObject(g);
    o.sync();
    const m = o.mesh!.instanceMatrix.array as Float32Array;
    expect([m[12], m[13], m[14]]).toEqual([1, 2, 3]);
  });

  it('copies RGB colors into instanceColor', () => {
    const g = new InstancedGroup(triangle());
    g.append(concat(identity(), identity()), concat(red, blue));
    const o = new GroupObject(g);
    o.sync();
    const c = o.mesh!.instanceColor!.array as Float32Array;
    expect(Array.from(c.slice(0, 6))).toEqual([1, 0, 0, 0, 0, 1]);
  });

  it('is idempotent: a second sync with no changes reports false', () => {
    const g = new InstancedGroup(triangle());
    g.append(identity(), red);
    const o = new GroupObject(g);
    expect(o.sync()).toBe(true);
    expect(o.sync()).toBe(false);
  });

  it('picks up color updates after creation', () => {
    const g = new InstancedGroup(triangle());
    g.append(identity(), red);
    const o = new GroupObject(g);
    o.sync();
    g.setColor(0, 0, 1, 0, 1);
    expect(o.sync()).toBe(true);
    const c = o.mesh!.instanceColor!.array as Float32Array;
    expect(Array.from(c.slice(0, 3))).toEqual([0, 1, 0]);
    expect(o.mesh!.instanceColor!.needsUpdate || o.mesh!.instanceColor!.version > 0).toBe(true);
  });

  it('keeps the same mesh for appends within capacity, grows past it', () => {
    const g = new InstancedGroup(triangle(), undefined, 4);
    g.append(identity(), red);
    const o = new GroupObject(g);
    o.sync();
    const first = o.mesh!;

    g.append(identity(), red);
    o.sync();
    expect(o.mesh).toBe(first);
    expect(o.mesh!.count).toBe(2);

    g.append(concat(identity(), identity(), identity()), concat(red, red, red));
    o.sync();
    expect(o.mesh).not.toBe(first);
    expect(o.mesh!.count).toBe(5);
    const c = o.mesh!.instanceColor!.array as Float32Array;
    expect(c[12]).toBe(1); // instance 4 red channel survived the rebuild
  });

  it('mirrors visibility onto the root', () => {
    const g = new InstancedGroup(triangle());
    g.append(identity(), red);
    const o = new GroupObject(g);
    o.sync();
    expect(o.root.visible).toBe(true);
    g.visible = false;
    expect(o.sync()).toBe(true);
    expect(o.root.visible).toBe(false);
  });

  it('dispose releases geometry and material and forbids further sync', () => {
    const g = new InstancedGroup(triangle());
    g.append(identity(), red);
    const o = new GroupObject(g);
    o.sync();
    let geometryDisposed = false;
    let materialDisposed = false;
    o.mesh!.geometry.addEventListener('dispose', () => (geometryDisposed = true));
    o.mesh!.material.addEventListener('dispose', () => (materialDisposed = true));
    o.dispose();
    expect(geometryDisposed).toBe(true);
    expect(materialDisposed).toBe(true);
    expect(o.mesh).toBeNull();
    expect(o.root.children.length).toBe(0);
    expect(() => o.sync()).toThrow(/disposed/);
  });

  it('applies the material config', () => {
    const g = new InstancedGroup(triangle(), { metalness: 0.25, roughness: 0.5, opacity: 0.75 });
    const o = new GroupObject(g);
    o.sync();
    const m = o.mesh!.material;
    expect(m.metalness).toBe(0.25);
    expect(m.roughness).toBe(0.5);
    expect(m.opacity).toBe(0.75);
    expect(m.transparent).toBe(true);
  });
});
