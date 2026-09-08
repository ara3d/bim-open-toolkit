// Picking: what object is under a ray, and where.
//
// The part that needs a renderer is one function type, `RaycastSource`, which turns a ray into
// group-and-slot hits. Everything above it - resolving a hit to an object key, rejecting hidden or
// clipped hits, choosing the nearest across several sources - is pure and tested in Node. Ray and
// triangle intersection is here too, so a source that draws its own geometry (a replacement mesh,
// an overlay volume) can be written and tested without a browser.
//
// A hit is reported against an object key, never against a group and slot, because those are this
// package's bookkeeping and change when a model is rebuilt.

import { MIN_VISIBLE_ALPHA } from '@ara3d/viewer-core';
import {
  colorStride,
  normalizeVec3,
  subVec3,
  type Matrix4,
  type Mesh,
  type ObjectKey,
  type Vec3,
} from '@bim-open-toolkit/model';
import { isClipped, type ClipPlane } from './clipping.js';
import { alphaChannel, type InstanceTable } from './instance-table.js';

// A ray in world coordinates. The direction is expected to be a unit vector, so a distance along it
// is a world distance.
export type Ray = {
  readonly origin: Vec3;
  readonly direction: Vec3;
};

// What a renderer reports: which group, which slot inside it, where and how far.
export type RaycastHit = {
  readonly group: number;
  readonly slot: number;
  readonly point: Vec3;
  readonly distance: number;
};

// The seam a renderer implements. Hits may arrive in any order.
export type RaycastSource = (ray: Ray) => readonly RaycastHit[];

// What picking returns: object identity, where the ray met it, and which source reported it.
export type ObjectHit = {
  readonly key: ObjectKey;
  readonly object: number;
  // Table row, or -1 when the hit came from a source that draws its own geometry.
  readonly row: number;
  readonly point: Vec3;
  readonly distance: number;
  // Identifies the source, so a caller can tell an instance from a replacement or an overlay.
  readonly source: string;
};

// A source of hits already resolved to objects: a replacement layer, an overlay, a proxy.
export type ObjectHitSource = {
  readonly id: string;
  readonly hits: (ray: Ray) => readonly ObjectHit[];
};

// The name instance hits are reported under.
export const instanceSource = 'instances';

// What picking is allowed to return.
export type PickOptions = {
  // Hidden and near-transparent rows are not pickable by default: a user cannot point at them.
  readonly includeHidden: boolean;
  // Hits removed by these planes are rejected, so a clipped-away surface does not block a pick.
  readonly planes: readonly ClipPlane[];
};

// Visible, unclipped, nearest first.
export const defaultPickOptions: PickOptions = { includeHidden: false, planes: [] };

// Group ordinals by group object, which is what a renderer adapter needs to report a hit.
export const groupOrdinals = (table: InstanceTable): ReadonlyMap<object, number> => {
  const ordinals = new Map<object, number>();
  for (let g = 0; g < table.groups.length; g++) {
    const group = table.groups[g];
    if (group !== undefined) ordinals.set(group, g);
  }
  return ordinals;
};

// The table row a group and slot address, or -1 when they are out of range.
export const rowOfSlot = (table: InstanceTable, group: number, slot: number): number => {
  const start = table.groupStart[group];
  const end = table.groupStart[group + 1];
  if (start === undefined || end === undefined) return -1;
  const row = start + slot;
  return slot >= 0 && row < end ? row : -1;
};

// Whether a row is drawn: shown, and not so transparent that the renderer discards it.
export const isPickable = (table: InstanceTable, row: number): boolean => {
  if (table.visible[row] !== 1) return false;
  const colors = table.colors[table.groupOfRow[row] ?? -1];
  if (colors === undefined) return false;
  const at = (row - (table.groupStart[table.groupOfRow[row] ?? 0] ?? 0)) * colorStride + alphaChannel;
  return (colors[at] ?? 0) >= MIN_VISIBLE_ALPHA;
};

