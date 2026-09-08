// Named object sets, set algebra over them, isolation, and the transient selection.
//
// A named set is persistent and a selection is not, which is why they are different fields of one
// slice rather than the same thing. Members are object keys, so a set survives a save, addresses a
// geometry-free record, and may name an object no loaded model holds.
//
// The selection never includes an object an edit layer deleted or hid. `sets.select` drops deleted
// keys as it writes, because a deleted object is gone from the scene; `effectiveSelection` drops
// hidden ones as the style composes, because hiding is reversible and the selection should come
// back when the object does. That is M1's composition order - base, edits, rules, filter, selection
// - stated on the selection's own side: marking an object never brings back geometry.

import {
  array,
  command,
  diagnostic,
  differenceSets,
  emptySet,
  enumeration,
  failure,
  feature,
  intersectSets,
  namedSet,
  nullable,
  object,
  optional,
  setKeys,
  setOf,
  stateSlice,
  string,
  success,
  unionSets,
  type Command,
  type EditEffect,
  type Feature,
  type Migration,
  type NamedSet,
  type ObjectKey,
  type ObjectSet,
  type Result,
  type Schema,
  type Session,
  type StateSlice,
} from '@bim-open-toolkit/model';
import { noInput, objectKeysSchema } from './appearance-schemas.js';
import { editEffectOf } from './edits.js';

// A named set as a document holds it: members listed, not a runtime Set.
export type SavedSet = { readonly id: string; readonly name: string; readonly members: readonly ObjectKey[] };

// What the sets feature owns: the named sets, the selection, and what is isolated.
// `isolated` is null when everything eligible is shown; an empty list hides everything.
export type SetsState = {
  readonly sets: readonly SavedSet[];
  readonly selection: readonly ObjectKey[];
  readonly isolated: readonly ObjectKey[] | null;
};

// How a selection command combines what it is given with what is already selected.
export type SelectionMode = 'replace' | 'add' | 'remove' | 'toggle';

// A named set as plain data.
export const savedSetSchema: Schema<SavedSet> = object({
  id: string(),
  name: string(),
  members: objectKeysSchema,
});

// The saved shape of the sets feature.
export const setsStateSchema: Schema<SetsState> = object({
  sets: array(savedSetSchema),
  selection: objectKeysSchema,
  isolated: nullable(objectKeysSchema),
});

// No sets, nothing selected, nothing isolated.
export const noSetsState: SetsState = { sets: [], selection: [], isolated: null };

// Version 1 has nothing to migrate from; a later version adds its step here.
export const setsMigrations: readonly Migration[] = [];

// The named sets and the selection, as a document holds them.
export const setsSlice: StateSlice<SetsState> = stateSlice('sets', 1, setsStateSchema, noSetsState, setsMigrations);

// A saved set as the model package's `NamedSet`, with its members as a set.
export const namedSetOf = (saved: SavedSet): NamedSet => namedSet(saved.id, saved.name, setOf(saved.members));

// A saved set as plain data, which is the form a command input and a document both use.
export const savedSetOf = (set: NamedSet): SavedSet => ({
  id: set.id,
  name: set.name,
  members: setKeys(set.members),
});

// One named set, or undefined when nothing is named that.
export const findSet = (state: SetsState, id: string): SavedSet | undefined =>
  state.sets.find((item) => item.id === id);

// The members of one named set, empty when there is no such set.
export const membersOf = (state: SetsState, id: string): ObjectSet => {
  const found = findSet(state, id);
  return found === undefined ? emptySet : setOf(found.members);
};

// What is selected right now, as a set and with no edits taken into account.
export const selectionOf = (state: SetsState): ObjectSet => setOf(state.selection);

// The selection as a style composes it: an object an edit layer hid or deleted is not in it.
export const effectiveSelection = (state: SetsState, effect: EditEffect): ObjectSet =>
  setOf(state.selection.filter((key) => !effect.deleted.has(key) && !effect.hidden.has(key)));

// What is isolated, or undefined when nothing is, which is the filter a style composition takes.
export const isolationOf = (state: SetsState): ObjectSet | undefined =>
  state.isolated === null ? undefined : setOf(state.isolated);

