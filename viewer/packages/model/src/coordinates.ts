import { multiplyMatrix, scaling, type Matrix4, type Vec3 } from './math.js';

// A length unit a model can report in. `unknown` stays explicit and is never guessed.
export type LengthUnit = 'metres' | 'centimetres' | 'millimetres' | 'feet' | 'inches' | 'unknown';

// Which axis points up in the model's own frame.
export type UpAxis = 'y' | 'z';

// Where a project frame sits on the earth. Angles are degrees, altitude is metres.
export type GeographicAnchor = {
  readonly latitude: number;
  readonly longitude: number;
  readonly altitude: number;
  readonly trueNorthDegrees: number;
};

// How the model's coordinates relate to the world. `unknown` is a real state, not a default.
export type Registration =
  | { readonly kind: 'local' }
  | { readonly kind: 'project'; readonly projectId: string }
  | { readonly kind: 'geographic'; readonly anchor: GeographicAnchor }
  | { readonly kind: 'unknown' };

// The frame a set of coordinates is reported in. Every model, layout and overlay declares one.
export type CoordinateContext = {
  readonly units: LengthUnit;
  readonly up: UpAxis;
  readonly registration: Registration;
};

// Metres in one unit, or undefined when the unit is unknown.
export const metresPerUnit = (unit: LengthUnit): number | undefined => {
  switch (unit) {
    case 'metres':
      return 1;
    case 'centimetres':
      return 0.01;
    case 'millimetres':
      return 0.001;
    case 'feet':
      return 0.3048;
    case 'inches':
      return 0.0254;
    case 'unknown':
      return undefined;
  }
};

// The factor converting lengths from one unit to another, or undefined when either is unknown.
export const conversionFactor = (from: LengthUnit, to: LengthUnit): number | undefined => {
  const source = metresPerUnit(from);
  const target = metresPerUnit(to);
  return source === undefined || target === undefined ? undefined : source / target;
};

// A length converted between units, or undefined when the conversion is not known.
export const convertLength = (value: number, from: LengthUnit, to: LengthUnit): number | undefined => {
  const factor = conversionFactor(from, to);
  return factor === undefined ? undefined : value * factor;
};

// A uniform scale that converts coordinates between units, or undefined when unknown.
export const unitScaleMatrix = (from: LengthUnit, to: LengthUnit): Matrix4 | undefined => {
  const factor = conversionFactor(from, to);
  return factor === undefined ? undefined : scaling([factor, factor, factor]);
};

// The up direction of the frame.
export const upVector = (up: UpAxis): Vec3 => (up === 'y' ? [0, 1, 0] : [0, 0, 1]);

// Rotates z-up coordinates into y-up.
export const zUpToYUp: Matrix4 = [1, 0, 0, 0, 0, 0, -1, 0, 0, 1, 0, 0, 0, 0, 0, 1];

// Rotates y-up coordinates into z-up.
export const yUpToZUp: Matrix4 = [1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1];

// The rotation between two up-axis conventions.
export const upAxisMatrix = (from: UpAxis, to: UpAxis): Matrix4 =>
  from === to ? [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1] : from === 'z' ? zUpToYUp : yUpToZUp;

// The transform taking coordinates of one context into another, or undefined when a unit is unknown.
// Registration is not converted: differing registrations need data this package does not hold.
export const contextTransform = (from: CoordinateContext, to: CoordinateContext): Matrix4 | undefined => {
  const scale = unitScaleMatrix(from.units, to.units);
  return scale === undefined ? undefined : multiplyMatrix(upAxisMatrix(from.up, to.up), scale);
};

// True when the frame is placed in a shared project or geographic frame.
export const isRegistered = (context: CoordinateContext): boolean =>
  context.registration.kind === 'project' || context.registration.kind === 'geographic';

// The anchor of a geographic frame, or undefined when the frame is not geographic.
export const geographicAnchor = (context: CoordinateContext): GeographicAnchor | undefined =>
  context.registration.kind === 'geographic' ? context.registration.anchor : undefined;

// The frame used when nothing is known about a source: it never claims units or placement.
export const unknownCoordinates: CoordinateContext = {
  units: 'unknown',
  up: 'z',
  registration: { kind: 'unknown' },
};

// The frame synthetic and test data reports in.
export const metresZUpLocal: CoordinateContext = {
  units: 'metres',
  up: 'z',
  registration: { kind: 'local' },
};
