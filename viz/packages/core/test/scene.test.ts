import { describe, it, expect } from 'vitest';
import { ViewerScene } from '../src/scene.js';
import { InstancedGroup } from '../src/instanced-group.js';
import { identity, rgba, triangle, translation } from './helpers.js';

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

  it('tracks all mutations and releases subscriptions on removal and clear', () => {
    const first=new ViewerScene(), second=new ViewerScene(), group=new InstancedGroup(triangle());
    first.addGroup(group); second.addGroup(group);
    const mutations=[()=>group.append(identity(),rgba(1,1,1,1)),()=>group.setColor(0,1,0,0,1),
      ()=>group.setColors(0,rgba(0,1,0,1)),()=>group.setTransform(0,translation(1,2,3)),()=>{group.visible=false;}];
    for(const mutate of mutations){
      const version=first.version; mutate(); expect(first.version).toBe(version+1); expect(second.version).toBe(first.version);
    }
    first.removeGroup(group); const removed=first.version;
    group.visible=true; expect(first.version).toBe(removed); expect(second.version).toBeGreaterThan(removed-1);
    second.clear(); const cleared=second.version;
    group.setColor(0,0,0,0,0); expect(second.version).toBe(cleared);
    first.addGroup(group); const added=first.version; group.visible=false; expect(first.version).toBe(added+1);
    first.clear();
  });
});
