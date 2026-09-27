// A box preview drawn as instanced unit cubes: what `Viewer.preview` puts in the scene before the
// full model is parsed, and what the pane's up-axis and cube code retire to once P1 lands (see the
// plan's "Extension points").
//
// Every box gets its own instance of one shared cube mesh, scaled and translated to the box, so the
// whole preview costs one draw call per opacity bucket rather than one per box.

import { InstancedGroup, type MeshBuffers } from '@ara3d/viewer-core';
import { boundsSize, upVector, vec3Length, type CoordinateContext } from '@bim-open-toolkit/model';
import { previewBoxStride, type BoxPreview } from '@bim-open-toolkit/formats';
import type { View } from './view.js';

// A face of the unit cube: four corners, wound so the two triangles face outward, each corner
// carrying the face's own normal (flat shading needs one normal per corner, not per vertex).
const cubeFace = (
  normal: readonly [number, number, number],
  u: readonly [number, number, number],
  v: readonly [number, number, number],
): { readonly positions: readonly number[]; readonly normals: readonly number[] } => {
  const positions: number[] = [];
  const normals: number[] = [];
  for (const [su, sv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const)
    for (let axis = 0; axis < 3; axis++) {
      const n = normal[axis] ?? 0;
      positions.push(0.5 * n + 0.5 * su * (u[axis] ?? 0) + 0.5 * sv * (v[axis] ?? 0));
      normals.push(n);
    }
  return { positions, normals };
};

const buildUnitCube = (): MeshBuffers => {
  const faces = [
    cubeFace([1, 0, 0], [0, 1, 0], [0, 0, 1]),
    cubeFace([-1, 0, 0], [0, 0, 1], [0, 1, 0]),
    cubeFace([0, 1, 0], [0, 0, 1], [1, 0, 0]),
    cubeFace([0, -1, 0], [1, 0, 0], [0, 0, 1]),
    cubeFace([0, 0, 1], [1, 0, 0], [0, 1, 0]),
    cubeFace([0, 0, -1], [0, 1, 0], [1, 0, 0]),
  ];
  const positions = new Float32Array(faces.flatMap((face) => face.positions));
  const normals = new Float32Array(faces.flatMap((face) => face.normals));
  const indices = new Uint32Array(
    faces.flatMap((_, face) => {
      const base = face * 4;
      return [base, base + 1, base + 2, base, base + 2, base + 3];
    }),
  );
  return { positions, normals, indices };
};

/** Axis-aligned cube, edge 1, centred at the origin, flat-shaded: 24 vertices with normals, 12 triangles. */
export const unitCube: MeshBuffers = buildUnitCube();

// A box axis never shrinks below this fraction of the preview bounds' diagonal, so a box flat in one
// dimension (a slab, a paper-thin panel) still gets a non-degenerate normal matrix.
const minAxisFraction = 0.001;

// One instanced group of unit cubes over the rows named, or undefined when there are none.
const groupOfRows = (preview: BoxPreview, rows: readonly number[], minAxis: number): InstancedGroup | undefined => {
  if (rows.length === 0) return undefined;
  const transforms = new Float32Array(rows.length * 16);
  const colors = new Float32Array(rows.length * 4);
  rows.forEach((row, index) => {
    const at = row * previewBoxStride;
    const minX = preview.boxes[at] ?? 0;
    const minY = preview.boxes[at + 1] ?? 0;
    const minZ = preview.boxes[at + 2] ?? 0;
    const maxX = preview.boxes[at + 3] ?? 0;
    const maxY = preview.boxes[at + 4] ?? 0;
    const maxZ = preview.boxes[at + 5] ?? 0;
    const o = index * 16;
    // Column-major scale-then-translate: the diagonal holds the (floored) box size, the last column
    // its centre, exactly as the pane's own boxes-table transform is built.
    transforms[o] = Math.max(maxX - minX, minAxis);
    transforms[o + 5] = Math.max(maxY - minY, minAxis);
    transforms[o + 10] = Math.max(maxZ - minZ, minAxis);
    transforms[o + 12] = (minX + maxX) / 2;
    transforms[o + 13] = (minY + maxY) / 2;
    transforms[o + 14] = (minZ + maxZ) / 2;
    transforms[o + 15] = 1;
    colors.set(preview.colors.subarray(row * 4, row * 4 + 4), index * 4);
  });
  const group = new InstancedGroup(unitCube, undefined, rows.length);
  group.append(transforms, colors);
  return group;
};

/** Opaque boxes, then translucent boxes (each group omitted when empty), as unit cubes scaled to each box, with every axis at least 0.001 of the bounds' diagonal. */
export function previewGroups(preview: BoxPreview): readonly InstancedGroup[] {
  const size = boundsSize(preview.bounds);
  const minAxis = size === undefined ? 0 : vec3Length(size) * minAxisFraction;
  const opaqueRows: number[] = [];
  const translucentRows: number[] = [];
  for (let row = 0; row < preview.count; row++) {
    const alpha = preview.colors[row * 4 + 3] ?? 1;
    (alpha >= 1 ? opaqueRows : translucentRows).push(row);
  }
  const groups = [groupOfRows(preview, opaqueRows, minAxis), groupOfRows(preview, translucentRows, minAxis)];
  return groups.filter((group): group is InstancedGroup => group !== undefined);
}

/** Puts a view in a model's frame: its coordinates, and an up vector of +z or +y to match. */
export function applyCoordinateConvention(view: View, coordinates: CoordinateContext): void {
  const current = view.camera();
  view.setCamera({
    ...current,
    coordinates,
    camera: { ...current.camera, up: upVector(coordinates.up) },
  });
}

export type PreviewOptions = {
  /** Frame every view on the preview's bounds. Defaults to the viewer's `fitOnOpen`. */
  readonly fit?: boolean;
};
