// Instance transforms for the shapes the generators place.
//
// A mesh is built once, centred on the origin, and placed by its instance transform. Two placements
// cover almost everything the generators need: a box scaled to a size, and a run of pipe or duct
// between two points. Runs here are axis aligned, which is what a services layout drawn on a grid
// actually is; a run that is not axis aligned is refused rather than approximated, because the
// alternative is a general rotation nobody has asked for yet.

import {
  identityMatrix,
  multiplyMatrix,
  scaling,
  translation,
  type Matrix4,
  type Vec3,
} from '@bim-open-toolkit/model';

// One of the three coordinate axes.
export type Axis = 'x' | 'y' | 'z';

// Turns the local Y axis onto the world X axis, keeping the frame right handed.
const yToX: Matrix4 = [0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];

// Turns the local Y axis onto the world Z axis, keeping the frame right handed.
const yToZ: Matrix4 = [1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1];

// The rotation taking a mesh built along its own Y axis onto the given world axis.
export const alignYTo = (axis: Axis): Matrix4 =>
  axis === 'x' ? yToX : axis === 'z' ? yToZ : identityMatrix;

// Places a mesh built at unit size: scale it to the wanted size, then move it to the centre.
export const placeScaled = (centre: Vec3, size: Vec3): Matrix4 =>
  multiplyMatrix(translation(centre), scaling(size));

// The midpoint of two points.
export const midpoint = (from: Vec3, to: Vec3): Vec3 => [
  (from[0] + to[0]) / 2,
  (from[1] + to[1]) / 2,
  (from[2] + to[2]) / 2,
];

// The axis an axis-aligned run travels along, and its length. Throws when the two points differ on
// more than one axis, or not at all.
export function runAxis(from: Vec3, to: Vec3): { readonly axis: Axis; readonly length: number } {
  const deltas: readonly (readonly [Axis, number])[] = [
    ['x', to[0] - from[0]],
    ['y', to[1] - from[1]],
    ['z', to[2] - from[2]],
  ];
  const moving = deltas.filter(([, delta]) => delta !== 0);
  const first = moving[0];
  if (moving.length !== 1 || first === undefined) {
    throw new Error(`a run must travel along exactly one axis, got ${JSON.stringify(from)} to ${JSON.stringify(to)}`);
  }
  return { axis: first[0], length: Math.abs(first[1]) };
}

// Places a mesh built as a unit-diameter, unit-length shape along its own Y axis so that it spans
// two axis-aligned points with the given cross-section size.
export function placeRun(from: Vec3, to: Vec3, thickness: number): Matrix4 {
  const { axis, length } = runAxis(from, to);
  return multiplyMatrix(
    multiplyMatrix(translation(midpoint(from, to)), alignYTo(axis)),
    scaling([thickness, length, thickness]),
  );
}
