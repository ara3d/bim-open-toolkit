import { describe, it, expect } from 'vitest';
import { ViewerScene } from '../src/scene.js';
import { InstancedGroup } from '../src/instanced-group.js';
import { triangle } from './helpers.js';

describe('ViewerScene', () => {
  it('adds and removes groups', () => {
    const s = new ViewerScene();
    const g = new InstancedGroup(triangle());
    s.addGroup(g);
    expect(s.groupCount).toBe(1);
    expect(s.groups).toContain(g);
    expect(s.removeGroup(g)).toBe(true);
    expect(s.groupCount).toBe(0);
    expect(s.removeGroup(g)).toBe(false);
  });

  it('rejects adding the same group twice', () => {
    const s = new ViewerScene();
    const g = new InstancedGroup(triangle());
    s.addGroup(g);
    expect(() => s.addGroup(g)).toThrow(/already/);
  });

  it('clears all groups', () => {
    const s = new ViewerScene();
    s.addGroup(new InstancedGroup(triangle()));
    s.addGroup(new InstancedGroup(triangle()));
    s.clear();
    expect(s.groupCount).toBe(0);
  });
});
