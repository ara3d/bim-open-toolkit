// Ear clipping for a simple polygon in the XZ plane.
//
// Ear clipping is O(n squared) and rejects self-intersecting outlines and holes. Room footprints
// here have a handful of corners, so the simple algorithm is the right one; a faster or more
// permissive triangulator would be a separate function, not a change to this one.

import type { Vector2 } from './shapes.js';

// A triangle as three indices into the polygon's points.
export type TriangleIndices = readonly [number, number, number];

// Reads an element, treating an out-of-range index as a programming error.
function at<T>(items: readonly T[], index: number): T {
  const value = items[index];
  if (value === undefined) throw new Error(`index ${index} is out of range`);
  return value;
}

// Twice the signed area of the polygon. Positive means counter-clockwise in (x, z).
export function signedArea(points: readonly Vector2[]): number {
  let total = 0;
  for (let index = 0; index < points.length; index++) {
    const current = at(points, index);
    const following = at(points, (index + 1) % points.length);
    total += current[0] * following[1] - following[0] * current[1];
  }
  return total / 2;
}

// Twice the signed area of the triangle a, b, c. Positive means counter-clockwise.
const turn = (a: Vector2, b: Vector2, c: Vector2): number =>
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);

// True when the point lies inside or on the counter-clockwise triangle a, b, c.
const inside = (a: Vector2, b: Vector2, c: Vector2, point: Vector2): boolean =>
  turn(a, b, point) >= 0 && turn(b, c, point) >= 0 && turn(c, a, point) >= 0;

// Splits a simple polygon into triangles, all wound counter-clockwise in (x, z), and returns them
// as index triples. Requires at least three points and a counter-clockwise, non-self-intersecting
// outline; anything else throws rather than producing a plausible but wrong mesh.
export function triangulate(points: readonly Vector2[]): readonly TriangleIndices[] {
  if (points.length < 3) throw new Error(`a polygon needs at least three points, got ${points.length}`);
  if (!(signedArea(points) > 0)) throw new Error('a polygon must be counter-clockwise in (x, z) and have a positive area');
  const remaining = points.map((_, index) => index);
  const triangles: TriangleIndices[] = [];
  while (remaining.length > 3) {
    const clipped = clipOneEar(points, remaining);
    if (clipped === undefined) throw new Error('cannot triangulate: the outline is self-intersecting or degenerate');
    triangles.push(clipped);
  }
  triangles.push([at(remaining, 0), at(remaining, 1), at(remaining, 2)]);
  return triangles;
}

// Removes the first ear from the remaining ring and returns it, or undefined when there is none.
function clipOneEar(points: readonly Vector2[], remaining: number[]): TriangleIndices | undefined {
  for (let position = 0; position < remaining.length; position++) {
    const previous = at(remaining, (position + remaining.length - 1) % remaining.length);
    const current = at(remaining, position);
    const following = at(remaining, (position + 1) % remaining.length);
    const a = at(points, previous);
    const b = at(points, current);
    const c = at(points, following);
    if (turn(a, b, c) <= 0) continue;
    const blocked = remaining.some(
      (index) => index !== previous && index !== current && index !== following && inside(a, b, c, at(points, index)),
    );
    if (blocked) continue;
    remaining.splice(position, 1);
    return [previous, current, following];
  }
  return undefined;
}
