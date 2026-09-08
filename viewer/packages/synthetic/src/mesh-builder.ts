// Accumulates triangles into the model package's mesh plain data.
//
// Faces do not share vertices between primitives' faces: each face carries its own normals, which
// keeps flat faces flat and lets a curved surface supply per-corner normals instead. Vertex count
// is not minimal; correctness and simplicity are worth more here than a few kilobytes.

import { boundsOfPositions, type Mesh, type Vec3 } from '@bim-open-toolkit/model';

// A mesh that carries per-vertex normals. `Mesh.normals` is optional; every mesh built here has one.
export type ShadedMesh = Mesh & { readonly normals: Float32Array };

// One mesh of a generated scene and what it stands for. Its position in a scene's array of groups
// is the `meshIndex` its instances carry, so a reader can name what a batch of instances draws.
export type MeshGroup = {
  readonly name: string;
  readonly mesh: ShadedMesh;
  readonly instanceCount: number;
  readonly triangleCount: number;
};

// A mesh under construction. The arrays are appended to; the fields never change.
export type MeshBuilder = { readonly positions: number[]; readonly normals: number[]; readonly indices: number[] };

// An empty mesh under construction.
export const builder = (): MeshBuilder => ({ positions: [], normals: [], indices: [] });

// Subtracts two points.
const subtract = (a: Vec3, b: Vec3): Vec3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

// The cross product of two directions.
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

// Scales a direction to unit length. Throws for a zero-length direction, which would mean a
// degenerate face rather than a recoverable input.
export function normalize(direction: Vec3): Vec3 {
  const length = Math.hypot(direction[0], direction[1], direction[2]);
  if (!(length > 0)) throw new Error('cannot normalize a zero-length direction');
  return [direction[0] / length, direction[1] / length, direction[2] / length];
}

// The unit normal of the triangle a, b, c under the right-hand rule.
export const faceNormal = (a: Vec3, b: Vec3, c: Vec3): Vec3 =>
  normalize(cross(subtract(b, a), subtract(c, a)));

// Appends one vertex and returns its index.
function vertex(target: MeshBuilder, position: Vec3, normal: Vec3): number {
  const index = target.positions.length / 3;
  target.positions.push(position[0], position[1], position[2]);
  target.normals.push(normal[0], normal[1], normal[2]);
  return index;
}

// Appends a triangle whose corners carry the given normals.
export function addTriangle(
  target: MeshBuilder,
  corners: readonly [Vec3, Vec3, Vec3],
  normals: readonly [Vec3, Vec3, Vec3],
): void {
  const first = vertex(target, corners[0], normals[0]);
  vertex(target, corners[1], normals[1]);
  vertex(target, corners[2], normals[2]);
  target.indices.push(first, first + 1, first + 2);
}

// Appends a triangle with one normal taken from its winding.
export function addFlatTriangle(target: MeshBuilder, corners: readonly [Vec3, Vec3, Vec3]): void {
  const normal = faceNormal(corners[0], corners[1], corners[2]);
  addTriangle(target, corners, [normal, normal, normal]);
}

// Appends a planar quadrilateral as two triangles whose corners carry the given normals.
export function addQuad(
  target: MeshBuilder,
  corners: readonly [Vec3, Vec3, Vec3, Vec3],
  normals: readonly [Vec3, Vec3, Vec3, Vec3],
): void {
  const first = vertex(target, corners[0], normals[0]);
  vertex(target, corners[1], normals[1]);
  vertex(target, corners[2], normals[2]);
  vertex(target, corners[3], normals[3]);
  target.indices.push(first, first + 1, first + 2, first, first + 2, first + 3);
}

// Appends a planar quadrilateral with one normal taken from its winding.
export function addFlatQuad(target: MeshBuilder, corners: readonly [Vec3, Vec3, Vec3, Vec3]): void {
  const normal = faceNormal(corners[0], corners[1], corners[2]);
  addQuad(target, corners, [normal, normal, normal, normal]);
}

// Freezes a mesh under construction into typed arrays with its bounds.
export function build(target: MeshBuilder): ShadedMesh {
  if (target.positions.length % 3 !== 0) throw new Error('positions must hold three numbers per vertex');
  if (target.positions.length !== target.normals.length) throw new Error('every vertex needs one normal');
  if (target.indices.length % 3 !== 0) throw new Error('indices must hold three numbers per triangle');
  const positions = new Float32Array(target.positions);
  return {
    positions,
    normals: new Float32Array(target.normals),
    indices: new Uint32Array(target.indices),
    bounds: boundsOfPositions(positions),
  };
}
