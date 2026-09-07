import { type InstancedGroup, type ViewerScene, type SceneObject } from '@ara3d/viewer-core';
import { type Camera, Raycaster, Vector2 } from 'three';
import { objectKey, type ObjectRef, type ObjectRecord, type Result, type Vec3 } from './contracts.js';

export type InstanceBinding = {
  readonly ref: ObjectRef;
  readonly representationId: string;
  readonly group: InstancedGroup;
  readonly instanceIndex: number;
};
export type ObjectHit = { readonly ref: ObjectRef; readonly representationId: string; readonly point: Vec3; readonly distance: number };
const failure = (message: string): Result<number> => ({ ok: false, diagnostics: [{ code: 'invalid-binding', message }] });

/** Owns scene membership, borrows groups. Dispose mirrors/viewer separately to release GPU resources. */
export class RenderBinding {
  private readonly models = new Map<string, readonly InstanceBinding[]>();
  private readonly objects = new Map<string, readonly InstanceBinding[]>();
  private readonly instances = new Map<InstancedGroup, Map<number, InstanceBinding>>();
  private disposed = false;

  constructor(private readonly scene: ViewerScene, private readonly requestRender: () => void) {}

  /** A group belongs to exactly one model and cannot already belong to the supplied scene. */
  addModel(modelId: string, bindings: readonly InstanceBinding[]): Result<number> {
    if (this.disposed || this.models.has(modelId)) return failure('Disposed binding or duplicate model ID');
    const pending = new Map<InstancedGroup, Map<number, InstanceBinding>>();
    for (const binding of bindings) {
      const { group, instanceIndex, ref } = binding;
      if (ref.modelId !== modelId || !Number.isInteger(instanceIndex) || instanceIndex < 0 || instanceIndex >= group.instanceCount)
        return failure('Model mismatch or invalid instance index');
      if (this.scene.groups.includes(group) || this.instances.has(group)) return failure('Group already owned by a scene/model');
      const entries = pending.get(group) ?? new Map<number, InstanceBinding>();
      if (entries.has(instanceIndex)) return failure('Instance has multiple object bindings');
      entries.set(instanceIndex, { ...binding, ref: { ...ref } });
      pending.set(group, entries);
    }
    // Bind every instance: unaddressable geometry cannot participate in snapshot updates or picking.
    for (const [group, entries] of pending) if (entries.size !== group.instanceCount) return failure('Every group instance must be bound');
    const owned = [...pending.values()].flatMap(entries => [...entries.values()]);
    this.models.set(modelId, owned);
    for (const binding of owned) {
      const key = objectKey(binding.ref);
      this.objects.set(key, [...(this.objects.get(key) ?? []), binding]);
    }
    for (const [group, entries] of pending) { this.instances.set(group, entries); this.scene.addGroup(group); }
    this.requestRender();
    return { ok: true, value: owned.length, diagnostics: [] };
  }

  removeModel(modelId: string): boolean {
    const bindings = this.models.get(modelId);
    if (!bindings) return false;
    for (const binding of bindings) this.objects.delete(objectKey(binding.ref));
    for (const group of new Set(bindings.map(binding => binding.group))) {
      this.scene.removeGroup(group);
      this.instances.delete(group);
    }
    this.models.delete(modelId);
    this.requestRender();
    return true;
  }

  /** CPU submission only, one render request. Unknown/geometry-free records are reported, not fabricated. */
  update(records: readonly ObjectRecord[]): Result<number> {
    return this.apply(records, false);
  }

  /** Full effective scene: bound objects absent from records become invisible (e.g. edit tombstones). */
  applySnapshot(records: readonly ObjectRecord[]): Result<number> {
    return this.apply(records, true);
  }

  private apply(records: readonly ObjectRecord[], snapshot: boolean): Result<number> {
    if (this.disposed) return failure('Render binding is disposed');
    const keys = new Set<string>();
    for (const record of records) {
      const { color, opacity } = record.appearance;
      if (keys.has(objectKey(record.ref))) return failure('Duplicate object update');
      keys.add(objectKey(record.ref));
      if (color.length !== 3 || ![...color, opacity].every(n => Number.isFinite(n) && n >= 0 && n <= 1)
        || record.transform.length !== 16 || !record.transform.every(Number.isFinite)) return failure('Invalid appearance or transform');
    }
    const diagnostics = [];
    let updated = 0;
    for (const record of records) {
      const bindings = this.objects.get(objectKey(record.ref));
      if (!bindings) { diagnostics.push({ code: 'unbound-object', message: 'No render representation', ref: record.ref }); continue; }
      for (const { group, instanceIndex } of bindings) {
        const { color, opacity, visible } = record.appearance;
        group.setColor(instanceIndex, ...color, visible ? opacity : 0);
        const offset = instanceIndex * 16;
        const transforms = group.transforms;
        if (record.transform.some((value, i) => value !== transforms[offset + i]))
          group.setTransform(instanceIndex, new Float32Array(record.transform));
        updated++;
      }
    }
    if (snapshot) for (const [key, bindings] of this.objects) if (!keys.has(key)) {
      for (const { group, instanceIndex } of bindings) {
        const color = group.getColor(instanceIndex);
        group.setColor(instanceIndex, color[0] ?? 0, color[1] ?? 0, color[2] ?? 0, 0);
      }
    }
    this.requestRender();
    return { ok: true, value: updated, diagnostics };
  }

  resolveInstance(group: InstancedGroup, instanceIndex: number): InstanceBinding | undefined {
    const binding = this.instances.get(group)?.get(instanceIndex);
    return binding ? { ...binding, ref: { ...binding.ref } } : undefined;
  }

  /** World-space closest visible hit. Ghosted objects remain pickable; alpha-zero objects do not. */
  pick(objects: SceneObject, camera: Camera, x: number, y: number): ObjectHit | undefined {
    if (this.disposed) return undefined;
    objects.sync();
    camera.updateMatrixWorld();
    const ray = new Raycaster();
    ray.setFromCamera(new Vector2(x, y), camera);
    let best: ObjectHit | undefined;
    for (const [group, bindings] of this.instances) {
      if (!group.visible || group.material.opacity <= 0) continue;
      const object = objects.getObject(group);
      const mesh = object?.mesh;
      if (!object || !mesh) continue;
      object.root.updateMatrixWorld(true);
      for (const hit of ray.intersectObject(mesh, false)) {
        if (hit.instanceId === undefined || (group.colors[hit.instanceId * 4 + 3] ?? 0) < 0.001) continue;
        const material = Array.isArray(mesh.material) ? mesh.material[0] : mesh.material;
        const planes = material?.clippingPlanes ?? [];
        const clipped = material?.clipIntersection
          ? planes.length > 0 && planes.every(plane => plane.distanceToPoint(hit.point) < 0)
          : planes.some(plane => plane.distanceToPoint(hit.point) < 0);
        if (clipped) continue;
        const binding = bindings.get(hit.instanceId);
        if (binding && (!best || hit.distance < best.distance)) best = {
          ref: { ...binding.ref }, representationId: binding.representationId,
          point: [hit.point.x, hit.point.y, hit.point.z], distance: hit.distance,
        };
      }
    }
    return best;
  }

  dispose(): void {
    if (this.disposed) return;
    for (const id of this.models.keys()) this.removeModel(id);
    this.disposed = true;
  }
}
