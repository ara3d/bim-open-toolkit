import { expect, it, vi } from 'vitest';
import { InstancedGroup, SceneObject, ViewerScene } from '@ara3d/viewer-core';
import { Mesh, PerspectiveCamera, Plane, Vector3 } from 'three';
import { boxReplacementMesh, ReplacementLayer } from '../src/replacement.js';
import { RenderBinding } from '../src/render.js';
import { identityMatrix, type ObjectRecord } from '../src/contracts.js';

function fixture() {
  const data = { positions: new Float32Array([-1,-1,0, 1,-1,0, 0,1,0]), indices: new Uint32Array([0,1,2]) };
  const group = new InstancedGroup(data);
  group.append(new Float32Array(identityMatrix), new Float32Array([1,1,1,1]));
  const moved = [...identityMatrix]; moved[12] = 3;
  group.append(new Float32Array(moved), new Float32Array([1,1,1,1]));
  const original: ObjectRecord = { ref: { modelId: 'a', objectId: 'one' }, transform: identityMatrix, appearance: { color: [1,1,1], opacity: 1, visible: true } };
  const scene = new ViewerScene(), render = new RenderBinding(scene, () => {}), mirror = new SceneObject(scene, 0);
  render.addModel('a', [0,1].map(instanceIndex => ({ ref: { modelId: 'a', objectId: instanceIndex ? 'two' : 'one' }, representationId: 'source', group, instanceIndex })));
  mirror.sync();
  const camera = new PerspectiveCamera(50,1,0.1,100); camera.position.set(0,0,5); camera.lookAt(0,0,0);
  return { data, group, original, scene, render, mirror, camera };
}

it('replaces one repeated object without changing source mesh, membership or batch geometry; undo restores it', () => {
  const f = fixture();
  const source = (f.mirror.scene.children[0] as Mesh).geometry;
  const bytes = f.data.positions.slice();
  const other = f.group.getColor(1);
  const layer = new ReplacementLayer(f.mirror, f.render, () => {});
  layer.replace(f.original, boxReplacementMesh({ min: [-0.5,-0.5,1], max: [0.5,0.5,2] }), identityMatrix);
  f.mirror.sync();
  expect(f.scene.groups).toEqual([f.group]);
  expect((f.mirror.scene.children[0] as Mesh).geometry).toBe(source);
  expect(f.data.positions).toEqual(bytes);
  expect(f.group.getColor(1)).toEqual(other);
  expect(f.group.getColor(0)[3]).toBe(0);
  expect(layer.bounds(f.original.ref)).toEqual({ min: [-0.5,-0.5,1], max: [0.5,0.5,2] });
  expect(f.render.pick(f.mirror,f.camera,0,0)).toMatchObject({ ref: f.original.ref, representationId: 'replacement', point: [0,0,2] });
  const geometry = (layer.root.children[0] as Mesh).geometry;
  const disposed = vi.fn(); geometry.addEventListener('dispose', disposed);
  expect(layer.undo(f.original.ref)).toBe(true);
  expect(disposed).toHaveBeenCalledOnce();
  expect(f.group.getColor(0)[3]).toBe(1);
  expect(f.render.pick(f.mirror,f.camera,0,0)?.representationId).toBe('source');
  layer.dispose(); f.render.dispose(); f.mirror.dispose();
});

it('filters hidden/clipped replacement hits and cleans up on disposal', () => {
  const f = fixture();
  const layer = new ReplacementLayer(f.mirror, f.render, () => {});
  layer.replace(f.original, boxReplacementMesh({ min: [-1,-1,1], max: [1,1,2] }), identityMatrix);
  layer.setVisible(f.original.ref, false);
  expect(f.render.pick(f.mirror,f.camera,0,0)).toBeUndefined();
  layer.setVisible(f.original.ref, true);
  const mesh = layer.root.children[0] as Mesh;
  if (Array.isArray(mesh.material)) throw new Error('Expected single material');
  mesh.material.clippingPlanes = [new Plane(new Vector3(0,0,1),-3)];
  expect(f.render.pick(f.mirror,f.camera,0,0)).toBeUndefined();
  layer.dispose(); layer.dispose();
  expect(f.mirror.scene.children).not.toContain(layer.root);
  expect(f.render.pick(f.mirror,f.camera,0,0)?.representationId).toBe('source');
  expect(() => layer.replace(f.original, f.data)).toThrow('disposed');
  f.render.dispose(); f.mirror.dispose();
});

it('keeps an originally hidden source hidden and computes indexed replacement normals without mutating supplied buffers', () => {
  const f = fixture();
  const hidden = { ...f.original, appearance: { ...f.original.appearance, visible: false } };
  const layer = new ReplacementLayer(f.mirror, f.render, () => {});
  const supplied = { positions: new Float32Array([0,0,0, 1,0,0, 1,1,0, 0,1,0]), indices: new Uint32Array([0,1,2,0,2,3]) };
  layer.replace(hidden, supplied);
  layer.setVisible(hidden.ref, true);
  expect(layer.root.children[0]!.visible).toBe(false);
  const geometry = (layer.root.children[0] as Mesh).geometry;
  expect(geometry.getAttribute('normal').getZ(3)).toBe(1);
  expect(geometry.getAttribute('position').array).not.toBe(supplied.positions);
  layer.dispose();
  expect(f.group.getColor(0)[3]).toBe(0);
  f.render.dispose(); f.mirror.dispose();
});
