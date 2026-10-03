// The unit cube the 3D pane instances once per row of a boxes table
// (@bimopenflow/panes parseBoxTable scales and moves it).
import type { MeshBuffers } from "@bim-open-viewer/core";

const cubeFace = (
  // Face normal axis and direction; u/v span the face.
  normal: readonly [number, number, number],
  u: readonly [number, number, number],
  v: readonly [number, number, number],
): { positions: number[]; normals: number[] } => {
  const positions: number[] = [];
  const normals: number[] = [];
  for (const [su, sv] of [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const)
    for (let c = 0; c < 3; c++) {
      positions.push(0.5 * normal[c] + 0.5 * su * u[c] + 0.5 * sv * v[c]);
      normals.push(normal[c]);
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
  const positions = new Float32Array(faces.flatMap((f) => f.positions));
  const normals = new Float32Array(faces.flatMap((f) => f.normals));
  const indices = new Uint32Array(
    faces.flatMap((_, f) => {
      const b = f * 4;
      return [b, b + 1, b + 2, b, b + 2, b + 3];
    }),
  );
  return { positions, normals, indices };
};

/** Axis-aligned cube: edge 1, centered at the origin, flat-shaded (24 verts, 12 tris). */
export const UNIT_CUBE: MeshBuffers = buildUnitCube();
