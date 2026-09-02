import { MeshBuffers } from './mesh-buffers.js';
import { InstancedGroup, TRANSFORM_STRIDE } from './instanced-group.js';
import { ViewerScene } from './scene.js';

/** An axis-aligned bounding box as [x, y, z] min/max corners. */
export interface Bounds3 {
  readonly min: readonly [number, number, number];
  readonly max: readonly [number, number, number];
}

/** Smallest box containing both, or the non-null one, or null. */
export const unionBounds = (a: Bounds3 | null, b: Bounds3 | null): Bounds3 | null =>
  !a ? b : !b ? a : {
    min: [Math.min(a.min[0], b.min[0]), Math.min(a.min[1], b.min[1]), Math.min(a.min[2], b.min[2])],
    max: [Math.max(a.max[0], b.max[0]), Math.max(a.max[1], b.max[1]), Math.max(a.max[2], b.max[2])],
  };

/** Bounds of a mesh's vertex positions, or null for an empty mesh. */
export function meshBounds(mesh: MeshBuffers): Bounds3 | null {
  const p = mesh.positions;
  if (p.length < 3) return null;
  const min: [number, number, number] = [p[0], p[1], p[2]];
  const max: [number, number, number] = [p[0], p[1], p[2]];
  for (let i = 3; i < p.length; i += 3)
    for (let axis = 0; axis < 3; axis++) {
      const v = p[i + axis];
      if (v < min[axis]) min[axis] = v;
      if (v > max[axis]) max[axis] = v;
    }
  return { min, max };
}

/**
 * `local` transformed by a column-major 4x4 affine matrix, without visiting
 * corners: per output axis, the translation plus the per-input-axis min/max
 * contributions.
 */
export function transformBounds(local: Bounds3, matrix: ArrayLike<number>): Bounds3 {
  const min: [number, number, number] = [matrix[12], matrix[13], matrix[14]];
  const max: [number, number, number] = [matrix[12], matrix[13], matrix[14]];
  for (let axis = 0; axis < 3; axis++)
    for (let j = 0; j < 3; j++) {
      const m = matrix[j * 4 + axis];
      const a = m * local.min[j];
      const b = m * local.max[j];
      min[axis] += Math.min(a, b);
      max[axis] += Math.max(a, b);
    }
  return { min, max };
}

/** World bounds of all instances of a group, or null if it has none (or an empty mesh). */
export function groupBounds(group: InstancedGroup): Bounds3 | null {
  const local = meshBounds(group.mesh);
  if (!local) return null;
  const transforms = group.transforms;
  let result: Bounds3 | null = null;
  for (let i = 0; i < transforms.length; i += TRANSFORM_STRIDE)
    result = unionBounds(result, transformBounds(local, transforms.subarray(i, i + TRANSFORM_STRIDE)));
  return result;
}

/** World bounds of every group in the scene, or null if the scene is empty. */
export const sceneBounds = (scene: ViewerScene): Bounds3 | null =>
  scene.groups.reduce<Bounds3 | null>((acc, g) => unionBounds(acc, groupBounds(g)), null);