// Resolves one renderer hit to an object, or undefined when it addresses nothing this table holds.
export const resolveHit = (
  table: InstanceTable,
  hit: RaycastHit,
  options: PickOptions = defaultPickOptions,
): ObjectHit | undefined => {
  const row = rowOfSlot(table, hit.group, hit.slot);
  if (row < 0) return undefined;
  if (!options.includeHidden && !isPickable(table, row)) return undefined;
  if (isClipped(options.planes, hit.point)) return undefined;
  const object = table.objectOfRow[row] ?? -1;
  const key = table.keys[object];
  if (key === undefined) return undefined;
  return { key, object, row, point: hit.point, distance: hit.distance, source: instanceSource };
};

// The closest hit, or undefined. Hits at a negative distance are behind the ray and are ignored.
export const nearestHit = (hits: Iterable<ObjectHit>): ObjectHit | undefined => {
  let nearest: ObjectHit | undefined;
  for (const hit of hits)
    if (hit.distance >= 0 && Number.isFinite(hit.distance) && (nearest === undefined || hit.distance < nearest.distance))
      nearest = hit;
  return nearest;
};

// The closest instance hit among what a renderer reported.
export const pickInstances = (
  table: InstanceTable,
  hits: readonly RaycastHit[],
  options: PickOptions = defaultPickOptions,
): ObjectHit | undefined => {
  const resolved: ObjectHit[] = [];
  for (const hit of hits) {
    const found = resolveHit(table, hit, options);
    if (found !== undefined) resolved.push(found);
  }
  return nearestHit(resolved);
};

// The closest hit from the instances and from every extra source, which is how a replacement mesh
// or an overlay volume competes with the geometry it stands in front of.
export const pick = (
  table: InstanceTable,
  ray: Ray,
  raycast: RaycastSource,
  sources: readonly ObjectHitSource[] = [],
  options: PickOptions = defaultPickOptions,
): ObjectHit | undefined => {
  const candidates: ObjectHit[] = [];
  const instances = pickInstances(table, raycast(ray), options);
  if (instances !== undefined) candidates.push(instances);
  for (const source of sources)
    for (const hit of source.hits(ray))
      if (!isClipped(options.planes, hit.point)) candidates.push({ ...hit, source: source.id });
  return nearestHit(candidates);
};

// The point a distance along a ray.
export const pointOnRay = (ray: Ray, distance: number): Vec3 => [
  (ray.origin[0] ?? 0) + (ray.direction[0] ?? 0) * distance,
  (ray.origin[1] ?? 0) + (ray.direction[1] ?? 0) * distance,
  (ray.origin[2] ?? 0) + (ray.direction[2] ?? 0) * distance,
];

// Transforms a point by a column-major 4x4 including the perspective divide, or undefined when the
// result is at infinity. `transformPoint` in the model package is affine only, which a projection
// is not.
export const projectPoint = (matrix: Matrix4, point: Vec3): Vec3 | undefined => {
  const x = point[0] ?? 0;
  const y = point[1] ?? 0;
  const z = point[2] ?? 0;
  const w = (matrix[3] ?? 0) * x + (matrix[7] ?? 0) * y + (matrix[11] ?? 0) * z + (matrix[15] ?? 0);
  if (w === 0 || !Number.isFinite(w)) return undefined;
  return [
    ((matrix[0] ?? 0) * x + (matrix[4] ?? 0) * y + (matrix[8] ?? 0) * z + (matrix[12] ?? 0)) / w,
    ((matrix[1] ?? 0) * x + (matrix[5] ?? 0) * y + (matrix[9] ?? 0) * z + (matrix[13] ?? 0)) / w,
    ((matrix[2] ?? 0) * x + (matrix[6] ?? 0) * y + (matrix[10] ?? 0) * z + (matrix[14] ?? 0)) / w,
  ];
};

// The world ray through a point in normalized device coordinates, both in [-1, 1].
//
// `inverseViewProjection` is the inverse of the camera's projection times its view matrix; the near
// and far points of the normalized cube map back through it to the two ends of the ray.
export const rayThroughNdc = (
  inverseViewProjection: Matrix4,
  x: number,
  y: number,
): Ray | undefined => {
  const near = projectPoint(inverseViewProjection, [x, y, -1]);
  const far = projectPoint(inverseViewProjection, [x, y, 1]);
  if (near === undefined || far === undefined) return undefined;
  const direction = normalizeVec3(subVec3(far, near));
  return direction === undefined ? undefined : { origin: near, direction };
};

