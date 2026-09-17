import { describe, it, expect } from 'vitest';
import { InstancedBufferAttribute } from 'three';
import { InstancedGroup } from '../src/instanced-group.js';
import { GroupObject } from '../src/group-object.js';
import { INSTANCE_ALPHA_ATTRIBUTE, INSTANCE_ALPHA_CACHE_KEY } from '../src/instance-alpha.js';
import { triangle, identity, concat, rgba } from './helpers.js';

const alphaAttr = (o: GroupObject): InstancedBufferAttribute =>
  o.mesh!.geometry.getAttribute(INSTANCE_ALPHA_ATTRIBUTE) as InstancedBufferAttribute;

const alphas = (o: GroupObject, n: number): number[] =>
  Array.from((alphaAttr(o).array as Float32Array).slice(0, n));

describe('GroupObject per-instance alpha', () => {
  it('mirrors the 4th color channel into the instanceAlpha attribute on sync', () => {
    const g = new InstancedGroup(triangle());
    g.append(concat(identity(), identity(), identity()),
      concat(rgba(1, 0, 0, 1), rgba(0, 1, 0, 0.5), rgba(0, 0, 1, 0)));
    const o = new GroupObject(g);
    o.sync();
    expect(alphas(o, 3)).toEqual([1, 0.5, 0]);
    expect(alphaAttr(o).itemSize).toBe(1);
  });

  it('picks up alpha updates via setColors and flags needsUpdate', () => {
    const g = new InstancedGroup(triangle());
    g.append(concat(identity(), identity()), concat(rgba(1, 0, 0, 1), rgba(1, 0, 0, 1)));
    const o = new GroupObject(g);
    o.sync();
    const versionBefore = alphaAttr(o).version;
    g.setColors(0, concat(rgba(1, 0, 0, 0.25), rgba(1, 0, 0, 0)));
    expect(o.sync()).toBe(true);
    expect(alphas(o, 2)).toEqual([0.25, 0]);
    const a = alphaAttr(o);
    expect(a.needsUpdate || a.version > versionBefore).toBe(true);
  });

  it('sets material.transparent when a fractional alpha is present', () => {
    const g = new InstancedGroup(triangle());
    g.append(identity(), rgba(1, 0, 0, 0.5));
    const o = new GroupObject(g);
    o.sync();
    expect(o.mesh!.material.transparent).toBe(true);
    expect(o.mesh!.material.depthWrite).toBe(true);
  });

  it('keeps the material opaque when alphas are only 0 or 1', () => {
    const g = new InstancedGroup(triangle());
    g.append(concat(identity(), identity()), concat(rgba(1, 0, 0, 1), rgba(0, 1, 0, 0)));
    const o = new GroupObject(g);
    o.sync();
    expect(o.mesh!.material.transparent).toBe(false);
  });

  it('restores transparent=false when fractional alphas return to 0/1', () => {
    const g = new InstancedGroup(triangle());
    g.append(identity(), rgba(1, 0, 0, 0.5));
    const o = new GroupObject(g);
    o.sync();
    expect(o.mesh!.material.transparent).toBe(true);
    g.setColor(0, 1, 0, 0, 1);
    o.sync();
    expect(o.mesh!.material.transparent).toBe(false);
    g.setColor(0, 1, 0, 0, 0);
    o.sync();
    expect(o.mesh!.material.transparent).toBe(false);
  });

  it('respects config.opacity < 1 even when all instance alphas are 1', () => {
    const g = new InstancedGroup(triangle(), { metalness: 0.1, roughness: 0.8, opacity: 0.75 });
    g.append(identity(), rgba(1, 0, 0, 1));
    const o = new GroupObject(g);
    o.sync();
    expect(o.mesh!.material.transparent).toBe(true);
    g.setColor(0, 1, 0, 0, 0.5);
    o.sync();
    g.setColor(0, 1, 0, 0, 1);
    o.sync();
    expect(o.mesh!.material.transparent).toBe(true);
  });

  it('keeps the alpha attribute sized to capacity across rebuild-on-growth', () => {
    const g = new InstancedGroup(triangle(), undefined, 2);
    g.append(concat(identity(), identity()), concat(rgba(1, 0, 0, 0.5), rgba(0, 1, 0, 1)));
    const o = new GroupObject(g);
    o.sync();
    expect(alphaAttr(o).count).toBe(2);

    g.append(concat(identity(), identity(), identity()),
      concat(rgba(0, 0, 1, 0.25), rgba(0, 0, 1, 0), rgba(0, 0, 1, 1)));
    o.sync();
    expect(alphaAttr(o).count).toBe(g.capacity);
    expect(alphas(o, 5)).toEqual([0.5, 1, 0.25, 0, 1]);
  });

  it('marks the material with the instance-alpha program cache key', () => {
    const g = new InstancedGroup(triangle());
    g.append(identity(), rgba(1, 0, 0, 1));
    const o = new GroupObject(g);
    o.sync();
    expect(o.mesh!.material.customProgramCacheKey()).toBe(INSTANCE_ALPHA_CACHE_KEY);
  });
});
