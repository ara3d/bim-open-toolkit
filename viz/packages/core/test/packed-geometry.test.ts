import { describe, expect, it, vi } from 'vitest';
import { Matrix4, Mesh, Vector3 } from 'three';
import { createBatchObjects } from '../src/batch-object.js';
import { InstancedGroup } from '../src/instanced-group.js';
import { identity, rgba, translation, triangle } from './helpers.js';

function fixture() {
  const group = new InstancedGroup(triangle());
  group.append(translation(2, 3, 4), rgba(1, 0, 0, 1));
  group.append(identity(), rgba(0, 1, 0, 1));
  const [batch] = createBatchObjects([group]);
  const packed = batch.root.children[1] as Mesh;
  return { group, batch, packed };
}

describe('packed opaque geometry', () => {
  it('bakes independent instances without changing source geometry', () => {
    const {group,batch,packed} = fixture();
    expect(batch.mesh.visible).toBe(false);
    expect(packed.visible).toBe(true);
    expect([...packed.geometry.index!.array]).toEqual([0,1,2,3,4,5]);
    expect([...packed.geometry.getAttribute('position').array]).toEqual([2,3,4,3,3,4,2,4,4,0,0,0,1,0,0,0,1,0]);
    expect([...group.mesh.positions]).toEqual([...triangle().positions]);
    expect(packed.material).toBe(batch.material);
    batch.dispose();
  });

  it('updates color, hidden state and transformed normals in place; restores opaque rendering after ghosting', () => {
    const {group,batch,packed} = fixture();
    const geometry = packed.geometry;
    group.setColor(0,0,0,1,0);
    group.setTransform(1,new Float32Array(new Matrix4().makeRotationY(Math.PI/2).scale(new Vector3(2,3,4)).elements));
    batch.sync();
    expect(geometry.getAttribute('color').getW(0)).toBe(0);
    expect(geometry.getAttribute('normal').getX(3)).toBeCloseTo(1);
    expect(geometry.getAttribute('position').getZ(4)).toBeCloseTo(-2);
    group.visible = false; batch.sync();
    expect(geometry.getAttribute('color').getW(3)).toBe(0);
    group.visible = true; group.setColor(0,1,0,0,0.25); batch.sync();
    expect(batch.mesh.visible).toBe(true);
    expect(packed.visible).toBe(false);
    group.setColor(0,1,0,0,1); batch.sync();
    expect(packed.visible).toBe(true);
    expect(batch.mesh.visible).toBe(false);
    expect(packed.geometry).toBe(geometry);
    expect(geometry.getAttribute('color').getW(3)).toBe(1);
    const released = vi.fn(); geometry.addEventListener('dispose',released);
    batch.dispose(); batch.dispose(); expect(released).toHaveBeenCalledOnce();
  });

  it('bounds expanded vertex allocation and isolates initially transparent groups', () => {
    const group = new InstancedGroup({positions:new Float32Array(99*3)});
    const transforms = new Float32Array(3000*16);
    for(let i=0;i<3000;i++)transforms.set(identity(),i*16);
    group.append(transforms,new Float32Array(3000*4).fill(1));
    const transparent = new InstancedGroup(triangle()); transparent.append(identity(),rgba(1,1,1,0.5));
    const batches = createBatchObjects([group,transparent]);
    expect(batches).toHaveLength(3);
    for(const batch of batches){
      const packed=batch.root.children[1] as Mesh;
      expect(packed.geometry.getAttribute('position').count).toBeLessThanOrEqual(262144);
      batch.dispose();
    }
  });

  it('allows the shared-geometry path without allocating packed buffers', () => {
    const {group,batch} = fixture(); batch.dispose();
    const [fallback] = createBatchObjects([group],false);
    expect(fallback.root.children).toEqual([fallback.mesh]);
    expect(fallback.mesh.visible).toBe(true);
    expect(fallback.material.vertexColors).toBe(false);
    fallback.dispose();
  });
});