// Distance along the ray to a triangle, or undefined when it misses.
//
// Moller-Trumbore, accepting both faces: a section cut leaves back faces towards the camera, and a
// pick that ignored them would report the surface behind the one the user is looking at.
export const intersectTriangle = (ray: Ray, a: Vec3, b: Vec3, c: Vec3): number | undefined => {
  const e1 = subVec3(b, a);
  const e2 = subVec3(c, a);
  const d = ray.direction;
  const px = (d[1] ?? 0) * (e2[2] ?? 0) - (d[2] ?? 0) * (e2[1] ?? 0);
  const py = (d[2] ?? 0) * (e2[0] ?? 0) - (d[0] ?? 0) * (e2[2] ?? 0);
  const pz = (d[0] ?? 0) * (e2[1] ?? 0) - (d[1] ?? 0) * (e2[0] ?? 0);
  const determinant = (e1[0] ?? 0) * px + (e1[1] ?? 0) * py + (e1[2] ?? 0) * pz;
  if (Math.abs(determinant) < 1e-12) return undefined;
  const inverse = 1 / determinant;
  const t = subVec3(ray.origin, a);
  const u = ((t[0] ?? 0) * px + (t[1] ?? 0) * py + (t[2] ?? 0) * pz) * inverse;
  if (u < 0 || u > 1) return undefined;
  const qx = (t[1] ?? 0) * (e1[2] ?? 0) - (t[2] ?? 0) * (e1[1] ?? 0);
  const qy = (t[2] ?? 0) * (e1[0] ?? 0) - (t[0] ?? 0) * (e1[2] ?? 0);
  const qz = (t[0] ?? 0) * (e1[1] ?? 0) - (t[1] ?? 0) * (e1[0] ?? 0);
  const v = ((d[0] ?? 0) * qx + (d[1] ?? 0) * qy + (d[2] ?? 0) * qz) * inverse;
  if (v < 0 || u + v > 1) return undefined;
  const distance = ((e2[0] ?? 0) * qx + (e2[1] ?? 0) * qy + (e2[2] ?? 0) * qz) * inverse;
  return distance >= 0 ? distance : undefined;
};

const placedVertex = (mesh: Mesh, index: number, transform: Matrix4 | undefined): Vec3 => {
  const at = index * 3;
  const x = mesh.positions[at] ?? 0;
  const y = mesh.positions[at + 1] ?? 0;
  const z = mesh.positions[at + 2] ?? 0;
  if (transform === undefined) return [x, y, z];
  return [
    (transform[0] ?? 0) * x + (transform[4] ?? 0) * y + (transform[8] ?? 0) * z + (transform[12] ?? 0),
    (transform[1] ?? 0) * x + (transform[5] ?? 0) * y + (transform[9] ?? 0) * z + (transform[13] ?? 0),
    (transform[2] ?? 0) * x + (transform[6] ?? 0) * y + (transform[10] ?? 0) * z + (transform[14] ?? 0),
  ];
};

// Nearest intersection of a ray with a placed mesh, walking every triangle.
//
// Linear in triangles, which is what a replacement mesh or an overlay volume needs and no more. The
// instanced geometry is picked by the renderer, which already has an acceleration structure.
export const intersectMesh = (
  ray: Ray,
  mesh: Mesh,
  transform?: Matrix4,
): { readonly distance: number; readonly point: Vec3 } | undefined => {
  let nearest: number | undefined;
  for (let i = 0; i + 2 < mesh.indices.length; i += 3) {
    const a = placedVertex(mesh, mesh.indices[i] ?? 0, transform);
    const b = placedVertex(mesh, mesh.indices[i + 1] ?? 0, transform);
    const c = placedVertex(mesh, mesh.indices[i + 2] ?? 0, transform);
    const distance = intersectTriangle(ray, a, b, c);
    if (distance !== undefined && (nearest === undefined || distance < nearest)) nearest = distance;
  }
  return nearest === undefined ? undefined : { distance: nearest, point: pointOnRay(ray, nearest) };
};
