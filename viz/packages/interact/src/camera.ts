import {
  addVec3,
  atDistance,
  normalizeVec3,
  panBy,
  scaleVec3,
  subVec3,
  vec3Length,
  viewDirection,
  viewDistance,
  type CameraPose,
  type Matrix4,
  type Vec3,
} from '@bim-open-toolkit/model';
import { clamp } from './numbers.js';
import { cross, dot, perpendicularTo } from './vec.js';

// The up axis as a unit vector, falling back to z when the input has no length.
const upAxis = (up: Vec3): Vec3 => normalizeVec3(up) ?? [0, 0, 1];

// The camera's own unit axes. `right` points to the viewer's right and `up` completes the frame,
// so all three stay orthogonal even for a pose that looks straight along its own up hint.
export type CameraBasis = {
  readonly forward: Vec3;
  readonly right: Vec3;
  readonly up: Vec3;
};

// How far an orbit may tilt away from the up axis and how near or far its camera may sit.
// The polar limits belong inside the open interval (0, pi) so the camera never flips over a pole.
export type OrbitLimits = {
  readonly minPolar: number;
  readonly maxPolar: number;
  readonly minDistance: number;
  readonly maxDistance: number;
};

// Limits that keep a camera off both poles and inside a metre-scale range.
export const defaultOrbitLimits: OrbitLimits = {
  minPolar: 0.01,
  maxPolar: Math.PI - 0.01,
  minDistance: 0.01,
  maxDistance: 1.0e6,
};

// The camera's unit axes, derived from where it looks and its own up hint.
// A degenerate pose (no view direction, or looking along its up hint) still yields an orthogonal frame.
export const cameraBasis = (pose: CameraPose): CameraBasis => {
  const up = upAxis(pose.up);
  const forward = normalizeVec3(viewDirection(pose)) ?? perpendicularTo(up);
  const right = normalizeVec3(cross(forward, up)) ?? perpendicularTo(forward);
  return { forward, right, up: cross(right, forward) };
};

// Where a camera sits relative to what it looks at: distance, angle around the up axis, and
// angle away from the up axis. `orbitAngles` and `poseFromOrbit` are inverses of each other.
export type OrbitAngles = {
  readonly distance: number;
  readonly azimuth: number;
  readonly polar: number;
};

// The reference pair of axes an azimuth is measured in, at right angles to the up axis.
const azimuthFrame = (up: Vec3): { readonly a: Vec3; readonly b: Vec3 } => {
  const a = perpendicularTo(up);
  return { a, b: cross(up, a) };
};

// The offset expressed as a distance and two angles about the up axis.
const anglesOf = (offset: Vec3, up: Vec3): OrbitAngles => {
  const distance = vec3Length(offset);
  const frame = azimuthFrame(up);
  return {
    distance,
    azimuth: Math.atan2(dot(offset, frame.b), dot(offset, frame.a)),
    polar: distance === 0 ? Math.PI / 2 : Math.acos(clamp(dot(offset, up) / distance, -1, 1)),
  };
};

// The offset that a distance and two angles about the up axis describe.
const offsetOf = (angles: OrbitAngles, up: Vec3): Vec3 => {
  const frame = azimuthFrame(up);
  const sine = Math.sin(angles.polar);
  const horizontal = addVec3(
    scaleVec3(frame.a, Math.cos(angles.azimuth) * sine),
    scaleVec3(frame.b, Math.sin(angles.azimuth) * sine),
  );
  return scaleVec3(addVec3(horizontal, scaleVec3(up, Math.cos(angles.polar))), angles.distance);
};

// Where the camera sits relative to its target, measured about the given up axis.
export const orbitAngles = (pose: CameraPose, up: Vec3): OrbitAngles =>
  anglesOf(subVec3(pose.position, pose.target), upAxis(up));

// A camera placed at the given distance and angles from a target, looking at it, upright about `up`.
export const poseFromOrbit = (target: Vec3, up: Vec3, angles: OrbitAngles): CameraPose => {
  const axis = upAxis(up);
  return { position: addVec3(target, offsetOf(angles, axis)), target, up: axis };
};

// The offset turned by `azimuth` about the up axis and `polar` toward the horizon, angles clamped.
const turn = (offset: Vec3, up: Vec3, azimuth: number, polar: number, limits: OrbitLimits): Vec3 => {
  const current = anglesOf(offset, up);
  return offsetOf(
    {
      distance: current.distance,
      azimuth: current.azimuth + azimuth,
      polar: clamp(current.polar + polar, limits.minPolar, limits.maxPolar),
    },
    up,
  );
};

