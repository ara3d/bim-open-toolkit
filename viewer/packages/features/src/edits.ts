// Edit layers, and undo and redo over them.
//
// A layer is an ordered group of hide, delete, transform and colour operations addressed by object
// key, so the whole edit state is plain data a saved document carries and replaying it against the
// same base gives the same scene. Undo works over whole immutable states, which is why a reversal
// is exact and why restoring an edited object never rebuilds batch geometry: the layers change,
// the model's meshes do not.
//
// Every command that changes the layers commits to the history, so the transaction boundary is one
// command. That includes switching a layer on and off, which is what makes a layer toggle
// reversible in the same way an edit is.

import {
  array,
  boolean,
  command,
  commit,
  diagnostic,
  editLayer,
  failure,
  feature,
  history,
  literal,
  object,
  optional,
  redo,
  resolveEdits,
  setLayerEnabled,
  stateSlice,
  string,
  success,
  undo,
  union,
  type Command,
  type EditEffect,
  type EditHistory,
  type EditLayer,
  type EditOperation,
  type EditState,
  type Feature,
  type Migration,
  type Result,
  type Schema,
  type Session,
  type StateSlice,
} from '@bim-open-toolkit/model';
import {
  appearanceChangeSchema,
  matrix4Schema,
  noInput,
  objectKeysSchema,
} from './appearance-schemas.js';

// One operation of a layer. The four kinds are the model package's own.
export const editOperationSchema: Schema<EditOperation> = union<EditOperation>(
  object({ kind: literal('hide'), targets: objectKeysSchema }),
  object({ kind: literal('delete'), targets: objectKeysSchema }),
  object({ kind: literal('transform'), targets: objectKeysSchema, transform: matrix4Schema }),
  object({ kind: literal('color'), targets: objectKeysSchema, change: appearanceChangeSchema }),
);

// A named, switchable group of operations.
export const editLayerSchema: Schema<EditLayer> = object({
  id: string(),
  name: string(),
  enabled: boolean(),
  operations: array(editOperationSchema),
});

// The ordered layers of a scene, earliest first.
export const editStateSchema: Schema<EditState> = array(editLayerSchema);

// Past states, the present one and the states an undo put aside.
export const editHistorySchema: Schema<EditHistory> = object({
  past: array(editStateSchema),
  present: editStateSchema,
  future: array(editStateSchema),
});

// What the edits feature owns: one history of the whole layer stack.
export type EditsState = { readonly history: EditHistory };

// The saved shape of the edits feature.
export const editsStateSchema: Schema<EditsState> = object({ history: editHistorySchema });

// Nothing edited and nothing to undo.
export const noEditsState: EditsState = { history: history<EditState>([]) };

// Version 1 has nothing to migrate from; a later version adds its step here.
export const editsMigrations: readonly Migration[] = [];

// The edit layers and their history, as a document holds them.
export const editsSlice: StateSlice<EditsState> = stateSlice(
  'edits',
  1,
  editsStateSchema,
  noEditsState,
  editsMigrations,
);

// The layers in force right now.
export const editLayers = (state: EditsState): EditState => state.history.present;

// What the enabled layers do to each object: what is deleted, hidden, moved and restyled.
export const editEffect = (state: EditsState): EditEffect => resolveEdits(editLayers(state));

// The same, read straight from a session, which is what a composition needs.
export const editEffectOf = (session: Session): EditEffect => editEffect(session.read(editsSlice));

// Adds an operation to a layer, creating the layer at the end of the stack when it is not there.
export type ApplyEditInput = {
  readonly layerId: string;
  readonly name?: string | undefined;
  readonly operation: EditOperation;
};

// Names a layer.
export type LayerInput = { readonly id: string };

// Switches a layer on or off.
export type EnableLayerInput = { readonly id: string; readonly enabled: boolean };

const applyEditInput: Schema<ApplyEditInput> = object({
  layerId: string(),
  name: optional(string()),
  operation: editOperationSchema,
});

const layerInput: Schema<LayerInput> = object({ id: string() });

const enableLayerInput: Schema<EnableLayerInput> = object({ id: string(), enabled: boolean() });

const put = (session: Session, next: EditState): Result<EditState> => {
  const state = session.read(editsSlice);
  session.write(editsSlice, { history: commit(state.history, next) });
  return success(next);
};

const withOperation = (state: EditState, input: ApplyEditInput): EditState => {
  const found = state.some((layer) => layer.id === input.layerId);
  if (!found)
    return [...state, editLayer(input.layerId, input.name ?? input.layerId, [input.operation])];
  return state.map((layer) =>
    layer.id === input.layerId
      ? { ...layer, operations: [...layer.operations, input.operation] }
      : layer,
  );
};

