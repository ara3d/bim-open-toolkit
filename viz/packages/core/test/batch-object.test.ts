import { describe, expect, it, vi } from 'vitest';
import { BatchedMesh, BufferGeometry, Matrix4, Plane, Raycaster, Vector3, Vector4 } from 'three';
import { createBatchObjects } from '../src/batch-object.js';
import { InstancedGroup } from '../src/instanced-group.js';
import { SceneObject } from '../src/scene-object.js';
import { ViewerScene } from '../src/scene.js';
import { identity, rgba, translation, triangle } from './helpers.js';

function group(mesh = triangle()) {
  const result = new InstancedGroup(mesh);
  result.append(identity(), rgba(1, 0, 0, 1));
  return result;
}

describe('batched scene mirror', () => {
  it('shares computed normals between packed and instanced mirrors', () => {
    const compute = vi.spyOn(BufferGeometry.prototype, 'computeVertexNormals');
    const [batch] = createBatchObjects([group({ positions: triangle().positions })]);
    expect(compute).toHaveBeenCalledTimes(1);
    batch.dispose();
    compute.mockRestore();
  });
  it('automatically batches large group counts and shares geometry within a batch', () => {
    const model = new ViewerScene();
    const resource = triangle();
    for (let i = 0; i < 1001; i++) model.addGroup(group(resource));
    const mirror = new SceneObject(model);
    mirror.sync();
    expect(mirror.objectCount).toBe(1001);
    expect(mirror.getObject(model.groups[0])).toBeUndefined();
    expect(mirror.scene.children).toHaveLength(1);
    const batch = mirror.scene.children[0].children[0] as BatchedMesh;
    expect(batch.instanceCount).toBe(1001);
    expect(batch.geometry.getAttribute('position').count).toBe(3);
    expect(mirror.sync()).toBe(false);
    mirror.dispose();
  });

  it('updates RGBA, transforms and visibility without replacing geometry', () => {
    const item = group();
    const [batch] = createBatchObjects([item]);
    const geometry = batch.mesh.geometry;
    const opaqueVersion = batch.material.version;
    const matrixVersion = batch.mesh.getMatrixAt(0, new Matrix4()).elements.slice();
    item.setColor(0, 0, 1, 0, 0.25);
    item.setTransform(0, translation(2, 0, 0));
    expect(batch.sync()).toBe(true);
    expect(batch.mesh.geometry).toBe(geometry);
    expect(batch.mesh.getColorAt(0, new Vector4()).toArray()).toEqual([0, 1, 0, 0.25]);
    expect(batch.material.transparent).toBe(true);
    expect(batch.material.version).toBeGreaterThan(opaqueVersion);
    const blendedVersion = batch.material.version;
    expect(batch.mesh.getMatrixAt(0, new Matrix4()).elements).not.toEqual(matrixVersion);
    item.visible = false;
    batch.sync();
    expect(batch.mesh.getVisibleAt(0)).toBe(false);
    item.visible = true;
    item.setColor(0, 1, 1, 1, 0);
    batch.sync();
    expect(batch.mesh.getVisibleAt(0)).toBe(false);
    item.setColor(0, 1, 1, 1, 1);
    batch.sync();
    expect(batch.mesh.getVisibleAt(0)).toBe(true);
    expect(batch.material.transparent).toBe(false);
    expect(batch.material.version).toBeGreaterThan(blendedVersion);
    batch.dispose();
  });

  it('reads only changed attribute buffers during incremental updates', () => {
    const item = group();
    const [batch] = createBatchObjects([item]);
    const transforms = vi.spyOn(item, 'transforms', 'get');
    const colors = vi.spyOn(item, 'colors', 'get');
    item.setColor(0,0,1,0,1);
    batch.sync();
    expect(transforms).not.toHaveBeenCalled();
    expect(colors).toHaveBeenCalledOnce();
    colors.mockClear();
    item.setTransform(0,translation(1,0,0));
    batch.sync();
    expect(transforms).toHaveBeenCalledOnce();
    expect(colors).not.toHaveBeenCalled();
    batch.dispose();
  });

  it.each([0, 1000])('resolves logical hit identity and filters alpha, visibility and clipping (threshold %i)', threshold => {
    const model = new ViewerScene();
    const item = group();
    item.append(translation(0, 0, -2), rgba(1, 1, 1, 1));
    model.addGroup(item);
    const mirror = new SceneObject(model, threshold);
    const ray = new Raycaster(new Vector3(0.2, 0.2, 5), new Vector3(0, 0, -1));
    expect(mirror.raycast(ray).map(hit => [hit.group, hit.instanceIndex, hit.distance])).toEqual([[item, 0, 5], [item, 1, 7]]);
    item.setColor(0, 1, 0, 0, 0);
    expect(mirror.raycast(ray).map(hit => hit.instanceIndex)).toEqual([1]);
    const material = threshold === 0 ? (mirror.scene.children[0].children[0] as BatchedMesh).material : mirror.getObject(item)!.mesh!.material;
    if (Array.isArray(material)) throw new Error('Expected one material');
    material.clippingPlanes = [new Plane(new Vector3(0, 0, 1), 1)];
    expect(mirror.raycast(ray)).toEqual([]);
    material.clippingPlanes = [];
    item.setTransform(1, translation(10, 0, -2));
    const movedRay = new Raycaster(new Vector3(10.2, 0.2, 5), new Vector3(0, 0, -1));
    expect(mirror.raycast(movedRay).map(hit => hit.instanceIndex)).toEqual([1]);
    item.visible = false;
    expect(mirror.raycast(ray)).toEqual([]);
    mirror.dispose();
  });

  it('rebuilds only on membership/count changes and releases old resources', () => {
    const model = new ViewerScene();
    const first = group();
    const second = group();
    model.addGroup(first);
    model.addGroup(second);
    const mirror = new SceneObject(model, 0);
    mirror.sync();
    const oldBatch = mirror.scene.children[0].children[0] as BatchedMesh;
    const geometryDisposed = vi.fn();
    const materialDisposed = vi.fn();
    oldBatch.geometry.addEventListener('dispose', geometryDisposed);
    if (Array.isArray(oldBatch.material)) throw new Error('Expected one material');
    oldBatch.material.addEventListener('dispose', materialDisposed);
    model.removeGroup(second);
    mirror.sync();
    expect(geometryDisposed).toHaveBeenCalledOnce();
    expect(materialDisposed).toHaveBeenCalledOnce();
    expect(mirror.objectCount).toBe(1);
    first.append(identity(), rgba(1, 1, 1, 1));
    mirror.sync();
    expect((mirror.scene.children[0].children[0] as BatchedMesh).instanceCount).toBe(2);
    mirror.dispose();
    expect(mirror.scene.children).toHaveLength(0);
    expect(mirror.objectCount).toBe(0);
  });

  it('caps batches at 32768 instances and separates material configurations', () => {
    const item = group();
    const transforms = new Float32Array(32768 * 16);
    const colors = new Float32Array(32768 * 4).fill(1);
    for (let i = 0; i < 32768; i++) transforms.set(identity(), i * 16);
    item.append(transforms, colors);
    const other = new InstancedGroup(item.mesh, { metalness: 0, roughness: 0, opacity: 0.5 });
    other.append(identity(), rgba(1, 1, 1, 1));
    const batches = createBatchObjects([item, other]);
    expect(batches.map(batch => batch.mesh.instanceCount)).toEqual([32768, 1, 1]);
    expect(batches[1].instances[0]).toEqual({ group: item, instanceIndex: 32768 });
    for (const batch of batches) batch.dispose();
  });

  it('computes normals after indexing and accepts mixed indexed/nonindexed meshes', () => {
    const indexed = group({ positions: new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]), indices: new Uint32Array([0, 1, 2, 0, 2, 3]) });
    const unindexed = group({ positions: triangle().positions });
    const [batch] = createBatchObjects([indexed, unindexed]);
    const normals = batch.mesh.geometry.getAttribute('normal');
    for (let i = 0; i < normals.count; i++) expect(normals.getZ(i)).toBeCloseTo(1);
    batch.dispose();
  });
});