// The camera swung around its target. Positive `azimuth` turns anticlockwise seen from along the
// up axis; positive `polar` lowers the camera toward the horizon. Target and distance do not move,
// and the camera is left upright about `up`.
export const orbitPose = (
  pose: CameraPose,
  up: Vec3,
  azimuth: number,
  polar: number,
  limits: OrbitLimits = defaultOrbitLimits,
): CameraPose => {
  const axis = upAxis(up);
  return {
    position: addVec3(pose.target, turn(subVec3(pose.position, pose.target), axis, azimuth, polar, limits)),
    target: pose.target,
    up: axis,
  };
};

// The camera turned in place, keeping its position and how far away it looks. The angles mean the
// same as in `orbitPose`: azimuth about the up axis, polar away from it.
export const lookPose = (
  pose: CameraPose,
  up: Vec3,
  azimuth: number,
  polar: number,
  limits: OrbitLimits = defaultOrbitLimits,
): CameraPose => {
  const axis = upAxis(up);
  return {
    position: pose.position,
    target: addVec3(pose.position, turn(subVec3(pose.target, pose.position), axis, azimuth, polar, limits)),
    up: axis,
  };
};

// The camera moved along its view direction, keeping the target and clamped to the distance limits.
// A factor below one moves closer. A pose with no view direction is returned unchanged.
export const dollyPose = (
  pose: CameraPose,
  factor: number,
  limits: OrbitLimits = defaultOrbitLimits,
): CameraPose => atDistance(pose, clamp(viewDistance(pose) * factor, limits.minDistance, limits.maxDistance));

// The camera and its target slid in the plane of the screen, by distances in scene units.
export const panPose = (pose: CameraPose, right: number, up: number): CameraPose => {
  const basis = cameraBasis(pose);
  return panBy(pose, addVec3(scaleVec3(basis.right, right), scaleVec3(basis.up, up)));
};

// The camera and its target moved as a walker does: `forward` and `right` run along the ground
// plane at right angles to the up axis and `up` runs along the up axis, so looking down does not
// drive the camera into the floor. Distances are in scene units.
export const walkPose = (
  pose: CameraPose,
  up: Vec3,
  forward: number,
  right: number,
  upward: number,
): CameraPose => {
  const axis = upAxis(up);
  const basis = cameraBasis(pose);
  const flatten = (v: Vec3): Vec3 | undefined => normalizeVec3(subVec3(v, scaleVec3(axis, dot(v, axis))));
  const ahead = flatten(basis.forward) ?? flatten(basis.up) ?? perpendicularTo(axis);
  const sideways = cross(ahead, axis);
  return panBy(
    pose,
    addVec3(addVec3(scaleVec3(ahead, forward), scaleVec3(sideways, right)), scaleVec3(axis, upward)),
  );
};

// The transform taking world coordinates into camera coordinates, column-major and right-handed,
// with the camera at the origin looking down its own negative z axis.
export const viewMatrix = (pose: CameraPose): Matrix4 => {
  const { forward, right, up } = cameraBasis(pose);
  const eye = pose.position;
  return [
    right[0], up[0], -forward[0], 0,
    right[1], up[1], -forward[1], 0,
    right[2], up[2], -forward[2], 0,
    -dot(right, eye), -dot(up, eye), dot(forward, eye), 1,
  ];
};

// The camera lifted straight above its target along the up axis, looking down, keeping its
// distance. `heading` turns the picture in the ground plane, in radians, and is what an overhead
// mode holds fixed. The pose's up hint becomes the heading direction, as a top-down camera needs.
export const overheadPose = (pose: CameraPose, up: Vec3, heading = 0): CameraPose => {
  const axis = upAxis(up);
  const distance = Math.max(viewDistance(pose), Number.EPSILON);
  const frame = azimuthFrame(axis);
  return {
    position: addVec3(pose.target, scaleVec3(axis, distance)),
    target: pose.target,
    up: addVec3(scaleVec3(frame.a, Math.cos(heading)), scaleVec3(frame.b, Math.sin(heading))),
  };
};

// Which way in the ground plane is up the screen, as an angle about the up axis. For a camera
// looking down it is the heading `overheadPose` set; for a camera looking along the ground it is
// the direction the camera faces, so lifting a walking camera overhead keeps the picture pointing
// the same way.
export const screenHeading = (pose: CameraPose, up: Vec3): number => {
  const axis = upAxis(up);
  const frame = azimuthFrame(axis);
  const basis = cameraBasis(pose);
  const flatten = (v: Vec3): Vec3 | undefined => normalizeVec3(subVec3(v, scaleVec3(axis, dot(v, axis))));
  // Screen-up and forward are at right angles, so at most one of them lies along the up axis and
  // the second fallback is unreachable; it is here to make that plain rather than to be taken.
  const bearing = flatten(basis.up) ?? flatten(basis.forward) ?? frame.a;
  return Math.atan2(dot(bearing, frame.b), dot(bearing, frame.a));
};