// Adds one operation to a layer and commits it, so the single operation is what an undo reverses.
export const applyEditCommand: Command = command<ApplyEditInput>({
  name: 'edits.apply',
  title: 'Apply an edit',
  description: 'Adds one hide, delete, transform or colour operation to an edit layer.',
  input: applyEditInput,
  run: (session, input) => put(session, withOperation(session.read(editsSlice).history.present, input)),
});

// Adds an empty layer at the top of the stack. A repeated id is refused, never merged.
export const addLayerCommand: Command = command<{ readonly id: string; readonly name: string }>({
  name: 'edits.addLayer',
  title: 'Add an edit layer',
  description: 'Adds an empty, enabled edit layer at the top of the stack.',
  input: object({ id: string(), name: string() }),
  run: (session, input) => {
    const present = session.read(editsSlice).history.present;
    if (present.some((layer) => layer.id === input.id))
      return failure([diagnostic('edits/repeated-layer', `A layer named "${input.id}" is already there.`, ['id'])]);
    return put(session, [...present, editLayer(input.id, input.name, [])]);
  },
});

// Takes a layer out of the stack. An unknown id is refused rather than silently doing nothing.
export const removeLayerCommand: Command = command<LayerInput>({
  name: 'edits.removeLayer',
  title: 'Remove an edit layer',
  description: 'Takes one edit layer, and everything it did, out of the stack.',
  input: layerInput,
  run: (session, input) => {
    const present = session.read(editsSlice).history.present;
    if (!present.some((layer) => layer.id === input.id))
      return failure([diagnostic('edits/unknown-layer', `There is no layer named "${input.id}".`, ['id'])]);
    return put(session, present.filter((layer) => layer.id !== input.id));
  },
});

// Switches a layer on or off, reversibly. An unknown id is refused.
export const enableLayerCommand: Command = command<EnableLayerInput>({
  name: 'edits.enableLayer',
  title: 'Enable or disable an edit layer',
  description: 'Switches one edit layer on or off without losing what it holds.',
  input: enableLayerInput,
  run: (session, input) => {
    const present = session.read(editsSlice).history.present;
    if (!present.some((layer) => layer.id === input.id))
      return failure([diagnostic('edits/unknown-layer', `There is no layer named "${input.id}".`, ['id'])]);
    return put(session, setLayerEnabled(present, input.id, input.enabled));
  },
});

// Goes back one command. With nothing to undo it reports that and leaves the state alone.
export const undoCommand: Command = command({
  name: 'edits.undo',
  title: 'Undo',
  description: 'Returns the edit layers to the state before the last edit command.',
  input: noInput,
  run: (session) => {
    const state = session.read(editsSlice);
    const next = undo(state.history);
    if (next === state.history)
      return success(state.history.present, [
        diagnostic('edits/nothing-to-undo', 'There is nothing to undo.', [], 'info'),
      ]);
    session.write(editsSlice, { history: next });
    return success(next.present);
  },
});

// Reapplies what an undo put aside. With nothing to redo it reports that and changes nothing.
export const redoCommand: Command = command({
  name: 'edits.redo',
  title: 'Redo',
  description: 'Reapplies the edit state the last undo put aside.',
  input: noInput,
  run: (session) => {
    const state = session.read(editsSlice);
    const next = redo(state.history);
    if (next === state.history)
      return success(state.history.present, [
        diagnostic('edits/nothing-to-redo', 'There is nothing to redo.', [], 'info'),
      ]);
    session.write(editsSlice, { history: next });
    return success(next.present);
  },
});

// Drops every layer and the whole history, which is what closing a document does.
export const clearEditsCommand: Command = command({
  name: 'edits.clear',
  title: 'Clear the edits',
  description: 'Removes every edit layer and forgets the undo history.',
  input: noInput,
  run: (session) => {
    session.write(editsSlice, noEditsState);
    return success(noEditsState.history.present);
  },
});

// The public command names of this feature, in the order a UI usually offers them.
export const editsCommands: readonly Command[] = [
  applyEditCommand,
  addLayerCommand,
  removeLayerCommand,
  enableLayerCommand,
  undoCommand,
  redoCommand,
  clearEditsCommand,
];

// Layered edits with undo and redo. It depends on nothing: the layers are the base of the
// composition every other feature reads.
export const editsFeature: Feature<EditsState> = feature('edits', editsSlice, editsCommands);
