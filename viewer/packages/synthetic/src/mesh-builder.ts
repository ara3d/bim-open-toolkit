// Accumulates triangles into mesh plain data.
//
// Faces do not share vertices between primitives' faces: each face carries its own normals, which
// keeps flat faces flat and lets a curved surface supply per-corner normals instead. Vertex count
// is not minimal; correctness and simplicity are worth more here than a few kilobytes.

import { emptyBounds, growBounds, type Bounds3, type MeshData, type Vector3 } from './shapes.js';

// A mesh under construction. The arrays are appended to; the fields never change.
export type MeshBuilder = { readonly positions: number[]; readonly normals: number[]; readonly indices: number[] };

// An empty mesh under construction.
export const builder = (): MeshBuilder => ({ positions: [], normals: [], indices: [] });

// Subtracts two points.
const subtract = (a: Vector3, b: Vector3): Vector3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];

// The cross product of two directions.
const cross = (a: Vector3, b: Vector3): Vector3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

// Scales a direction to unit length. Throws for a zero-length direction, which would mean a
// degenerate face rather than a recoverable input.
export function normalize(direction: Vector3): Vector3 {
  const length = Math.hypot(direction[0], direction[1], direction[2]);
  if (!(length > 0)) throw new Error('cannot normalize a zero-length direction');
  return [direction[0] / length, direction[1] / length, direction[2] / length];
}

// The unit normal of the triangle a, b, c under the right-hand rule.
export const faceNormal = (a: Vector3, b: Vector3, c: Vector3): Vector3 =>
  normalize(cross(subtract(b, a), subtract(c, a)));

// Appends one vertex and returns its index.
function vertex(target: MeshBuilder, position: Vector3, normal: Vector3): number {
  const index = target.positions.length / 3;
  target.positions.push(position[0], position[1], position[2]);
  target.normals.push(normal[0], normal[1], normal[2]);
  return index;
}

// Appends a triangle whose corners carry the given normals.
export function addTriangle(
  target: MeshBuilder,
  corners: readonly [Vector3, Vector3, Vector3],
  normals: readonly [Vector3, Vector3, Vector3],
): void {
  const first = vertex(target, corners[0], normals[0]);
  vertex(target, corners[1], normals[1]);
  vertex(target, corners[2], normals[2]);
  target.indices.push(first, first + 1, first + 2);
}

// Appends a triangle with one normal taken from its winding.
export function addFlatTriangle(target: MeshBuilder, corners: readonly [Vector3, Vector3, Vector3]): void {
  const normal = faceNormal(corners[0], corners[1], corners[2]);
  addTriangle(target, corners, [normal, normal, normal]);
}

// Appends a planar quadrilateral as two triangles whose corners carry the given normals.
export function addQuad(
  target: MeshBuilder,
  corners: readonly [Vector3, Vector3, Vector3, Vector3],
  normals: readonly [Vector3, Vector3, Vector3, Vector3],
): void {
  const first = vertex(target, corners[0], normals[0]);
  vertex(target, corners[1], normals[1]);
  vertex(target, corners[2], normals[2]);
  vertex(target, corners[3], normals[3]);
  target.indices.push(first, first + 1, first + 2, first, first + 2, first + 3);
}

// Appends a planar quadrilateral with one normal taken from its winding.
export function addFlatQuad(target: MeshBuilder, corners: readonly [Vector3, Vector3, Vector3, Vector3]): void {
  const normal = faceNormal(corners[0], corners[1], corners[2]);
  addQuad(target, corners, [normal, normal, normal, normal]);
}

// The axis-aligned bounds of packed xyz positions.
export function boundsOf(positions: ArrayLike<number>): Bounds3 {
  let bounds = emptyBounds;
  for (let index = 0; index + 2 < positions.length; index += 3) {
    const x = positions[index];
    const y = positions[index + 1];
    const z = positions[index + 2];
    if (x === undefined || y === undefined || z === undefined) throw new Error('positions must hold three numbers per vertex');
    bounds = growBounds(bounds, [x, y, z]);
  }
  return bounds;
}

// Freezes a mesh under construction into typed arrays with its bounds.
export function build(target: MeshBuilder): MeshData {
  if (target.positions.length % 3 !== 0) throw new Error('positions must hold three numbers per vertex');
  if (target.positions.length !== target.normals.length) throw new Error('every vertex needs one normal');
  if (target.indices.length % 3 !== 0) throw new Error('indices must hold three numbers per triangle');
  const positions = new Float32Array(target.positions);
  return {
    positions,
    normals: new Float32Array(target.normals),
    indices: new Uint32Array(target.indices),
    bounds: boundsOf(positions),
  };
}

// The number of triangles in a mesh.
export const triangleCount = (mesh: MeshData): number => mesh.indices.length / 3;

// The number of vertices in a mesh.
export const vertexCount = (mesh: MeshData): number => mesh.positions.length / 3;
