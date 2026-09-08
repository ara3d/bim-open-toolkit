// Clipping planes and boxes as plain data.
//
// A plane keeps the points on its positive side: `dot(normal, point) + constant >= 0`. A box keeps
// its interior, which is the intersection of six such planes. That is the same convention three.js
// uses for `Plane` and for material clipping with `clipIntersection` false, so a renderer adapter
// copies these across without reinterpreting them.
//
// Nothing here needs a renderer. `ClippingTarget` is the one-method seam a renderer implements, so
// the behaviour above it is tested in Node.

import {
  diagnostic,
  disposable,
  failure,
  success,
  vec3Length,
  type Bounds,
  type Disposable,
  type Result,
  type Vec3,
} from '@bim-open-toolkit/model';

// A half-space. Points where `dot(normal, point) + constant` is negative are removed.
export type ClipPlane = {
  readonly normal: Vec3;
  readonly constant: number;
};

// What a section is: an explicit list of half-spaces, or a box whose interior is kept.
export type ClipRegion =
  | { readonly kind: 'planes'; readonly planes: readonly ClipPlane[] }
  | { readonly kind: 'box'; readonly min: Vec3; readonly max: Vec3 };

// A region that removes nothing.
export const noClipping: ClipRegion = { kind: 'planes', planes: [] };

// A normalized plane, or a failure when the normal has no direction or a value is not finite.
export const clipPlane = (normal: Vec3, constant: number): Result<ClipPlane> => {
  if (![...normal, constant].every(Number.isFinite))
    return failure([diagnostic('bad-plane', 'A clipping plane needs finite values', ['normal'])]);
  const length = vec3Length(normal);
  if (length === 0)
    return failure([diagnostic('bad-plane', 'A clipping plane needs a normal with a direction', ['normal'])]);
  return success({
    normal: [(normal[0] ?? 0) / length, (normal[1] ?? 0) / length, (normal[2] ?? 0) / length],
    constant: constant / length,
  });
};

// A plane through a point, keeping the side the normal points towards.
export const planeThrough = (normal: Vec3, point: Vec3): Result<ClipPlane> => {
  const plane = clipPlane(normal, 0);
  if (!plane.ok) return plane;
  const unit = plane.value.normal;
  const offset = -((unit[0] ?? 0) * (point[0] ?? 0) + (unit[1] ?? 0) * (point[1] ?? 0) + (unit[2] ?? 0) * (point[2] ?? 0));
  return success({ normal: unit, constant: offset });
};

// The six planes of a box, in the order minimum x, maximum x, minimum y, and so on.
export const boxPlanes = (min: Vec3, max: Vec3): Result<readonly ClipPlane[]> => {
  if (![...min, ...max].every(Number.isFinite))
    return failure([diagnostic('bad-box', 'A clipping box needs finite corners', ['min'])]);
  for (let axis = 0; axis < 3; axis++)
    if ((min[axis] ?? 0) > (max[axis] ?? 0))
      return failure([diagnostic('bad-box', 'A clipping box needs its minimum below its maximum', ['min', axis])]);
  return success([
    { normal: [1, 0, 0], constant: -(min[0] ?? 0) },
    { normal: [-1, 0, 0], constant: max[0] ?? 0 },
    { normal: [0, 1, 0], constant: -(min[1] ?? 0) },
    { normal: [0, -1, 0], constant: max[1] ?? 0 },
    { normal: [0, 0, 1], constant: -(min[2] ?? 0) },
    { normal: [0, 0, -1], constant: max[2] ?? 0 },
  ]);
};

// The half-spaces a region stands for.
export const planesOf = (region: ClipRegion): Result<readonly ClipPlane[]> => {
  if (region.kind === 'box') return boxPlanes(region.min, region.max);
  const planes: ClipPlane[] = [];
  for (let i = 0; i < region.planes.length; i++) {
    const source = region.planes[i];
    if (source === undefined) continue;
    const plane = clipPlane(source.normal, source.constant);
    if (!plane.ok) return failure(plane.diagnostics);
    planes.push(plane.value);
  }
  return success(planes);
};

// How far a point is from a plane, positive on the kept side.
export const signedDistance = (plane: ClipPlane, point: Vec3): number =>
  (plane.normal[0] ?? 0) * (point[0] ?? 0) +
  (plane.normal[1] ?? 0) * (point[1] ?? 0) +
  (plane.normal[2] ?? 0) * (point[2] ?? 0) +
  plane.constant;

// Whether any plane removes the point. An empty list removes nothing.
export const isClipped = (planes: readonly ClipPlane[], point: Vec3): boolean =>
  planes.some((plane) => signedDistance(plane, point) < 0);

// The corner of a box that is furthest along a direction: the last part of the box to be removed.
const supportCorner = (bounds: Bounds, normal: Vec3): Vec3 => [
  (normal[0] ?? 0) >= 0 ? bounds.max[0] ?? 0 : bounds.min[0] ?? 0,
  (normal[1] ?? 0) >= 0 ? bounds.max[1] ?? 0 : bounds.min[1] ?? 0,
  (normal[2] ?? 0) >= 0 ? bounds.max[2] ?? 0 : bounds.min[2] ?? 0,
];

// Whether a box is removed entirely, which is what lets a renderer skip it. A box that straddles a
// plane is not removed.
export const boundsClipped = (planes: readonly ClipPlane[], bounds: Bounds): boolean =>
  planes.some((plane) => signedDistance(plane, supportCorner(bounds, plane.normal)) < 0);

// What a renderer has to provide for clipping: the planes now in force.
export type ClippingTarget = {
  readonly setPlanes: (planes: readonly ClipPlane[]) => void;
};

// Puts a region in force and hands back the way to lift it. Disposing restores no clipping, not the
// planes that were there before, because a target holds one section at a time by design.
export const applyClipping = (target: ClippingTarget, region: ClipRegion): Result<Disposable> => {
  const planes = planesOf(region);
  if (!planes.ok) return failure(planes.diagnostics);
  target.setPlanes(planes.value);
  return success(disposable(() => target.setPlanes([])));
};
