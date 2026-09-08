import {
  literal,
  number,
  object,
  string,
  union,
  type CoordinateContext,
  type LengthUnit,
  type Registration,
  type Schema,
  type UpAxis,
} from '@bim-open-toolkit/model';
import { enumeration } from './schema-tools.js';

// Every length unit a frame can report in, including the honest one.
export const lengthUnits: readonly LengthUnit[] = [
  'metres',
  'centimetres',
  'millimetres',
  'feet',
  'inches',
  'unknown',
];

// The unit a frame reports lengths in.
export const lengthUnitSchema: Schema<LengthUnit> = enumeration(lengthUnits);

// Which axis a frame calls up.
export const upAxisSchema: Schema<UpAxis> = enumeration<UpAxis>(['y', 'z']);

// How a frame is registered: on its own, against a project, against the world, or not stated.
export const registrationSchema: Schema<Registration> = union<Registration>(
  object({ kind: literal('local') }),
  object({ kind: literal('project'), projectId: string() }),
  object({
    kind: literal('geographic'),
    anchor: object({
      latitude: number(),
      longitude: number(),
      altitude: number(),
      trueNorthDegrees: number(),
    }),
  }),
  object({ kind: literal('unknown') }),
);

// The JSON form of a coordinate frame, which a workflow comparing two sources has to be given.
// Model states the type but publishes no schema for it; this is that schema until it does.
export const coordinateContextSchema: Schema<CoordinateContext> = object({
  units: lengthUnitSchema,
  up: upAxisSchema,
  registration: registrationSchema,
});
