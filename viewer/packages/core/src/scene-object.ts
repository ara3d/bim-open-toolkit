import { Scene, type Material, type Raycaster, type Vector3 } from 'three';
import { ViewerScene } from './scene.js';
import { InstancedGroup } from './instanced-group.js';
import { GroupObject } from './group-object.js';
import { BatchObject, createBatchObjects } from './batch-object.js';
import { MIN_VISIBLE_ALPHA } from './instance-alpha.js';

export type SceneHit = { group: InstancedGroup; instanceIndex: number; point: Vector3; distance: number };

function isClipped(point: Vector3, material: Material): boolean {
  const planes = material.clippingPlanes;
  if (!planes?.length) return false;
  return material.clipIntersection ? planes.every(plane => plane.distanceToPoint(point) < 0) : planes.some(plane => plane.distanceToPoint(point) < 0);
}

/**
 * Mirrors a ViewerScene into a THREE.Scene: sync() diffs the model's groups
 * against the mirrored GroupObjects, creating/removing/updating as needed.
 * Pure object-graph code, unit-testable under Node.
 */
export class SceneObject {
  readonly model: ViewerScene;
  readonly scene = new Scene();

  private objects = new Map<InstancedGroup, GroupObject>();
  private disposed = false;
  private batches: BatchObject[] = [];
  private batchMembers = new Map<InstancedGroup, number>();
  private batched = false;

  constructor(model: ViewerScene, private readonly batchThreshold = 1000) {
    this.model = model;
  }

  /** GroupObject on the small-scene path; undefined before sync or when batched. */
  getObject(group: InstancedGroup): GroupObject | undefined {
    return this.objects.get(group);
  }

  get objectCount(): number { return this.batched ? this.batchMembers.size : this.objects.size; }

  /** Brings the THREE.Scene up to date with the model. Returns true if anything changed. */
  sync(): boolean {
    if (this.disposed) throw new Error('SceneObject is disposed');
    const groups = this.model.groups;
    const useBatches = groups.length > this.batchThreshold;
    let changed = false;

    if (useBatches !== this.batched) {
      this.clearMirrors();
      this.batched = useBatches;
      changed = true;
    }
    if (useBatches) {
      if (groups.length !== this.batchMembers.size || groups.some(group => this.batchMembers.get(group) !== group.countVersion)) {
        this.clearMirrors();
        this.batches = createBatchObjects(groups);
        for (const batch of this.batches) this.scene.add(batch.mesh);
        this.batchMembers = new Map(groups.map(group => [group, group.countVersion]));
        return true;
      }
      for (const batch of this.batches) if (batch.sync()) changed = true;
      return changed;
    }

    const members = new Set(groups);
    for (const [group, obj] of this.objects) {
      if (!members.has(group)) {
        this.scene.remove(obj.root);
        obj.dispose();
        this.objects.delete(group);
        changed = true;
      }
    }
    for (const group of groups) {
      let obj = this.objects.get(group);
      if (!obj) {
        obj = new GroupObject(group);
        this.objects.set(group, obj);
        this.scene.add(obj.root);
        changed = true;
      }
      if (obj.sync()) {
        if (obj.mesh) {
          obj.mesh.boundingBox = null;
          obj.mesh.boundingSphere = null;
        }
        changed = true;
      }
    }
    return changed;
  }

  /** Identity-preserving intersections for either mirror path, nearest first. */
  raycast(raycaster: Raycaster): SceneHit[] {
    this.sync();
    this.scene.updateMatrixWorld(true);
    if (!this.scene.visible) return [];
    const result: SceneHit[] = [];
    const append = (group: InstancedGroup, instanceIndex: number, point: Vector3, distance: number, material: Material) => {
      if (group.visible && group.colors[instanceIndex * 4 + 3] * group.material.opacity >= MIN_VISIBLE_ALPHA && !isClipped(point, material))
        result.push({ group, instanceIndex, point, distance });
    };
    for (const batch of this.batches) {
      if (!batch.mesh.visible) continue;
      for (const hit of raycaster.intersectObject(batch.mesh, false)) {
        if (hit.batchId === undefined) continue;
        const instance = batch.instances[hit.batchId];
        if (instance) append(instance.group, instance.instanceIndex, hit.point, hit.distance, batch.material);
      }
    }
    for (const [group, object] of this.objects) {
      const mesh = object.mesh;
      if (!object.root.visible || !mesh?.visible) continue;
      for (const hit of raycaster.intersectObject(mesh, false)) {
        if (hit.instanceId !== undefined) append(group, hit.instanceId, hit.point, hit.distance, mesh.material as Material);
      }
    }
    return result.sort((a, b) => a.distance - b.distance);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clearMirrors();
  }

  private clearMirrors(): void {
    for (const obj of this.objects.values()) {
      this.scene.remove(obj.root);
      obj.dispose();
    }
    this.objects.clear();
    for (const batch of this.batches) {
      this.scene.remove(batch.mesh);
      batch.dispose();
    }
    this.batches = [];
    this.batchMembers.clear();
  }
}
