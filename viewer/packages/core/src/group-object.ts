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
import {
  INSTANCE_ALPHA_ATTRIBUTE,
  MIN_VISIBLE_ALPHA,
  patchMaterialForInstanceAlpha,
} from './instance-alpha.js';

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
    patchMaterialForInstanceAlpha(this.material);
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
      const alphaAttr = this.geometry.getAttribute(INSTANCE_ALPHA_ATTRIBUTE) as InstancedBufferAttribute;
      this.copyAlphas(alphaAttr.array as Float32Array);
      alphaAttr.needsUpdate = true;
      this.updateTransparency();
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
    this.geometry.setAttribute(INSTANCE_ALPHA_ATTRIBUTE,
      new InstancedBufferAttribute(new Float32Array(this.allocated), 1));
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

  // three's instanceColor is RGB-only; alpha travels in a separate
  // 'instanceAlpha' instanced attribute (see instance-alpha.ts).
  private copyColors(target: Float32Array): void {
    const src = this.group.colors;
    const n = this.group.instanceCount;
    for (let i = 0; i < n; i++) {
      target[i * 3] = src[i * COLOR_STRIDE];
      target[i * 3 + 1] = src[i * COLOR_STRIDE + 1];
      target[i * 3 + 2] = src[i * COLOR_STRIDE + 2];
    }
  }

  private copyAlphas(target: Float32Array): void {
    const src = this.group.colors;
    const n = this.group.instanceCount;
    for (let i = 0; i < n; i++)
      target[i] = src[i * COLOR_STRIDE + 3];
  }

  // Fractional alphas need transparent=true. depthWrite stays true — cheaper
  // and stable, at the cost of blend-order artifacts between faded instances.
  // Alpha-0 instances are handled by the shader's discard, so all-0/1 alphas
  // keep the material opaque (unless the config's own opacity < 1).
  private updateTransparency(): void {
    const src = this.group.colors;
    const n = this.group.instanceCount;
    let fractional = false;
    for (let i = 0; i < n; i++) {
      const a = src[i * COLOR_STRIDE + 3];
      if (a >= MIN_VISIBLE_ALPHA && a < 1) { fractional = true; break; }
    }
    this.material.transparent = this.group.material.opacity < 1 || fractional;
  }
}
