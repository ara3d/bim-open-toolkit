// Schemas for the model types a slice has to save.
//
// M1 gives the shapes and the combinators but not the schemas: `ViewState`, `StyleRule` and
// `AppearanceChange` are plain data a document must carry, and every host that saves a camera or a
// colour rule has to write these out. They are here because the default composition needs them
// first; `docs/viewer.md` records the request to move them beside their types.

import {
  array,
  boolean,
  literal,
  number,
  object,
  optional,
  record,
  string,
  tuple,
  union,
  type AppearanceChange,
  type CameraPose,
  type Color,
  type CoordinateContext,
  type LengthUnit,
  type Projection,
  type Registration,
  type Schema,
  type StyleRule,
  type UpAxis,
  type Vec3,
} from '@bim-open-toolkit/model';

// Three numbers, which is a point, a direction and a colour.
export const vec3Schema: Schema<Vec3> = tuple(number(), number(), number());
export const colorSchema: Schema<Color> = tuple(number(), number(), number());

export const lengthUnitSchema: Schema<LengthUnit> = union<LengthUnit>(
  literal('metres'),
  literal('centimetres'),
  literal('millimetres'),
  literal('feet'),
  literal('inches'),
  literal('unknown'),
);

export const upAxisSchema: Schema<UpAxis> = union<UpAxis>(literal('y'), literal('z'));

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

export const coordinateContextSchema: Schema<CoordinateContext> = object({
  units: lengthUnitSchema,
  up: upAxisSchema,
  registration: registrationSchema,
});

export const cameraPoseSchema: Schema<CameraPose> = object({
  position: vec3Schema,
  target: vec3Schema,
  up: vec3Schema,
});

export const projectionSchema: Schema<Projection> = union<Projection>(
  object({ kind: literal('perspective'), fieldOfViewDegrees: number(), near: number(), far: number() }),
  object({ kind: literal('orthographic'), height: number(), near: number(), far: number() }),
);

// A camera pose, how it projects, and the frame it is reported in.
export const viewStateSchema = object({
  camera: cameraPoseSchema,
  projection: projectionSchema,
  coordinates: coordinateContextSchema,
});

// Named plain values a feature adds to an appearance without changing the model package.
export const appearanceExtrasSchema = record(union<string | number | boolean>(string(), number(), boolean()));

export const appearanceChangeSchema: Schema<AppearanceChange> = object({
  color: optional(colorSchema),
  opacity: optional(number()),
  visible: optional(boolean()),
  extras: optional(appearanceExtrasSchema),
});

// One colour rule: what it targets and what it changes.
export const styleRuleSchema: Schema<StyleRule> = object({
  id: string(),
  name: string(),
  enabled: boolean(),
  priority: number(),
  targets: array(string()),
  change: appearanceChangeSchema,
});
