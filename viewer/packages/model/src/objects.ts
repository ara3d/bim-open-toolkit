import type { CoordinateContext } from './coordinates.js';
import { objectKey, type ModelRef, type ObjectKey, type ObjectRef } from './identity.js';
import { identityMatrix, type Matrix4 } from './math.js';
import type { Appearance } from './style.js';

// One addressable object of a model. A record without a representation is still a valid object.
// `representation` is the row in `Geometry.instances` of the object's first drawn placement, and
// nothing more: an object with many placements has many rows, and `InstanceRecords.objectIndex` is
// the whole mapping. It is absent when the object draws nothing.
export type ObjectRecord = {
  readonly ref: ObjectRef;
  readonly name?: string | undefined;
  readonly category?: string | undefined;
  readonly sourceId?: string | undefined;
  readonly parentId?: string | undefined;
  readonly transform: Matrix4;
  readonly appearance?: Appearance | undefined;
  readonly representation?: number | undefined;
};

// A loaded model revision: its identity, the frame it reports in, and its object records.
export type ModelData = {
  readonly ref: ModelRef;
  readonly coordinates: CoordinateContext;
  readonly objects: readonly ObjectRecord[];
};

// An object record placed at the origin with no geometry and no name.
export const emptyObject = (ref: ObjectRef): ObjectRecord => ({ ref, transform: identityMatrix });

// True when the object has a drawn placement, whose first instance row `representation` names.
export const hasRepresentation = (record: ObjectRecord): boolean => record.representation !== undefined;

// Every object of the model addressed by its key. Later duplicates replace earlier ones.
export const objectsByKey = (model: ModelData): ReadonlyMap<ObjectKey, ObjectRecord> =>
  new Map(model.objects.map((record) => [objectKey(record.ref), record]));

// The row of each object in `model.objects`, addressed by key.
export const objectIndexByKey = (model: ModelData): ReadonlyMap<ObjectKey, number> =>
  new Map(model.objects.map((record, index) => [objectKey(record.ref), index]));

// The references of every object of the model, in table order.
export const objectRefs = (model: ModelData): readonly ObjectRef[] =>
  model.objects.map((record) => record.ref);

// A model with no objects, useful as an identity value and in tests.
export const emptyModel = (ref: ModelRef, coordinates: CoordinateContext): ModelData => ({
  ref,
  coordinates,
  objects: [],
});
