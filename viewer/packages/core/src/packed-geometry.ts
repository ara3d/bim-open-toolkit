import { BufferAttribute, BufferGeometry, Matrix3, Matrix4, Mesh, type MeshStandardMaterial, Vector3 } from 'three';
import { buildGeometry } from './group-object.js';
import type { InstancedGroup } from './instanced-group.js';
import type { MeshBuffers } from './mesh-buffers.js';

export type PackedRange = { group: InstancedGroup; start: number; count: number };

/** A bounded, opaque draw with baked vertices. Source groups remain authoritative. */
export class PackedGeometry {
  readonly mesh: Mesh<BufferGeometry, MeshStandardMaterial>;
  private readonly offsets = new Map<PackedRange, number>();
  private readonly normals = new Map<MeshBuffers, ArrayLike<number>>();
  private readonly positions: BufferAttribute;
  private readonly normal: BufferAttribute;
  private readonly colors: BufferAttribute;
  private readonly matrix = new Matrix4();
  private readonly normalMatrix = new Matrix3();
  private readonly vector = new Vector3();
  private initialized = false;

  constructor(ranges: readonly PackedRange[], material: MeshStandardMaterial) {
    let vertices = 0, indices = 0;
    for (const range of ranges) {
      this.offsets.set(range, vertices);
      vertices += range.group.mesh.positions.length / 3 * range.count;
      indices += (range.group.mesh.indices?.length ?? range.group.mesh.positions.length / 3) * range.count;
    }
    this.positions = new BufferAttribute(new Float32Array(vertices * 3), 3);
    this.normal = new BufferAttribute(new Float32Array(vertices * 3), 3);
    this.colors = new BufferAttribute(new Float32Array(vertices * 4), 4);
    const index = new Uint32Array(indices);
    let cursor = 0;
    for (const range of ranges) {
      const source = range.group.mesh;
      if (!this.normals.has(source)) {
        const geometry = buildGeometry(source);
        this.normals.set(source, geometry.getAttribute('normal').array);
        geometry.dispose();
      }
      const count = source.positions.length / 3;
      for (let i = 0; i < range.count; i++) {
        const offset = this.offsets.get(range)! + i * count;
        for (let j = 0; j < (source.indices?.length ?? count); j++) index[cursor++] = offset + (source.indices?.[j] ?? j);
      }
    }
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', this.positions);
    geometry.setAttribute('normal', this.normal);
    geometry.setAttribute('color', this.colors);
    geometry.setIndex(new BufferAttribute(index, 1));
    this.mesh = new Mesh(geometry, material);
    // Vertex clipping still applies; avoid rebuilding aggregate bounds after edits.
    this.mesh.frustumCulled = false;
  }

  sync(range: PackedRange, transforms?: Float32Array, colors?: Float32Array): void {
    const group = range.group;
    const source = group.mesh;
    const vertices = source.positions.length / 3;
    const offset = this.offsets.get(range)!;
    const normals = this.normals.get(source)!;
    for (let i = 0; i < range.count; i++) {
      const instance = range.start + i;
      if (transforms) {
        this.matrix.fromArray(transforms!, instance * 16);
        this.normalMatrix.getNormalMatrix(this.matrix);
      }
      for (let v = 0; v < vertices; v++) {
        const target = offset + i * vertices + v;
        if (transforms) {
          this.vector.fromArray(source.positions, v * 3).applyMatrix4(this.matrix);
          this.positions.setXYZ(target, this.vector.x, this.vector.y, this.vector.z);
          this.vector.fromArray(normals, v * 3).applyMatrix3(this.normalMatrix).normalize();
          this.normal.setXYZ(target, this.vector.x, this.vector.y, this.vector.z);
        }
        if (colors) this.colors.setXYZW(target, colors[instance*4], colors[instance*4+1], colors[instance*4+2], group.visible ? colors[instance*4+3] : 0);
      }
    }
    for (const attribute of transforms ? [this.positions, this.normal] : []) this.changed(attribute, offset, vertices * range.count);
    if (colors) this.changed(this.colors, offset, vertices * range.count);
  }

  finishSync(): void { this.initialized = true; }

  dispose(): void { this.mesh.geometry.dispose(); this.normals.clear(); this.offsets.clear(); }

  private changed(attribute: BufferAttribute, start: number, count: number): void {
    if (this.initialized) attribute.addUpdateRange(start * attribute.itemSize, count * attribute.itemSize);
    attribute.needsUpdate = true;
  }
}
