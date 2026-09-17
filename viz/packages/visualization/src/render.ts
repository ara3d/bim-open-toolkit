import { type InstancedGroup, type ViewerScene, type SceneObject } from '@ara3d/viewer-core';
import { type Camera, Matrix4 as ThreeMatrix4, Raycaster, Vector2 } from 'three';
import { identityMatrix, objectKey, type Matrix4, type ObjectRef, type ObjectRecord, type Result, type Vec3 } from './contracts.js';

export type InstanceBinding = {
  readonly ref: ObjectRef;
  readonly representationId: string;
  readonly group: InstancedGroup;
  readonly instanceIndex: number;
  readonly localTransform?: Matrix4;
  readonly colorFactor?: readonly [number, number, number, number];
};
export type ObjectHit = { readonly ref: ObjectRef; readonly representationId: string; readonly point: Vec3; readonly distance: number };
const failure = (message: string): Result<number> => ({ ok: false, diagnostics: [{ code: 'invalid-binding', message }] });
const whiteFactor = [1,1,1,1] as const;

function sameTransform(stored: Float32Array, offset: number, matrix: ArrayLike<number>): boolean {
  for (let i = 0; i < 16; i++) if (Math.fround(matrix[i]!) !== stored[offset + i]) return false;
  return true;
}

/** Owns scene membership, borrows groups. Dispose mirrors/viewer separately to release GPU resources. */
export class RenderBinding {
  private readonly pickSources = new Set<(ray: Raycaster) => readonly ObjectHit[]>();
  private readonly models = new Map<string, readonly InstanceBinding[]>();
  private readonly objects = new Map<string, InstanceBinding[]>();
  private readonly instances = new Map<InstancedGroup, Map<number, InstanceBinding>>();
  private disposed = false;

  constructor(private readonly scene: ViewerScene, private readonly requestRender: () => void) {}

