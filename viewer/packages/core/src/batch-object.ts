import { BatchedMesh, BufferAttribute, BufferGeometry, Matrix4, MeshStandardMaterial, Vector4 } from 'three';
import { InstancedGroup } from './instanced-group.js';
import { buildMaterial } from './group-object.js';
import { MIN_VISIBLE_ALPHA } from './instance-alpha.js';
import type { MeshBuffers } from './mesh-buffers.js';

const MAX_INSTANCES = 32768;
type Range = { group: InstancedGroup; start: number; count: number };
type SyncedRange = Range & { offset: number; transforms: number; colors: number; visibility: number; fractional: number };
export type BatchInstance = { group: InstancedGroup; instanceIndex: number };

/** Normalize all geometries to indexed position/normal attributes before batching. */
function geometryFor(mesh: MeshBuffers): BufferGeometry {
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(mesh.positions, 3));
  geometry.setIndex(new BufferAttribute(mesh.indices ?? Uint32Array.from({ length: mesh.positions.length / 3 }, (_, i) => i), 1));
  if (mesh.normals) geometry.setAttribute('normal', new BufferAttribute(mesh.normals, 3));
  else geometry.computeVertexNormals();
  return geometry;
}

/** Owns one material-compatible batch and its stable logical instance mapping. */
export class BatchObject {
  readonly mesh: BatchedMesh;
  readonly material: MeshStandardMaterial;
  readonly instances: readonly BatchInstance[];
  private readonly ranges: SyncedRange[];
  private disposed = false;

  constructor(ranges: readonly Range[]) {
    const resources = new Set(ranges.map(range => range.group.mesh));
    let vertices = 0;
    let indices = 0;
    for (const resource of resources) {
      vertices += resource.positions.length / 3;
      indices += resource.indices?.length ?? resource.positions.length / 3;
    }
    const count = ranges.reduce((sum, range) => sum + range.count, 0);
    this.material = buildMaterial(ranges[0].group.material);
    this.mesh = new BatchedMesh(count, vertices, indices, this.material);
    this.mesh.frustumCulled = false;
    const geometries = new Map<MeshBuffers, number>();
    for (const resource of resources) {
      const geometry = geometryFor(resource);
      geometries.set(resource, this.mesh.addGeometry(geometry));
      geometry.dispose();
    }
    const instances: BatchInstance[] = [];
    this.ranges = ranges.map(range => {
      const offset = instances.length;
      for (let i = 0; i < range.count; i++) {
        this.mesh.addInstance(geometries.get(range.group.mesh)!);
        instances.push({ group: range.group, instanceIndex: range.start + i });
      }
      return { ...range, offset, transforms: -1, colors: -1, visibility: -1, fractional: 0 };
    });
    this.instances = instances;
    this.sync();
  }

  sync(): boolean {
    if (this.disposed) throw new Error('BatchObject is disposed');
    let changed = false;
    let moved = false;
    const matrix = new Matrix4();
    const color = new Vector4();
    for (const range of this.ranges) {
      const group = range.group;
      const transformsChanged = range.transforms !== group.transformsVersion;
      const colorsChanged = range.colors !== group.colorsVersion;
      const visibilityChanged = range.visibility !== group.visibilityVersion;
      if (!transformsChanged && !colorsChanged && !visibilityChanged) continue;
      const transforms = group.transforms;
      const colors = group.colors;
      if (colorsChanged) range.fractional = 0;
      for (let i = 0; i < range.count; i++) {
        const source = range.start + i;
        const id = range.offset + i;
        if (transformsChanged) this.mesh.setMatrixAt(id, matrix.fromArray(transforms, source * 16));
        if (colorsChanged) {
          color.fromArray(colors, source * 4);
          this.mesh.setColorAt(id, color);
          if (color.w >= MIN_VISIBLE_ALPHA && color.w < 1) range.fractional++;
        }
        if (colorsChanged || visibilityChanged)
          this.mesh.setVisibleAt(id, group.visible && colors[source * 4 + 3] * group.material.opacity >= MIN_VISIBLE_ALPHA);
      }
      range.transforms = group.transformsVersion;
      range.colors = group.colorsVersion;
      range.visibility = group.visibilityVersion;
      moved ||= transformsChanged;
      changed = true;
    }
    if (moved) {
      this.mesh.boundingBox = null;
      this.mesh.boundingSphere = null;
    }
    if (changed) this.material.transparent = this.material.opacity < 1 || this.ranges.some(range => range.fractional > 0);
    return changed;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.mesh.dispose();
    this.material.dispose();
  }
}

/** Linear planning, splitting large groups and deduplicating resources inside each batch. */
export function createBatchObjects(groups: readonly InstancedGroup[]): BatchObject[] {
  const bins = new Map<string, { ranges: Range[]; count: number }>();
  const plans: Range[][] = [];
  for (const group of groups) {
    const material = group.material;
    const key = JSON.stringify([material.metalness, material.roughness, material.opacity]);
    let start = 0;
    while (start < group.instanceCount) {
      let bin = bins.get(key);
      if (!bin || bin.count === MAX_INSTANCES) {
        bin = { ranges: [], count: 0 };
        bins.set(key, bin);
        plans.push(bin.ranges);
      }
      const count = Math.min(MAX_INSTANCES - bin.count, group.instanceCount - start);
      bin.ranges.push({ group, start, count });
      bin.count += count;
      start += count;
    }
  }
  return plans.map(ranges => new BatchObject(ranges));
}
