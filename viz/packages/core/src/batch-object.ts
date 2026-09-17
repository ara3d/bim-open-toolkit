import { BatchedMesh, BufferAttribute, BufferGeometry, Group, Matrix4, MeshStandardMaterial, Vector4 } from 'three';
import { InstancedGroup } from './instanced-group.js';
import { buildMaterial } from './group-object.js';
import { MIN_VISIBLE_ALPHA } from './instance-alpha.js';
import type { MeshBuffers } from './mesh-buffers.js';
import { PackedGeometry } from './packed-geometry.js';

const MAX_INSTANCES = 32768;
const MAX_PACKED_VERTICES = 262144;
const SMALL_MESH_VERTICES = 100;
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
  readonly root = new Group();
  readonly mesh: BatchedMesh;
  readonly material: MeshStandardMaterial;
  readonly instances: readonly BatchInstance[];
  private readonly ranges: SyncedRange[];
  private disposed = false;
  private readonly packed?: PackedGeometry;

  constructor(ranges: readonly Range[], packedGeometry = true) {
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
    const normals = new Map<MeshBuffers, ArrayLike<number>>();
    for (const resource of resources) {
      const geometry = geometryFor(resource);
      normals.set(resource, geometry.getAttribute('normal').array);
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
    this.root.add(this.mesh);
    if (packedGeometry && ranges.every(range => range.group.mesh.positions.length / 3 <= SMALL_MESH_VERTICES)
      && ranges.reduce((sum, range) => sum + range.group.mesh.positions.length / 3 * range.count, 0) <= MAX_PACKED_VERTICES) {
      this.material.vertexColors = true;
      this.material.alphaTest = MIN_VISIBLE_ALPHA;
      // Both paths share clipping/material state. The fallback's tint comes from
      // its instance texture, so its vertex color must remain neutral.
      this.mesh.geometry.setAttribute('color', new BufferAttribute(new Uint8Array(vertices * 3).fill(255), 3, true));
      this.packed = new PackedGeometry(this.ranges, this.material, normals);
      this.root.add(this.packed.mesh);
    }
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
      const transforms = transformsChanged ? group.transforms : undefined;
      const colors = colorsChanged || visibilityChanged ? group.colors : undefined;
      if (colorsChanged) range.fractional = 0;
      for (let i = 0; i < range.count; i++) {
        const source = range.start + i;
        const id = range.offset + i;
        if (transformsChanged) this.mesh.setMatrixAt(id, matrix.fromArray(transforms!, source * 16));
        if (colorsChanged) {
          color.fromArray(colors!, source * 4);
          this.mesh.setColorAt(id, color);
          if (color.w >= MIN_VISIBLE_ALPHA && color.w < 1) range.fractional++;
        }
        if (colorsChanged || visibilityChanged)
          this.mesh.setVisibleAt(id, group.visible && colors![source * 4 + 3] * group.material.opacity >= MIN_VISIBLE_ALPHA);
      }
      range.transforms = group.transformsVersion;
      range.colors = group.colorsVersion;
      range.visibility = group.visibilityVersion;
      this.packed?.sync(range, transforms, colors);
      moved ||= transformsChanged;
      changed = true;
    }
    if (moved) {
      this.mesh.boundingBox = null;
      this.mesh.boundingSphere = null;
    }
    if (changed) {
      const transparent = this.material.opacity < 1 || this.ranges.some(range => range.fractional > 0);
      if (this.material.transparent !== transparent) {
        this.material.transparent = transparent;
        this.material.needsUpdate = true;
      }
      if (this.packed) {
        this.packed.mesh.visible = !this.material.transparent;
        this.mesh.visible = this.material.transparent;
        this.packed.finishSync();
      }
    }
    return changed;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.mesh.dispose();
    this.packed?.dispose();
    this.material.dispose();
  }
}

/** Linear planning, splitting large groups and deduplicating resources inside each batch. */
export function createBatchObjects(groups: readonly InstancedGroup[], packedGeometry = true): BatchObject[] {
  const bins = new Map<string, { ranges: Range[]; count: number; vertices: number }>();
  const plans: Range[][] = [];
  for (const group of groups) {
    const material = group.material;
    const vertices = group.mesh.positions.length / 3;
    const small = packedGeometry && vertices <= SMALL_MESH_VERTICES;
    const colors = group.colors;
    const fractional = material.opacity < 1 || colors.some((alpha, index) => index % 4 === 3 && alpha >= MIN_VISIBLE_ALPHA && alpha < 1);
    const key = JSON.stringify([material.metalness, material.roughness, material.opacity, small, fractional]);
    let start = 0;
    while (start < group.instanceCount) {
      let bin = bins.get(key);
      if (!bin || bin.count === MAX_INSTANCES || (small && bin.vertices + vertices > MAX_PACKED_VERTICES)) {
        bin = { ranges: [], count: 0, vertices: 0 };
        bins.set(key, bin);
        plans.push(bin.ranges);
      }
      const count = Math.min(MAX_INSTANCES - bin.count, group.instanceCount - start, small && vertices ? Math.floor((MAX_PACKED_VERTICES-bin.vertices)/vertices) : Infinity);
      bin.ranges.push({ group, start, count });
      bin.count += count;
      bin.vertices += vertices * count;
      start += count;
    }
  }
  return plans.map(ranges => new BatchObject(ranges, packedGeometry));
}
