import {
  BufferGeometry,
  BufferAttribute,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  MeshStandardMaterial,
} from 'three';
import { InstancedGroup, COLOR_STRIDE } from './instanced-group.js';
import { MeshBuffers } from './mesh-buffers.js';
import { MaterialConfig } from './material.js';

export function buildGeometry(mesh: MeshBuffers): BufferGeometry {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(mesh.positions, 3));
  if (mesh.normals) g.setAttribute('normal', new BufferAttribute(mesh.normals, 3));
  else g.computeVertexNormals();
  if (mesh.indices) g.setIndex(new BufferAttribute(mesh.indices, 1));
  return g;
}

export function buildMaterial(config: MaterialConfig): MeshStandardMaterial {
  return new MeshStandardMaterial({
    metalness: config.metalness,
    roughness: config.roughness,
    opacity: config.opacity,
    transparent: config.opacity < 1,
  });
}

/**
 * Mirrors one InstancedGroup into a three.js InstancedMesh, syncing lazily
 * via the group's version counters. Pure three.js object-graph code — no GL
 * context needed, so it is unit-testable under Node.
 *
 * `root` is a stable THREE.Group; the InstancedMesh under it is replaced when
 * the group outgrows the allocated instance capacity.
 */
export class GroupObject {
  readonly group: InstancedGroup;
  readonly root = new Group();

  private geometry: BufferGeometry;
  private material: MeshStandardMaterial;
  private _mesh: InstancedMesh | null = null;
  private allocated = 0;
  private syncedCountVersion = -1;
  private syncedTransformsVersion = -1;
  private syncedColorsVersion = -1;
  private disposed = false;

  constructor(group: InstancedGroup) {
    this.group = group;
    this.geometry = buildGeometry(group.mesh);
    this.material = buildMaterial(group.material);
    this.root.matrixAutoUpdate = false;
  }

  /** The current InstancedMesh (null before the first sync). */
  get mesh(): InstancedMesh | null { return this._mesh; }

  /** Brings the three.js objects up to date with the group. Returns true if anything changed. */
  sync(): boolean {
    if (this.disposed) throw new Error('GroupObject is disposed');
    const g = this.group;
    let changed = false;

    if (!this._mesh || g.instanceCount > this.allocated) {
      this.rebuildMesh();
      changed = true;
    }
    const mesh = this._mesh!;

    if (this.syncedCountVersion !== g.countVersion) {
      mesh.count = g.instanceCount;
      this.syncedCountVersion = g.countVersion;
      changed = true;
    }
    if (this.syncedTransformsVersion !== g.transformsVersion) {
      (mesh.instanceMatrix.array as Float32Array).set(g.transforms);
      mesh.instanceMatrix.needsUpdate = true;
      this.syncedTransformsVersion = g.transformsVersion;
      changed = true;
    }
    if (this.syncedColorsVersion !== g.colorsVersion) {
      this.copyColors(mesh.instanceColor!.array as Float32Array);
      mesh.instanceColor!.needsUpdate = true;
      this.syncedColorsVersion = g.colorsVersion;
      changed = true;
    }
    if (this.root.visible !== g.visible) {
      this.root.visible = g.visible;
      changed = true;
    }
    return changed;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.removeMesh();
    this.geometry.dispose();
    this.material.dispose();
  }

  private rebuildMesh(): void {
    this.removeMesh();
    this.allocated = Math.max(this.group.capacity, this.group.instanceCount);
    const mesh = new InstancedMesh(this.geometry, this.material, this.allocated);
    mesh.instanceColor = new InstancedBufferAttribute(
      new Float32Array(this.allocated * 3), 3);
    mesh.count = 0;
    mesh.frustumCulled = false;
    this._mesh = mesh;
    this.syncedCountVersion = -1;
    this.syncedTransformsVersion = -1;
    this.syncedColorsVersion = -1;
    this.root.add(mesh);
  }

  private removeMesh(): void {
    if (!this._mesh) return;
    this.root.remove(this._mesh);
    this._mesh.dispose(); // releases instanceMatrix/instanceColor GPU buffers; geometry/material are owned by this GroupObject
    this._mesh = null;
  }

  // TODO: per-instance alpha — three's instanceColor is RGB-only; supporting the
  // alpha channel needs a custom shader chunk or a second instanced attribute.
  private copyColors(target: Float32Array): void {
    const src = this.group.colors;
    const n = this.group.instanceCount;
    for (let i = 0; i < n; i++) {
      target[i * 3] = src[i * COLOR_STRIDE];
      target[i * 3 + 1] = src[i * COLOR_STRIDE + 1];
      target[i * 3 + 2] = src[i * COLOR_STRIDE + 2];
    }
  }
}