// Defines or replaces a named set.
export type DefineSetInput = { readonly id: string; readonly name: string; readonly members: readonly ObjectKey[] };

// Names one set.
export type SetIdInput = { readonly id: string };

// Combines named sets into a new one.
export type CombineSetsInput = { readonly id: string; readonly name: string; readonly from: readonly string[] };

// Changes the selection with the given keys.
export type SelectInput = { readonly members: readonly ObjectKey[]; readonly mode?: SelectionMode | undefined };

// Selects the members of a named set.
export type SelectSetInput = { readonly id: string; readonly mode?: SelectionMode | undefined };

// Shows only the given objects.
export type IsolateInput = { readonly members: readonly ObjectKey[] };

// The whole selection vocabulary, stated once so a generated tool descriptor carries all of it.
export const selectionModeSchema: Schema<SelectionMode> = enumeration<SelectionMode>([
  'replace',
  'add',
  'remove',
  'toggle',
]);

const defineSetInput: Schema<DefineSetInput> = object({
  id: string(),
  name: string(),
  members: objectKeysSchema,
});

const setIdInput: Schema<SetIdInput> = object({ id: string() });

const combineSetsInput: Schema<CombineSetsInput> = object({
  id: string(),
  name: string(),
  from: array(string()),
});

const isolateInput: Schema<IsolateInput> = object({ members: objectKeysSchema });

const combined = (
  state: SetsState,
  from: readonly string[],
  fold: (a: ObjectSet, b: ObjectSet) => ObjectSet,
): Result<ObjectSet> => {
  const unknown = from.filter((id) => findSet(state, id) === undefined);
  if (unknown.length > 0)
    return failure([diagnostic('sets/unknown-set', `No set is named ${unknown.join(', ')}.`, ['from'])]);
  const first = from[0];
  if (first === undefined)
    return failure([diagnostic('sets/no-operands', 'Combining sets needs at least one named set.', ['from'])]);
  return success(from.slice(1).reduce((left, id) => fold(left, membersOf(state, id)), membersOf(state, first)));
};

const withSet = (state: SetsState, set: SavedSet): SetsState => ({
  ...state,
  sets: findSet(state, set.id) === undefined
    ? [...state.sets, set]
    : state.sets.map((item) => (item.id === set.id ? set : item)),
});

const combineCommand = (
  name: string,
  title: string,
  description: string,
  fold: (a: ObjectSet, b: ObjectSet) => ObjectSet,
): Command =>
  command<CombineSetsInput>({
    name,
    title,
    description,
    input: combineSetsInput,
    run: (session, input) => {
      const state = session.read(setsSlice);
      const members = combined(state, input.from, fold);
      if (!members.ok) return members;
      const set: SavedSet = { id: input.id, name: input.name, members: setKeys(members.value) };
      session.write(setsSlice, withSet(state, set));
      return success(set);
    },
  });

const selected = (current: readonly ObjectKey[], given: readonly ObjectKey[], mode: SelectionMode): ObjectSet => {
  const now = setOf(current);
  const next = setOf(given);
  if (mode === 'replace') return next;
  if (mode === 'add') return unionSets(now, next);
  if (mode === 'remove') return differenceSets(now, next);
  return unionSets(differenceSets(now, next), differenceSets(next, now));
};

const writeSelection = (session: Session, members: readonly ObjectKey[], mode: SelectionMode): Result<readonly ObjectKey[]> => {
  const state = session.read(setsSlice);
  const effect = editEffectOf(session);
  const next = setKeys(selected(state.selection, members, mode)).filter((key) => !effect.deleted.has(key));
  session.write(setsSlice, { ...state, selection: next });
  return success(next);
};

// Defines a named set, replacing one of the same id.
export const defineSetCommand: Command = command<DefineSetInput>({
  name: 'sets.define',
  title: 'Define a set',
  description: 'Defines a named set of objects, replacing any set of the same id.',
  input: defineSetInput,
  run: (session, input) => {
    const state = session.read(setsSlice);
    const set: SavedSet = { id: input.id, name: input.name, members: setKeys(setOf(input.members)) };
    session.write(setsSlice, withSet(state, set));
    return success(set);
  },
});

