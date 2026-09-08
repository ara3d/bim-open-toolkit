// Where the camera lives: one state slice holding the view the gallery is showing.
//
// Navigation is an input adapter, not a source of truth. `attachNavigation` reports every step and
// the host writes the resulting view here, so a panel, an inspector or a test reads the camera the
// same way it reads anything else, and a saved document already carries it.
//
// The schema is written out here because `model` publishes `ViewState` and `coordinateContextSchema`
// but no schema for the view itself. That is a request to the model track, not a design choice.

import {
  coordinateContextSchema,
  defaultView,
  literal,
  number,
  object,
  stateSlice,
  tuple,
  union,
  type Projection,
  type Schema,
  type StateSlice,
  type Vec3,
  type ViewState,
} from '@bim-open-toolkit/model';

export const vec3Schema: Schema<Vec3> = tuple(number(), number(), number());

export const projectionSchema: Schema<Projection> = union<Projection>(
  object({ kind: literal('perspective'), fieldOfViewDegrees: number(), near: number(), far: number() }),
  object({ kind: literal('orthographic'), height: number(), near: number(), far: number() }),
);

export const viewStateSchema: Schema<ViewState> = object({
  camera: object({ position: vec3Schema, target: vec3Schema, up: vec3Schema }),
  projection: projectionSchema,
  coordinates: coordinateContextSchema,
});

// The camera of one gallery viewport, as plain data a document can hold.
export const viewSlice: StateSlice<ViewState> = stateSlice('gallery/view', 1, viewStateSchema, defaultView);
