import type { ModelRef } from './identity.js';
import { diagnostic, failure, note, resultOf, success, type Result } from './result.js';
import {
  array, integer, object, optional, parse, record, string, unknownValue, type Schema,
} from './schema.js';

// A versioned piece of a scene document that one feature owns.
// `migrate` is given a value written at an older version and returns the current shape.
export type StateSlice<S> = {
  readonly id: string;
  readonly version: number;
  readonly schema: Schema<S>;
  readonly migrate: (value: unknown, fromVersion: number) => Result<S>;
  readonly default: S;
};

// One slice's stored value together with the version it was written at.
export type SliceEnvelope = {
  readonly version: number;
  readonly value: unknown;
};

// A saved scene: the models it refers to and one stored value per slice that was installed.
// It holds plain data only; nothing here is a renderer object or a function.
export type SceneDocument = {
  readonly formatVersion: number;
  readonly models: readonly ModelRef[];
  readonly slices: Readonly<Record<string, SliceEnvelope>>;
};

// The slices a session has installed, by id.
export type SliceRegistry = ReadonlyMap<string, StateSlice<unknown>>;

// One step that rewrites a slice value written at `from` into what version `from + 1` expects.
export type Migration = {
  readonly from: number;
  readonly up: (value: unknown) => unknown;
};

// The document format this package reads and writes.
export const currentFormatVersion = 1;

// The shape of a model reference inside a document.
export const modelRefSchema: Schema<ModelRef> = object({
  id: string(),
  revision: string(),
  source: optional(string()),
});

// The shape of a stored slice value.
export const sliceEnvelopeSchema: Schema<SliceEnvelope> = object({
  version: integer(),
  value: unknownValue(),
});

// The shape of a saved scene, before any slice's own value is checked.
export const sceneDocumentSchema: Schema<SceneDocument> = object({
  formatVersion: integer(),
  models: array(modelRefSchema),
  slices: record(sliceEnvelopeSchema),
});

// A migrate function that accepts only the current version, for a slice with no history yet.
export const noMigration =
  <S>(schema: Schema<S>, version: number) =>
  (value: unknown, fromVersion: number): Result<S> =>
    fromVersion === version
      ? parse(schema, value)
      : failure([
          diagnostic('slice/version', `Cannot read version ${fromVersion}; this slice knows only ${version}.`),
        ]);

// A migrate function that applies the steps from the stored version up to the current one.
// A missing step is reported rather than guessed, so an unreadable scene is never silently emptied.
export const migrations =
  <S>(schema: Schema<S>, version: number, steps: readonly Migration[]) =>
  (value: unknown, fromVersion: number): Result<S> => {
    if (fromVersion > version)
      return failure([
        diagnostic('slice/future', `Version ${fromVersion} is newer than the ${version} this slice knows.`),
      ]);
    let current = value;
    for (let at = fromVersion; at < version; at += 1) {
      const step = steps.find((candidate) => candidate.from === at);
      if (step === undefined)
        return failure([diagnostic('slice/migration', `No migration from version ${at} to ${at + 1}.`)]);
      current = step.up(current);
    }
    return parse(schema, current);
  };

// A slice of state owned by one feature. Without steps it reads only its own version.
export const stateSlice = <S>(
  id: string,
  version: number,
  schema: Schema<S>,
  defaultValue: S,
  steps: readonly Migration[] = [],
): StateSlice<S> => ({
  id,
  version,
  schema,
  migrate: steps.length === 0 ? noMigration(schema, version) : migrations(schema, version, steps),
  default: defaultValue,
});

// A document holding the given models and no slice values.
export const emptyDocument = (models: readonly ModelRef[] = []): SceneDocument => ({
  formatVersion: currentFormatVersion,
  models,
  slices: {},
});

// The document with one slice's value stored under its id, at that slice's current version.
export const putSlice = <S>(document: SceneDocument, slice: StateSlice<S>, value: S): SceneDocument => ({
  ...document,
  slices: { ...document.slices, [slice.id]: { version: slice.version, value } },
});

// The document without the slice's stored value, so reading it gives the slice's default again.
export const removeSlice = (document: SceneDocument, id: string): SceneDocument => {
  const slices = Object.fromEntries(Object.entries(document.slices).filter(([key]) => key !== id));
  return { ...document, slices };
};

// True when the document stores a value for the slice.
export const hasSlice = (document: SceneDocument, id: string): boolean =>
  Object.prototype.hasOwnProperty.call(document.slices, id);

// The ids of every slice the document stores a value for.
export const storedSliceIds = (document: SceneDocument): readonly string[] => Object.keys(document.slices);

// The value of a slice: checked, migrated when it was written at an earlier version, or its default.
// A missing slice is a note, not an error: a document written before a feature existed still opens.
export const getSlice = <S>(document: SceneDocument, slice: StateSlice<S>): Result<S> => {
  const stored = document.slices[slice.id];
  if (stored === undefined)
    return success(slice.default, [note('slice/absent', `The document has no "${slice.id}" slice.`, [slice.id])]);
  const read =
    stored.version === slice.version
      ? parse(slice.schema, stored.value)
      : slice.migrate(stored.value, stored.version);
  return read.ok
    ? read
    : failure(read.diagnostics.map((item) => ({ ...item, path: [slice.id, ...item.path] })));
};

// The slices a session has installed, by id.
export const sliceRegistry = (slices: readonly StateSlice<unknown>[]): SliceRegistry =>
  new Map(slices.map((slice) => [slice.id, slice]));

// The ids the document carries that no installed slice owns. They are kept, never dropped silently.
export const orphanSliceIds = (document: SceneDocument, registry: SliceRegistry): readonly string[] =>
  storedSliceIds(document).filter((id) => !registry.has(id));

// Reads a document out of plain data, checking its shape but not each slice's own value.
// Slice values are checked by `getSlice`, so a scene opens even when one feature's slice is broken.
export const parseDocument = (value: unknown): Result<SceneDocument> => {
  const shape = parse(sceneDocumentSchema, value);
  return shape.ok && shape.value.formatVersion !== currentFormatVersion
    ? resultOf(shape.value, [
        ...shape.diagnostics,
        diagnostic(
          'document/format',
          `Document format ${shape.value.formatVersion} is not the ${currentFormatVersion} this package reads.`,
          ['formatVersion'],
        ),
      ])
    : shape;
};