// Removes a named set. An unknown id is refused, not ignored.
export const removeSetCommand: Command = command<SetIdInput>({
  name: 'sets.remove',
  title: 'Remove a set',
  description: 'Removes one named set. The objects it held are untouched.',
  input: setIdInput,
  run: (session, input) => {
    const state = session.read(setsSlice);
    if (findSet(state, input.id) === undefined)
      return failure([diagnostic('sets/unknown-set', `There is no set named "${input.id}".`, ['id'])]);
    session.write(setsSlice, { ...state, sets: state.sets.filter((item) => item.id !== input.id) });
    return success(input.id);
  },
});

// Changes the selection. Objects an edit layer deleted are dropped as it is written.
export const selectCommand: Command = command<SelectInput>({
  name: 'sets.select',
  title: 'Select objects',
  description: 'Replaces, adds to, removes from or toggles the selection with the given objects.',
  input: object({ members: objectKeysSchema, mode: optional(selectionModeSchema) }),
  run: (session, input) => writeSelection(session, input.members, input.mode ?? 'replace'),
});

// Selects the members of a named set, which is what a table row click and a workflow result do.
export const selectSetCommand: Command = command<SelectSetInput>({
  name: 'sets.selectSet',
  title: 'Select a set',
  description: 'Puts the members of a named set into the selection.',
  input: object({ id: string(), mode: optional(selectionModeSchema) }),
  run: (session, input) => {
    const state = session.read(setsSlice);
    const found = findSet(state, input.id);
    if (found === undefined)
      return failure([diagnostic('sets/unknown-set', `There is no set named "${input.id}".`, ['id'])]);
    return writeSelection(session, found.members, input.mode ?? 'replace');
  },
});

// Defines a set as the union of named sets.
export const unionSetsCommand: Command = combineCommand(
  'sets.union',
  'Union of sets',
  'Defines a named set holding every object in any of the named sets.',
  unionSets,
);

// Defines a set as the intersection of named sets.
export const intersectSetsCommand: Command = combineCommand(
  'sets.intersect',
  'Intersection of sets',
  'Defines a named set holding the objects in every one of the named sets.',
  intersectSets,
);

// Defines a set as the first named set without the objects of the rest.
export const differenceSetsCommand: Command = combineCommand(
  'sets.difference',
  'Difference of sets',
  'Defines a named set holding the first named set without the objects of the others.',
  differenceSets,
);

// Shows only the given objects. An empty list hides everything, which is a state, not an error.
export const isolateCommand: Command = command<IsolateInput>({
  name: 'sets.isolate',
  title: 'Isolate objects',
  description: 'Shows only the given objects, leaving every other object out of the picture.',
  input: isolateInput,
  run: (session, input) => {
    const state = session.read(setsSlice);
    const members = setKeys(setOf(input.members));
    session.write(setsSlice, { ...state, isolated: members });
    return success(members);
  },
});

// Puts back everything isolation was hiding.
export const showAllCommand: Command = command({
  name: 'sets.showAll',
  title: 'Show everything',
  description: 'Ends isolation, so every object that is not hidden or deleted is shown again.',
  input: noInput,
  run: (session) => {
    const state = session.read(setsSlice);
    session.write(setsSlice, { ...state, isolated: null });
    return success(null);
  },
});

// Forgets every named set, the selection and the isolation.
export const clearSetsCommand: Command = command({
  name: 'sets.clear',
  title: 'Clear the sets',
  description: 'Removes every named set, empties the selection and ends isolation.',
  input: noInput,
  run: (session) => {
    session.write(setsSlice, noSetsState);
    return success(noSetsState);
  },
});

// The public command names of this feature.
export const setsCommands: readonly Command[] = [
  defineSetCommand,
  removeSetCommand,
  selectCommand,
  selectSetCommand,
  unionSetsCommand,
  intersectSetsCommand,
  differenceSetsCommand,
  isolateCommand,
  showAllCommand,
  clearSetsCommand,
];

// Named sets and the selection. It depends on the edit layers because a selection may not hold an
// object an edit deleted.
export const setsFeature: Feature<SetsState> = feature('sets', setsSlice, setsCommands, ['edits']);
