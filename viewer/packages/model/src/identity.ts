import { diagnostic, failure, success, type Result } from './result.js';

// A loaded model version. `id` names the model, `revision` names the snapshot of it.
export type ModelRef = {
  readonly id: string;
  readonly revision: string;
  readonly source?: string | undefined;
};

// Identity of one object: the model revision it belongs to plus its id within that revision.
export type ObjectRef = {
  readonly modelId: string;
  readonly revision: string;
  readonly objectId: string;
};

// A string form of a model revision identity, usable as a map key.
export type ModelKey = string;

// A string form of an object identity, usable as a map key.
export type ObjectKey = string;

// The character joining the parts of a key. Percent encoding keeps it out of the parts themselves.
const separator = '|';

const decodeParts = (key: string, expected: number): readonly string[] | undefined => {
  const parts = key.split(separator);
  if (parts.length !== expected) return undefined;
  try {
    return parts.map(decodeURIComponent);
  } catch {
    return undefined;
  }
};

// The identity part of a model reference, without its source location.
export const modelIdentity = (model: ModelRef): ModelRef => ({ id: model.id, revision: model.revision });

// The reference to an object of a model revision.
export const objectRef = (model: ModelRef, objectId: string): ObjectRef => ({
  modelId: model.id,
  revision: model.revision,
  objectId,
});

// The model revision an object belongs to.
export const modelOf = (ref: ObjectRef): ModelRef => ({ id: ref.modelId, revision: ref.revision });

// Key for a model revision. Equal keys denote the same revision.
export const modelKey = (model: ModelRef): ModelKey =>
  `${encodeURIComponent(model.id)}${separator}${encodeURIComponent(model.revision)}`;

// Key for an object. Equal keys denote the same object.
export const objectKey = (ref: ObjectRef): ObjectKey =>
  `${encodeURIComponent(ref.modelId)}${separator}${encodeURIComponent(ref.revision)}${separator}${encodeURIComponent(ref.objectId)}`;

// Reads a key produced by `objectKey` back into a reference, or reports why it is not one.
export const parseObjectKey = (key: ObjectKey): Result<ObjectRef> => {
  const parts = decodeParts(key, 3);
  const [modelId, revision, objectId] = parts ?? [];
  return modelId !== undefined && revision !== undefined && objectId !== undefined
    ? success({ modelId, revision, objectId })
    : failure([diagnostic('object-key/shape', 'An object key is three percent-encoded parts joined by "|".')]);
};

// Reads a key produced by `modelKey` back into a reference, or reports why it is not one.
export const parseModelKey = (key: ModelKey): Result<ModelRef> => {
  const parts = decodeParts(key, 2);
  const [id, revision] = parts ?? [];
  return id !== undefined && revision !== undefined
    ? success({ id, revision })
    : failure([diagnostic('model-key/shape', 'A model key is two percent-encoded parts joined by "|".')]);
};

// True when both references denote the same model revision.
export const sameModel = (a: ModelRef, b: ModelRef): boolean => a.id === b.id && a.revision === b.revision;

// True when both references name the same model, whatever revision each one is.
export const sameModelId = (a: ModelRef, b: ModelRef): boolean => a.id === b.id;

// True when both references denote the same object.
export const sameObject = (a: ObjectRef, b: ObjectRef): boolean =>
  a.modelId === b.modelId && a.revision === b.revision && a.objectId === b.objectId;

// True when the object belongs to the model revision.
export const belongsTo = (ref: ObjectRef, model: ModelRef): boolean => sameModel(modelOf(ref), model);

// The same object identity read at another revision of its model, for revision comparison.
export const atRevision = (ref: ObjectRef, revision: string): ObjectRef => ({ ...ref, revision });
