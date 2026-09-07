import { Material, Object3D, Plane, Vector3 } from 'three';
import type { Vec3 } from './contracts.js';

export type SectionPlane = { readonly normal: Vec3; readonly constant: number };
export type Section =
  | { readonly kind: 'planes'; readonly planes: readonly SectionPlane[] }
  | { readonly kind: 'box'; readonly min: Vec3; readonly max: Vec3 };

/** Keep points with nonnegative distance to every plane; a box keeps its interior. */
export function createSectionPlanes(section: Section): Plane[] {
  if (section.kind === 'planes') return section.planes.map(({ normal, constant }) => {
    if (![...normal, constant].every(Number.isFinite) || Math.hypot(...normal) === 0) throw new Error('Invalid section plane');
    return new Plane(new Vector3(...normal), constant).normalize();
  });
  if (![...section.min, ...section.max].every(Number.isFinite) || section.min.some((value, axis) => value > section.max[axis]!))
    throw new Error('Invalid section box');
  return [
    new Plane(new Vector3(1, 0, 0), -section.min[0]), new Plane(new Vector3(-1, 0, 0), section.max[0]),
    new Plane(new Vector3(0, 1, 0), -section.min[1]), new Plane(new Vector3(0, -1, 0), section.max[1]),
    new Plane(new Vector3(0, 0, 1), -section.min[2]), new Plane(new Vector3(0, 0, -1), section.max[2]),
  ];
}

/** Apply to existing mirror materials, including BatchedMesh. Restore before applying another scope. */
export function applyClipping(root: Object3D, planes: readonly Plane[]): () => void {
  const copies = planes.map(plane => plane.clone());
  const previous = new Map<Material, { planes: Plane[] | null; intersection: boolean }>();
  root.traverse(object => {
    const value = (object as Object3D & { material?: Material | Material[] }).material;
    for (const material of value ? Array.isArray(value) ? value : [value] : []) {
      if (previous.has(material)) continue;
      previous.set(material, { planes: material.clippingPlanes, intersection: material.clipIntersection });
      material.clippingPlanes = copies;
      material.clipIntersection = false;
      material.needsUpdate = true;
    }
  });
  return () => {
    for (const [material, state] of previous) {
      material.clippingPlanes = state.planes;
      material.clipIntersection = state.intersection;
      material.needsUpdate = true;
    }
    previous.clear();
  };
}
