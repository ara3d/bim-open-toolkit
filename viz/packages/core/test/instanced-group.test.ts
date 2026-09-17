import { describe, it, expect } from 'vitest';
import { InstancedGroup } from '../src/instanced-group.js';
import { triangle, identity, translation, concat, rgba } from './helpers.js';

const red = rgba(1, 0, 0, 1);
const green = rgba(0, 1, 0, 1);

describe('InstancedGroup', () => {
  it('starts empty', () => {
    const g = new InstancedGroup(triangle());
    expect(g.instanceCount).toBe(0);
    expect(g.transforms.length).toBe(0);
    expect(g.colors.length).toBe(0);
    expect(g.visible).toBe(true);
  });

  it('appends instances and returns the start index', () => {
    const g = new InstancedGroup(triangle());
    expect(g.append(identity(), red)).toBe(0);
    expect(g.append(concat(identity(), identity()), concat(green, green))).toBe(1);
    expect(g.instanceCount).toBe(3);
  });

  it('round-trips transforms and colors', () => {
    const g = new InstancedGroup(triangle());
    g.append(translation(1, 2, 3), red);
    expect(Array.from(g.getTransform(0)).slice(12, 15)).toEqual([1, 2, 3]);
    expect(Array.from(g.getColor(0))).toEqual([1, 0, 0, 1]);
  });

  it('grows capacity beyond the initial allocation', () => {
    const g = new InstancedGroup(triangle(), undefined, 2);
    for (let i = 0; i < 10; i++) g.append(translation(i, 0, 0), red);
    expect(g.instanceCount).toBe(10);
    expect(g.capacity).toBeGreaterThanOrEqual(10);
    expect(g.getTransform(9)[12]).toBe(9);
    expect(Array.from(g.getColor(9))).toEqual([1, 0, 0, 1]);
  });

  it('updates a single color after creation', () => {
    const g = new InstancedGroup(triangle());
    g.append(concat(identity(), identity()), concat(red, red));
    g.setColor(1, 0, 0, 1, 0.5);
    expect(Array.from(g.getColor(1))).toEqual([0, 0, 1, 0.5]);
    expect(Array.from(g.getColor(0))).toEqual([1, 0, 0, 1]);
  });

  it('updates a color range after creation', () => {
    const g = new InstancedGroup(triangle());
    g.append(concat(identity(), identity(), identity()), concat(red, red, red));
    g.setColors(1, concat(green, green));
    expect(Array.from(g.getColor(0))).toEqual([1, 0, 0, 1]);
    expect(Array.from(g.getColor(1))).toEqual([0, 1, 0, 1]);
    expect(Array.from(g.getColor(2))).toEqual([0, 1, 0, 1]);
  });

  it('updates a transform after creation', () => {
    const g = new InstancedGroup(triangle());
    g.append(identity(), red);
    g.setTransform(0, translation(5, 6, 7));
    expect(g.getTransform(0)[12]).toBe(5);
  });

  it('bumps version counters on mutation', () => {
    const g = new InstancedGroup(triangle());
    const v0 = { c: g.countVersion, t: g.transformsVersion, k: g.colorsVersion };
    g.append(identity(), red);
    expect(g.countVersion).toBeGreaterThan(v0.c);
    expect(g.transformsVersion).toBeGreaterThan(v0.t);
    expect(g.colorsVersion).toBeGreaterThan(v0.k);

    const k1 = g.colorsVersion;
    const t1 = g.transformsVersion;
    g.setColor(0, 0, 1, 0, 1);
    expect(g.colorsVersion).toBeGreaterThan(k1);
    expect(g.transformsVersion).toBe(t1);

    const vis = g.visibilityVersion;
    g.visible = false;
    expect(g.visibilityVersion).toBeGreaterThan(vis);
    g.visible = false;
    expect(g.visibilityVersion).toBe(vis + 1);
  });

  it('rejects mismatched append lengths', () => {
    const g = new InstancedGroup(triangle());
    expect(() => g.append(new Float32Array(15), red)).toThrow(/multiple of 16/);
    expect(() => g.append(identity(), new Float32Array(3))).toThrow(/colors length/);
  });

  it('rejects out-of-range access', () => {
    const g = new InstancedGroup(triangle());
    g.append(identity(), red);
    expect(() => g.setColor(1, 0, 0, 0, 0)).toThrow(/out of range/);
    expect(() => g.getTransform(-1)).toThrow(/out of range/);
    expect(() => g.setColors(0, concat(red, red))).toThrow(/exceeds/);
  });
});