  /** A group belongs to exactly one model and cannot already belong to the supplied scene. */
  addModel(modelId: string, bindings: readonly InstanceBinding[]): Result<number> {
    if (this.disposed || this.models.has(modelId)) return failure('Disposed binding or duplicate model ID');
    const pending = new Map<InstancedGroup, Map<number, InstanceBinding>>();
    const existingGroups = new Set(this.scene.groups);
    for (const binding of bindings) {
      const { group, instanceIndex, ref } = binding;
      if (ref.modelId !== modelId || !Number.isInteger(instanceIndex) || instanceIndex < 0 || instanceIndex >= group.instanceCount)
        return failure('Model mismatch or invalid instance index');
      if (binding.localTransform && (binding.localTransform.length !== 16 || !binding.localTransform.every(Number.isFinite)))
        return failure('Invalid representation transform');
      if (binding.colorFactor && (binding.colorFactor.length !== 4 || !binding.colorFactor.every(n => Number.isFinite(n) && n >= 0 && n <= 1)))
        return failure('Invalid representation color');
      if (existingGroups.has(group) || this.instances.has(group)) return failure('Group already owned by a scene/model');
      const entries = pending.get(group) ?? new Map<number, InstanceBinding>();
      if (entries.has(instanceIndex)) return failure('Instance has multiple object bindings');
      entries.set(instanceIndex, Object.freeze({ ...binding, ref: Object.freeze({ ...ref }),
        ...(binding.localTransform ? { localTransform: Object.freeze([...binding.localTransform]) as Matrix4 } : {}),
        ...(binding.colorFactor ? { colorFactor: Object.freeze([...binding.colorFactor]) as readonly [number, number, number, number] } : {}),
      }));
      pending.set(group, entries);
    }
    // Bind every instance: unaddressable geometry cannot participate in snapshot updates or picking.
    for (const [group, entries] of pending) if (entries.size !== group.instanceCount) return failure('Every group instance must be bound');
    const owned = [...pending.values()].flatMap(entries => [...entries.values()]);
    this.models.set(modelId, owned);
    for (const binding of owned) {
      const key = objectKey(binding.ref);
      const entries = this.objects.get(key) ?? [];
      entries.push(binding);
      this.objects.set(key, entries);
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
    const objectMatrix = new ThreeMatrix4(), localMatrix = new ThreeMatrix4(), combined = new ThreeMatrix4();
    const views = new Map<InstancedGroup, { transforms: Float32Array; colors: Float32Array }>();
    let updated = 0;
    for (const record of records) {
      const bindings = this.objects.get(objectKey(record.ref));
      if (!bindings) { diagnostics.push({ code: 'unbound-object', message: 'No render representation', ref: record.ref }); continue; }
      const identity = record.transform.every((value,i) => value === identityMatrix[i]);
      if (!identity) objectMatrix.fromArray(record.transform);
      for (const { group, instanceIndex, localTransform, colorFactor } of bindings) {
        let buffers = views.get(group);
        if (!buffers) { buffers = { transforms: group.transforms, colors: group.colors }; views.set(group, buffers); }
        const { color, opacity, visible } = record.appearance;
        const factor = colorFactor ?? whiteFactor;
        const r = color[0] * factor[0], g = color[1] * factor[1], b = color[2] * factor[2], a = visible ? opacity * factor[3] : 0;
        const colorOffset = instanceIndex * 4;
        if (buffers.colors[colorOffset] !== Math.fround(r) || buffers.colors[colorOffset+1] !== Math.fround(g) || buffers.colors[colorOffset+2] !== Math.fround(b) || buffers.colors[colorOffset+3] !== Math.fround(a))
          group.setColor(instanceIndex, r,g,b,a);
        const transform = localTransform ? identity ? localTransform : combined.multiplyMatrices(objectMatrix, localMatrix.fromArray(localTransform)).elements : record.transform;
        const offset = instanceIndex * 16;
        if (!sameTransform(buffers.transforms, offset, transform))
          group.setTransform(instanceIndex, new Float32Array(transform));
        updated++;
      }
    }
    if (snapshot) for (const [key, bindings] of this.objects) if (!keys.has(key)) {
      for (const { group, instanceIndex } of bindings) {
        const colors = group.colors, offset = instanceIndex * 4;
        if (colors[offset+3] !== 0) group.setColor(instanceIndex, colors[offset] ?? 0, colors[offset+1] ?? 0, colors[offset+2] ?? 0, 0);
      }
    }
    this.requestRender();
    return { ok: true, value: updated, diagnostics };
  }

  resolveInstance(group: InstancedGroup, instanceIndex: number): InstanceBinding | undefined {
    const binding = this.instances.get(group)?.get(instanceIndex);
    return binding ? { ...binding, ref: { ...binding.ref } } : undefined;
  }

  /** Host pick providers own visibility/clipping checks; only loaded references are accepted. */
  addPickSource(source: (ray: Raycaster) => readonly ObjectHit[]): () => void {
    if (this.disposed) throw new Error('Render binding is disposed');
    this.pickSources.add(source);
    return () => { this.pickSources.delete(source); };
  }

  /** World-space closest visible hit. Ghosted objects remain pickable; alpha-zero objects do not. */
  pick(objects: SceneObject, camera: Camera, x: number, y: number): ObjectHit | undefined {
    if (this.disposed) return undefined;
    objects.sync();
    camera.updateMatrixWorld();
    const ray = new Raycaster();
    ray.setFromCamera(new Vector2(x, y), camera);
    let nearest: ObjectHit | undefined;
    for (const hit of objects.raycast(ray)) {
      const binding = this.instances.get(hit.group)?.get(hit.instanceIndex);
      if (binding) { nearest = {
        ref: { ...binding.ref }, representationId: binding.representationId,
        point: [hit.point.x, hit.point.y, hit.point.z], distance: hit.distance,
      }; break; }
    }
    for (const source of this.pickSources) for (const hit of source(ray)) {
      if (this.objects.has(objectKey(hit.ref)) && Number.isFinite(hit.distance) && hit.distance >= ray.near && hit.distance <= ray.far && (!nearest || hit.distance < nearest.distance)) nearest = hit;
    }
    return nearest;
  }

  dispose(): void {
    if (this.disposed) return;
    for (const id of this.models.keys()) this.removeModel(id);
    this.disposed = true;
    this.pickSources.clear();
  }
}
