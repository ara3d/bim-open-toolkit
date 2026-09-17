import {
  diagnostic,
  namedSet,
  objectKey,
  objectRef,
  savedView,
  setOf,
  defaultView,
  type Diagnostic,
  type ModelRef,
  type NamedSet,
  type ObjectKey,
  type SavedView,
  type StyleRule,
} from '@bim-open-toolkit/model';

// The key of one object of a model revision. Workflow inputs carry ids; results carry keys.
export const keyOf = (model: ModelRef, objectId: string): ObjectKey => objectKey(objectRef(model, objectId));

// The keys of several objects of one model revision, in the order given.
export const keysOf = (model: ModelRef, ids: Iterable<string>): readonly ObjectKey[] =>
  [...ids].map((id) => keyOf(model, id));

// A named set of the objects with those ids.
export const namedObjectSet = (id: string, name: string, model: ModelRef, ids: Iterable<string>): NamedSet =>
  namedSet(id, name, setOf(keysOf(model, ids)));

// The ids that appear more than once, in the order they first repeat.
export const duplicateIds = (ids: Iterable<string>): readonly string[] => {
  const seen = new Set<string>();
  const repeated: string[] = [];
  for (const id of ids) {
    if (seen.has(id) && !repeated.includes(id)) repeated.push(id);
    seen.add(id);
  }
  return repeated;
};

// An error for each id a table repeats. A keyed result cannot be honest about a repeated key.
export const duplicateDiagnostics = (table: string, ids: Iterable<string>): readonly Diagnostic[] =>
  duplicateIds(ids).map((id) =>
    diagnostic('workflow/duplicate-id', `The ${table} table has more than one row with id "${id}".`, [table, id]),
  );

// A warning that a row points at something the input does not contain, which stays visible as a gap.
export const unknownReferenceDiagnostic = (table: string, field: string, id: string): Diagnostic =>
  diagnostic(
    'workflow/unknown-reference',
    `The ${table} table points at "${id}", which the input does not contain.`,
    [table, field],
    'warning',
  );

// The view a workflow suggests: the objects it wants looked at, coloured by its own rules.
// The camera is the default one, because an input of tables alone states no geometry to frame.
export const suggestedView = (
  id: string,
  name: string,
  selection: readonly ObjectKey[],
  rules: readonly StyleRule[],
): SavedView => savedView(id, name, defaultView, selection, rules);
