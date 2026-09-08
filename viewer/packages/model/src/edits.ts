import type { ObjectKey } from './identity.js';
import { identityMatrix, multiplyMatrix, type Matrix4 } from './math.js';
import { emptySet, setOf, unionSets, type ObjectSet } from './sets.js';
import type { AppearanceChange } from './style.js';

// One change to the base model, naming the objects it applies to by key.
// Targets are keys rather than sets so a layer is plain data a saved document can hold.
export type EditOperation =
  | { readonly kind: 'hide'; readonly targets: readonly ObjectKey[] }
  | { readonly kind: 'delete'; readonly targets: readonly ObjectKey[] }
  | { readonly kind: 'transform'; readonly targets: readonly ObjectKey[]; readonly transform: Matrix4 }
  | { readonly kind: 'color'; readonly targets: readonly ObjectKey[]; readonly change: AppearanceChange };

// A named, switchable group of changes. Layers apply in order; a disabled layer changes nothing.
export type EditLayer = {
  readonly id: string;
  readonly name: string;
  readonly enabled: boolean;
  readonly operations: readonly EditOperation[];
};

// The edit state of a scene: the ordered layers, earliest first.
export type EditState = readonly EditLayer[];

// What the enabled layers do to each object, ready for composition into a style.
// Deleted objects are gone; hidden ones exist but do not draw; transforms compose in layer order.
export type EditEffect = {
  readonly deleted: ObjectSet;
  readonly hidden: ObjectSet;
  readonly transforms: ReadonlyMap<ObjectKey, Matrix4>;
  readonly appearance: ReadonlyMap<ObjectKey, AppearanceChange>;
};

// Undo and redo over whole immutable states. Reversal is exact because no state is ever mutated.
export type History<S> = {
  readonly past: readonly S[];
  readonly present: S;
  readonly future: readonly S[];
};

// The history of edit layers a scene carries.
export type EditHistory = History<EditState>;

// An edit layer with the given operations, enabled.
export const editLayer = (id: string, name: string, operations: readonly EditOperation[]): EditLayer => ({
  id,
  name,
  enabled: true,
  operations,
});

// Hides the objects: they stay in the model and can be shown again.
export const hideObjects = (targets: readonly ObjectKey[]): EditOperation => ({ kind: 'hide', targets });

// Removes the objects from the composed scene. Selection never brings them back.
export const deleteObjects = (targets: readonly ObjectKey[]): EditOperation => ({ kind: 'delete', targets });

// Moves the objects by a transform applied after any transform an earlier layer gave them.
export const transformObjects = (targets: readonly ObjectKey[], transform: Matrix4): EditOperation => ({
  kind: 'transform',
  targets,
  transform,
});

// Changes how the objects look, over whatever the base and earlier layers gave them.
export const colorObjects = (targets: readonly ObjectKey[], change: AppearanceChange): EditOperation => ({
  kind: 'color',
  targets,
  change,
});

// The layers in order with the given one appended last, so it applies over the others.
export const addLayer = (state: EditState, layer: EditLayer): EditState => [...state, layer];

// The layers without the named one. Unknown ids leave the state unchanged.
export const removeLayer = (state: EditState, id: string): EditState => state.filter((layer) => layer.id !== id);

// The layers with the named one replaced by the result of the change.
export const updateLayer = (state: EditState, id: string, change: (layer: EditLayer) => EditLayer): EditState =>
  state.map((layer) => (layer.id === id ? change(layer) : layer));

// The layers with the named one switched on or off.
export const setLayerEnabled = (state: EditState, id: string, enabled: boolean): EditState =>
  updateLayer(state, id, (layer) => ({ ...layer, enabled }));

// The layers that apply, in order.
export const enabledLayers = (state: EditState): readonly EditLayer[] => state.filter((layer) => layer.enabled);

// What the enabled layers do, applied in order so a later layer wins over an earlier one.
export const resolveEdits = (state: EditState): EditEffect => {
  const transforms = new Map<ObjectKey, Matrix4>();
  const appearance = new Map<ObjectKey, AppearanceChange>();
  let deleted = emptySet;
  let hidden = emptySet;
  for (const layer of enabledLayers(state)) {
    for (const operation of layer.operations) {
      if (operation.kind === 'delete') deleted = unionSets(deleted, setOf(operation.targets));
      else if (operation.kind === 'hide') hidden = unionSets(hidden, setOf(operation.targets));
      else if (operation.kind === 'transform')
        for (const key of operation.targets)
          transforms.set(key, multiplyMatrix(operation.transform, transforms.get(key) ?? identityMatrix));
      else
        for (const key of operation.targets)
          appearance.set(key, { ...appearance.get(key), ...operation.change });
    }
  }
  return { deleted, hidden, transforms, appearance };
};

// The transform an object carries from the edits, or the identity when no layer moved it.
export const editedTransform = (effect: EditEffect, key: ObjectKey): Matrix4 =>
  effect.transforms.get(key) ?? identityMatrix;

// True when an edit layer removed the object from the scene.
export const isDeleted = (effect: EditEffect, key: ObjectKey): boolean => effect.deleted.has(key);

// True when an edit layer hid the object.
export const isHidden = (effect: EditEffect, key: ObjectKey): boolean => effect.hidden.has(key);

// Edits that change nothing.
export const noEdits: EditEffect = {
  deleted: emptySet,
  hidden: emptySet,
  transforms: new Map(),
  appearance: new Map(),
};

// A history holding one state and nothing to undo or redo.
export const history = <S>(present: S): History<S> => ({ past: [], present, future: [] });

// The history with a new present. Anything that was undone is dropped, as a new branch replaces it.
export const commit = <S>(record: History<S>, present: S): History<S> => ({
  past: [...record.past, record.present],
  present,
  future: [],
});

// True when there is an earlier state to return to.
export const canUndo = <S>(record: History<S>): boolean => record.past.length > 0;

// True when an undone state can be reapplied.
export const canRedo = <S>(record: History<S>): boolean => record.future.length > 0;

// The history one step back, or the same history when there is nothing to undo.
export const undo = <S>(record: History<S>): History<S> => {
  const previous = record.past[record.past.length - 1];
  return previous === undefined
    ? record
    : { past: record.past.slice(0, -1), present: previous, future: [record.present, ...record.future] };
};

// The history one step forward, or the same history when there is nothing to redo.
export const redo = <S>(record: History<S>): History<S> => {
  const next = record.future[0];
  return next === undefined
    ? record
    : { past: [...record.past, record.present], present: next, future: record.future.slice(1) };
};

// The history with everything before the present forgotten, keeping the present.
export const clearHistory = <S>(record: History<S>): History<S> => history(record.present);

// The empty edit history a new scene starts from.
export const emptyEditHistory: EditHistory = history([]);
