import { describe, expect, it, vi } from 'vitest';
import { InstancedGroup, ViewerScene, SceneObject } from '@ara3d/viewer-core';
import { PerspectiveCamera, Plane, Vector3 } from 'three';
import { RenderBinding } from '../src/render.js';
import { identityMatrix, type ObjectRecord } from '../src/contracts.js';

const group = () => {
  const result = new InstancedGroup({ positions: new Float32Array([-1,-1,0, 1,-1,0, 0,1,0]) });
  result.append(new Float32Array(identityMatrix), new Float32Array([1,1,1,1]));
  return result;
};
const record = (modelId: string): ObjectRecord => ({ ref: { modelId, objectId: 'same' }, transform: identityMatrix, appearance: { color: [1,0,0], opacity: 1, visible: true } });
const bind = (adapter: RenderBinding, modelId: string, mesh: InstancedGroup) => adapter.addModel(modelId, [{ ref: record(modelId).ref, group: mesh, instanceIndex: 0, representationId: 'body' }]);

describe('render boundary', () => {
  it('skips Float32-equivalent colors and repairs external instance mutations on the next update', () => {
    const scene = new ViewerScene(), adapter = new RenderBinding(scene, () => {}), mesh = group();
    const local = [...identityMatrix]; local[12] = 0.1;
    adapter.addModel('a', [{ ref: record('a').ref, representationId: 'body', group: mesh, instanceIndex: 0, localTransform: local as unknown as ObjectRecord['transform'] }]);
    const updated = { ...record('a'), appearance: { color: [0.1,0.2,0.3] as const, opacity: 0.4, visible: true } };
    adapter.update([updated]);
    const colors = mesh.colorsVersion, transforms = mesh.transformsVersion;
    adapter.update([updated]);
    expect(mesh.colorsVersion).toBe(colors);
    expect(mesh.transformsVersion).toBe(transforms);
    mesh.setColor(0,0,0,0,1); mesh.setTransform(0,new Float32Array(identityMatrix));
    adapter.update([updated]);
    expect(mesh.getColor(0)).toEqual(new Float32Array([0.1,0.2,0.3,0.4]));
    expect(mesh.transforms[12]).toBe(Math.fround(0.1));
    adapter.applySnapshot([]);
    const hidden = mesh.colorsVersion;
    adapter.applySnapshot([]);
    expect(mesh.colorsVersion).toBe(hidden);
    adapter.dispose();
  });
  it('merges optional pick sources by distance, rejects unknown refs and removes providers', () => {
    const scene = new ViewerScene(), adapter = new RenderBinding(scene, () => {}), mirror = new SceneObject(scene);
    bind(adapter, 'a', group());
    const camera = new PerspectiveCamera(50,1,0.1,100); camera.position.set(0,0,5); camera.lookAt(0,0,0);
    const remove = adapter.addPickSource(() => [
      { ref: record('unknown').ref, representationId: 'invalid', point: [0,0,4], distance: 1 },
      { ref: record('a').ref, representationId: 'overlay', point: [0,0,3], distance: 2 },
      { ref: record('a').ref, representationId: 'far', point: [0,0,-2], distance: 7 },
    ]);
    expect(adapter.pick(mirror,camera,0,0)?.representationId).toBe('overlay');
    remove(); remove();
    expect(adapter.pick(mirror,camera,0,0)?.representationId).toBe('body');
    adapter.dispose();
    expect(adapter.pick(mirror,camera,0,0)).toBeUndefined();
    expect(() => adapter.addPickSource(() => [])).toThrow('disposed');
    mirror.dispose();
  });
  it('does not reupload unchanged transforms rounded to Float32 storage', () => {
    const adapter = new RenderBinding(new ViewerScene(), () => {}), mesh = group();
    const local = [1,0,0,0,0,Math.cos(-Math.PI/2),-1,0,0,1,Math.cos(-Math.PI/2),0,0.1,0,0,1] as const;
    expect(adapter.addModel('a', [{ ref: record('a').ref, representationId: 'body', group: mesh, instanceIndex: 0, localTransform: local }]).ok).toBe(true);
    adapter.update([record('a')]);
    const firstVersion = mesh.transformsVersion;
    expect(mesh.transforms[12]).toBe(Math.fround(0.1));
    adapter.update([{ ...record('a'), appearance: { color: [0,1,0], opacity: 0.5, visible: true } }]);
    expect(mesh.transformsVersion).toBe(firstVersion);
    adapter.update([{ ...record('a'), transform: [1,0,0,0,0,1,0,0,0,0,1,0,1,0,0,1] }]);
    expect(mesh.transformsVersion).toBe(firstVersion + 1);
    adapter.dispose();
  });
  it('multiplies logical edits by representation placement and color, including picking', () => {
    const scene = new ViewerScene(), adapter = new RenderBinding(scene, () => {}), mirror = new SceneObject(scene);
    const mesh = group();
    const local = [1,0,0,0,0,1,0,0,0,0,1,0,0,0,-2,1] as const;
    expect(adapter.addModel('a', [{ ref: record('a').ref, representationId: 'body', group: mesh, instanceIndex: 0, localTransform: local, colorFactor: [0.5, 0.25, 1, 0.5] }]).ok).toBe(true);
    const white = { ...record('a'), appearance: { color: [1, 1, 1] as const, opacity: 0.5, visible: true } };
    adapter.update([white]);
    expect([...mesh.colors]).toEqual([0.5, 0.25, 1, 0.25]);
    expect(mesh.getTransform(0)[14]).toBe(-2);
    const camera = new PerspectiveCamera(50,1,0.1,100); camera.position.set(0,0,5); camera.lookAt(0,0,0);
    expect(adapter.pick(mirror, camera, 0, 0)?.point[2]).toBeCloseTo(-2);
    adapter.update([{ ...white, appearance: { ...white.appearance, visible: false } }]);
    expect(adapter.pick(mirror, camera, 0, 0)).toBeUndefined();
    adapter.dispose(); mirror.dispose();
  });
  it('rejects invalid representation factors before scene mutation', () => {
    const scene = new ViewerScene(), adapter = new RenderBinding(scene, () => {});
    expect(adapter.addModel('a', [{ ref: record('a').ref, representationId: 'body', group: group(), instanceIndex: 0, colorFactor: [1, 1, 1, NaN] }]).ok).toBe(false);
    expect(scene.groupCount).toBe(0);
  });
  it('keeps model identity and ownership separate and submits once per batch', () => {
    const scene = new ViewerScene(), request = vi.fn(), adapter = new RenderBinding(scene, request);
    const a = group(), b = group();
    expect(bind(adapter, 'a', a).ok).toBe(true);
    expect(bind(adapter, 'b', b).ok).toBe(true);
    request.mockClear();
    adapter.update([record('a')]);
    expect(request).toHaveBeenCalledTimes(1);
    expect([...a.colors]).toEqual([1,0,0,1]);
    expect([...b.colors]).toEqual([1,1,1,1]);
    adapter.removeModel('a');
    expect(scene.groups).toEqual([b]);
    expect(adapter.resolveInstance(a, 0)).toBeUndefined();
    adapter.dispose(); adapter.dispose();
    expect(scene.groupCount).toBe(0);
  });
  it('validates complete batches before mutation and hides removed snapshot members', () => {
    const adapter = new RenderBinding(new ViewerScene(), () => {}), mesh = group();
    bind(adapter, 'a', mesh);
    const invalid = { ...record('a'), appearance: { color: [NaN, 0, 0] as const, opacity: 1, visible: true } };
    expect(adapter.update([invalid]).ok).toBe(false);
    expect([...mesh.colors]).toEqual([1,1,1,1]);
    adapter.applySnapshot([]);
    expect(mesh.colors[3]).toBe(0);
    adapter.applySnapshot([record('a')]);
    expect(mesh.colors[3]).toBe(1);
  });
  it('rejects reused groups without partially adding a model', () => {
    const scene = new ViewerScene(), adapter = new RenderBinding(scene, () => {}), mesh = group();
    bind(adapter, 'a', mesh);
    expect(bind(adapter, 'b', mesh).ok).toBe(false);
    expect(scene.groupCount).toBe(1);
  });
  it('picks the visible object behind a hidden object and preserves the world hit', () => {
    const scene = new ViewerScene(), adapter = new RenderBinding(scene, () => {}), mirror = new SceneObject(scene);
    const near = group(), far = group();
    bind(adapter, 'near', near); bind(adapter, 'far', far);
    const transform = [...identityMatrix]; transform[14] = -2;
    far.setTransform(0, new Float32Array(transform));
    near.setColor(0,1,1,1,0);
    const camera = new PerspectiveCamera(50,1,0.1,100); camera.position.set(0,0,5); camera.lookAt(0,0,0);
    expect(adapter.pick(mirror, camera, 0, 0)).toMatchObject({ ref: record('far').ref, point: [0,0,-2] });
    adapter.dispose(); mirror.dispose();
  });
  it('rejects clipped hits and updates only the targeted transform', () => {
    const scene = new ViewerScene(), adapter = new RenderBinding(scene, () => {}), mirror = new SceneObject(scene);
    const a = group(), b = group(); bind(adapter, 'a', a); bind(adapter, 'b', b);
    const moved = { ...record('a'), transform: [1,0,0,0,0,1,0,0,0,0,1,0, 0,0,-2,1] as const };
    adapter.update([moved]);
    expect(a.transforms[14]).toBe(-2); expect(b.transforms[14]).toBe(0);
    mirror.sync();
    const material = mirror.getObject(b)!.mesh!.material;
    const materials = Array.isArray(material) ? material : [material];
    for (const entry of materials) entry.clippingPlanes = [new Plane(new Vector3(0,0,-1),-1)];
    const camera = new PerspectiveCamera(50,1,0.1,100); camera.position.set(0,0,5); camera.lookAt(0,0,0);
    expect(adapter.pick(mirror,camera,0,0)?.ref.modelId).toBe('a');
    adapter.dispose(); mirror.dispose();
  });
});
