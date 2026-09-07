import { MIN_VISIBLE_ALPHA, validateMeshBuffers, type Bounds3, type MeshBuffers, type SceneObject } from '@ara3d/viewer-core';
import { Box3, BoxGeometry, BufferAttribute, BufferGeometry, Color, Group, Mesh, MeshStandardMaterial, type Raycaster } from 'three';
import { objectKey, type Matrix4, type ObjectRecord, type ObjectRef } from './contracts.js';
import { type ObjectHit, RenderBinding } from './render.js';

type Entry = { original: ObjectRecord; mesh: Mesh<BufferGeometry, MeshStandardMaterial> };

/** World-coordinate box geometry; use an identity replacement world matrix. */
export function boxReplacementMesh(bounds: Bounds3): MeshBuffers {
  if (![...bounds.min, ...bounds.max].every(Number.isFinite) || bounds.min.some((value, i) => value > bounds.max[i]!)) throw new Error('Box bounds must be finite and ordered');
  const geometry = new BoxGeometry(bounds.max[0] - bounds.min[0], bounds.max[1] - bounds.min[1], bounds.max[2] - bounds.min[2]);
  geometry.translate((bounds.min[0] + bounds.max[0]) / 2, (bounds.min[1] + bounds.max[1]) / 2, (bounds.min[2] + bounds.max[2]) / 2);
  const mesh = { positions: new Float32Array(geometry.getAttribute('position').array), normals: new Float32Array(geometry.getAttribute('normal').array), indices: new Uint32Array(geometry.index!.array) };
  geometry.dispose();
  return mesh;
}

/** Owns overlay meshes while borrowing source records; source scene membership never changes. */
export class ReplacementLayer {
  readonly root = new Group();
  private readonly entries = new Map<string, Entry>();
  private readonly stopPicking: () => void;
  private disposed = false;

  constructor(private readonly scene: SceneObject, private readonly render: RenderBinding, private readonly requestRender: () => void) {
    this.stopPicking = render.addPickSource(ray => this.raycast(ray));
    scene.scene.add(this.root);
  }

  replace(original: ObjectRecord, supplied: MeshBuffers, worldTransform: Matrix4 = original.transform): void {
    if (this.disposed) throw new Error('Replacement layer is disposed');
    validateMeshBuffers(supplied);
    if (!worldTransform.every(Number.isFinite) || worldTransform.length !== 16 || !supplied.positions.every(Number.isFinite) || (supplied.normals && !supplied.normals.every(Number.isFinite))) throw new Error('Replacement geometry and matrix must be finite');
    const geometry = new BufferGeometry();
    geometry.setAttribute('position', new BufferAttribute(supplied.positions.slice(), 3));
    if (supplied.indices) geometry.setIndex(new BufferAttribute(supplied.indices.slice(), 1));
    if (supplied.normals) geometry.setAttribute('normal', new BufferAttribute(supplied.normals.slice(), 3));
    else geometry.computeVertexNormals();
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    const material = new MeshStandardMaterial({ color: new Color(...original.appearance.color), opacity: original.appearance.opacity, transparent: original.appearance.opacity < 1, alphaTest: MIN_VISIBLE_ALPHA });
    const mesh = new Mesh(geometry, material);
    mesh.matrixAutoUpdate = false; mesh.matrix.fromArray(worldTransform);
    mesh.visible = original.appearance.visible && original.appearance.opacity >= MIN_VISIBLE_ALPHA;
    const hidden = { ...original, appearance: { ...original.appearance, visible: false } };
    const result = this.render.update([hidden]);
    if (!result.ok || result.diagnostics.length) { geometry.dispose(); material.dispose(); throw new Error(result.diagnostics.map(item => item.message).join('; ')); }
    const key = objectKey(original.ref);
    const previous = this.entries.get(key);
    if (previous && !previous.original.appearance.visible) mesh.visible = false;
    if (previous) this.release(previous);
    this.entries.set(key, { original: previous?.original ?? structuredClone(original), mesh });
    this.root.add(mesh);
    this.requestRender();
  }

  setVisible(ref: ObjectRef, visible: boolean): void {
    const entry = this.entries.get(objectKey(ref));
    if (!entry) return;
    entry.mesh.visible = visible && entry.original.appearance.visible && entry.original.appearance.opacity >= MIN_VISIBLE_ALPHA;
    this.requestRender();
  }

  bounds(ref: ObjectRef): Bounds3 | undefined {
    const entry = this.entries.get(objectKey(ref));
    if (!entry) return undefined;
    this.root.updateWorldMatrix(true, true);
    const box = new Box3().setFromObject(entry.mesh);
    if (box.isEmpty()) return undefined;
    return { min: [box.min.x, box.min.y, box.min.z], max: [box.max.x, box.max.y, box.max.z] };
  }

  raycast(ray: Raycaster): readonly ObjectHit[] {
    if (this.disposed || !this.root.visible || !this.scene.scene.visible) return [];
    this.root.updateWorldMatrix(true, true);
    const hits: ObjectHit[] = [];
    for (const entry of this.entries.values()) {
      const { mesh, original } = entry;
      if (!mesh.visible || mesh.material.opacity < MIN_VISIBLE_ALPHA) continue;
      for (const hit of ray.intersectObject(mesh, false)) {
        const planes = mesh.material.clippingPlanes ?? [];
        const clipped = planes.length > 0 && (mesh.material.clipIntersection ? planes.every(plane => plane.distanceToPoint(hit.point) < 0) : planes.some(plane => plane.distanceToPoint(hit.point) < 0));
        if (!clipped) hits.push({ ref: original.ref, representationId: 'replacement', point: [hit.point.x, hit.point.y, hit.point.z], distance: hit.distance });
      }
    }
    return hits.sort((a, b) => a.distance - b.distance);
  }

  undo(ref: ObjectRef): boolean {
    const key = objectKey(ref), entry = this.entries.get(key);
    if (!entry) return false;
    this.release(entry); this.entries.delete(key);
    this.render.update([entry.original]); this.requestRender();
    return true;
  }

  reset(): void { for (const entry of [...this.entries.values()]) this.undo(entry.original.ref); }

  dispose(): void {
    if (this.disposed) return;
    this.reset(); this.stopPicking(); this.scene.scene.remove(this.root); this.disposed = true;
  }

  private release(entry: Entry): void {
    this.root.remove(entry.mesh); entry.mesh.geometry.dispose(); entry.mesh.material.dispose();
  }
}
