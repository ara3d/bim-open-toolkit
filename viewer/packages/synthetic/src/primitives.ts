// Mesh primitives as plain data.
//
// Every primitive is centered on the origin and wound counter-clockwise seen from outside, so a
// face normal points away from the solid. Placement, rotation and scale belong to the instance
// transform, not to the mesh. Meshes are closed solids except `plane`, which is a single face.

import { addFlatQuad, addFlatTriangle, addQuad, build, builder, type MeshBuilder } from './mesh-builder.js';
import { signedArea, triangulate } from './triangulate.js';
import type { MeshData, Vector2, Vector3 } from './shapes.js';

// Rejects a dimension that would produce a degenerate mesh.
function positive(name: string, value: number): number {
  if (!(value > 0) || !Number.isFinite(value)) throw new Error(`${name} must be a positive finite number, got ${value}`);
  return value;
}

// The six faces of a box: an outward axis and two in-plane axes whose cross product is that axis.
const boxFaces: readonly { readonly normal: Vector3; readonly u: Vector3; readonly v: Vector3 }[] = [
  { normal: [1, 0, 0], u: [0, 1, 0], v: [0, 0, 1] },
  { normal: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
  { normal: [0, 1, 0], u: [0, 0, 1], v: [1, 0, 0] },
  { normal: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] },
  { normal: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
  { normal: [0, 0, -1], u: [0, 1, 0], v: [1, 0, 0] },
];

// A rectangular box of the given width, height and depth, centered on the origin.
export function box(size: Vector3): MeshData {
  const half: Vector3 = [positive('width', size[0]) / 2, positive('height', size[1]) / 2, positive('depth', size[2]) / 2];
  const target = builder();
  for (const face of boxFaces) {
    const corner = (u: number, v: number): Vector3 => [
      face.normal[0] * half[0] + u * face.u[0] * half[0] + v * face.v[0] * half[0],
      face.normal[1] * half[1] + u * face.u[1] * half[1] + v * face.v[1] * half[1],
      face.normal[2] * half[2] + u * face.u[2] * half[2] + v * face.v[2] * half[2],
    ];
    addFlatQuad(target, [corner(-1, -1), corner(1, -1), corner(1, 1), corner(-1, 1)]);
  }
  return build(target);
}

// A closed cylinder about the Y axis, centered on the origin, faceted into `segments` sides.
// Side normals are radial, so the sides shade as a curved surface; the caps are flat.
export function cylinder(radius: number, height: number, segments: number): MeshData {
  positive('radius', radius);
  positive('height', height);
  if (!Number.isInteger(segments) || segments < 3) throw new Error(`segments must be an integer of at least 3, got ${segments}`);
  const half = height / 2;
  const target = builder();
  const angle = (step: number): number => (2 * Math.PI * step) / segments;
  const ring = (step: number, y: number): Vector3 => [radius * Math.cos(angle(step)), y, radius * Math.sin(angle(step))];
  const radial = (step: number): Vector3 => [Math.cos(angle(step)), 0, Math.sin(angle(step))];
  for (let step = 0; step < segments; step++) {
    const outward = radial(step);
    const following = radial(step + 1);
    addQuad(
      target,
      [ring(step, half), ring(step + 1, half), ring(step + 1, -half), ring(step, -half)],
      [outward, following, following, outward],
    );
    addFlatTriangle(target, [[0, half, 0], ring(step + 1, half), ring(step, half)]);
    addFlatTriangle(target, [[0, -half, 0], ring(step, -half), ring(step + 1, -half)]);
  }
  return build(target);
}

// A single upward-facing rectangle in the XZ plane, centered on the origin. Not a solid.
export function plane(width: number, depth: number): MeshData {
  const halfWidth = positive('width', width) / 2;
  const halfDepth = positive('depth', depth) / 2;
  const target = builder();
  addFlatQuad(target, [
    [-halfWidth, 0, -halfDepth],
    [-halfWidth, 0, halfDepth],
    [halfWidth, 0, halfDepth],
    [halfWidth, 0, -halfDepth],
  ]);
  return build(target);
}

// A right triangular prism centered on the origin: the cross-section is the half of the width by
// height rectangle below its rising diagonal, extruded along Z. Used for roofs and ramps.
export function wedge(size: Vector3): MeshData {
  const halfWidth = positive('width', size[0]) / 2;
  const halfHeight = positive('height', size[1]) / 2;
  const halfDepth = positive('depth', size[2]) / 2;
  const section: readonly [Vector2, Vector2, Vector2] = [
    [-halfWidth, -halfHeight],
    [halfWidth, -halfHeight],
    [-halfWidth, halfHeight],
  ];
  const point = (corner: Vector2, z: number): Vector3 => [corner[0], corner[1], z];
  const target = builder();
  addFlatTriangle(target, [point(section[0], halfDepth), point(section[1], halfDepth), point(section[2], halfDepth)]);
  addFlatTriangle(target, [point(section[2], -halfDepth), point(section[1], -halfDepth), point(section[0], -halfDepth)]);
  for (let index = 0; index < section.length; index++) {
    const from = section[index];
    const to = section[(index + 1) % section.length];
    if (from === undefined || to === undefined) throw new Error('the wedge cross-section is malformed');
    addFlatQuad(target, [point(from, -halfDepth), point(to, -halfDepth), point(to, halfDepth), point(from, halfDepth)]);
  }
  return build(target);
}

// A solid formed by extruding a simple polygon along Y, spanning height/2 either side of the
// origin. The footprint keeps its own X and Z coordinates. Winding may be either way; a
// self-intersecting or zero-area outline throws.
export function extrude(footprint: readonly Vector2[], height: number): MeshData {
  const half = positive('height', height) / 2;
  const area = signedArea(footprint);
  if (area === 0) throw new Error('an extruded footprint must enclose an area');
  const points = area > 0 ? footprint : [...footprint].reverse();
  const target = builder();
  const point = (corner: Vector2, y: number): Vector3 => [corner[0], y, corner[1]];
  const corner = (index: number): Vector2 => {
    const value = points[index];
    if (value === undefined) throw new Error(`footprint index ${index} is out of range`);
    return value;
  };
  for (const triangle of triangulate(points)) {
    addFlatTriangle(target, [point(corner(triangle[0]), -half), point(corner(triangle[1]), -half), point(corner(triangle[2]), -half)]);
    addFlatTriangle(target, [point(corner(triangle[2]), half), point(corner(triangle[1]), half), point(corner(triangle[0]), half)]);
  }
  addSides(target, points, half);
  return build(target);
}

// Appends the vertical faces of an extruded footprint, one quad per edge.
function addSides(target: MeshBuilder, points: readonly Vector2[], half: number): void {
  for (let index = 0; index < points.length; index++) {
    const from = points[index];
    const to = points[(index + 1) % points.length];
    if (from === undefined || to === undefined) throw new Error('the footprint is malformed');
    addFlatQuad(target, [
      [from[0], half, from[1]],
      [to[0], half, to[1]],
      [to[0], -half, to[1]],
      [from[0], -half, from[1]],
    ]);
  }
}
