import { addVec3, normalizeVec3, scaleVec3, subVec3, type Vec3 } from '@bim-open-toolkit/model';
import { clamp } from './numbers.js';

// Scalar product of two vectors.
export const dot = (a: Vec3, b: Vec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// Vector product, right-handed: `cross(x, y)` points along z.
export const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

// The point a fraction of the way from one to the other. Fractions outside 0 to 1 extrapolate.
export const lerpVec3 = (a: Vec3, b: Vec3, t: number): Vec3 => addVec3(a, scaleVec3(subVec3(b, a), t));

// The axis-aligned unit vector least aligned with the direction, so a cross product with it is stable.
const leastAlignedAxis = (v: Vec3): Vec3 => {
  const [x, y, z] = [Math.abs(v[0]), Math.abs(v[1]), Math.abs(v[2])];
  return x <= y && x <= z ? [1, 0, 0] : y <= z ? [0, 1, 0] : [0, 0, 1];
};

// A unit vector at right angles to the direction, chosen the same way every time for a given input.
// A direction with no length yields the x axis.
export const perpendicularTo = (direction: Vec3): Vec3 => {
  const unit = normalizeVec3(direction);
  return unit === undefined ? [1, 0, 0] : (normalizeVec3(cross(unit, leastAlignedAxis(unit))) ?? [1, 0, 0]);
};

// A unit vector turned a fraction of the way toward another along the shorter arc, staying unit
// length throughout. Directly opposite vectors have no shorter arc, so the turn goes through a
// fixed perpendicular: the path is arbitrary but smooth and the same every time.
// Inputs that are not unit length are normalised first; a vector with no length is ignored.
export const unitSlerp = (a: Vec3, b: Vec3, t: number): Vec3 => {
  const from = normalizeVec3(a);
  const to = normalizeVec3(b);
  if (from === undefined) return to ?? [0, 0, 1];
  if (to === undefined) return from;
  const angle = Math.acos(clamp(dot(from, to), -1, 1));
  if (angle < 1.0e-6) return to;
  if (Math.PI - angle < 1.0e-6) {
    const axis = perpendicularTo(from);
    const turn = Math.PI * t;
    return addVec3(scaleVec3(from, Math.cos(turn)), scaleVec3(cross(axis, from), Math.sin(turn)));
  }
  const sine = Math.sin(angle);
  return addVec3(
    scaleVec3(from, Math.sin((1 - t) * angle) / sine),
    scaleVec3(to, Math.sin(t * angle) / sine),
  );
};
