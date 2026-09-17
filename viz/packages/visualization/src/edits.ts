import { objectKey, type Diagnostic, type EditLayer, type ObjectRecord, type ObjectRef } from './contracts.js';

export type ComposedEdits = {
  readonly objects: readonly ObjectRecord[];
  readonly tombstones: readonly ObjectRef[];
  readonly diagnostics: readonly Diagnostic[];
};

/** Enabled layers apply in order. Deletion is terminal within a composition. */
export function composeEdits(base: readonly ObjectRecord[], layers: readonly EditLayer[]): ComposedEdits {
  const objects = new Map<string, ObjectRecord>();
  const tombstones = new Map<string, ObjectRef>();
  const diagnostics: Diagnostic[] = [];
  const report = (code: string, ref: ObjectRef, message: string) => diagnostics.push({ code, ref, message });
  for (const object of base) {
    const key = objectKey(object.ref);
    if (objects.has(key)) report('duplicate-object', object.ref, 'Duplicate base object; first record retained');
    else objects.set(key, object);
  }
  for (const layer of layers) {
    if (!layer.enabled) continue;
    for (const operation of layer.operations) {
      const ref = operation.kind === 'add' ? operation.object.ref : operation.ref;
      const key = objectKey(ref);
      if (tombstones.has(key)) {
        report('deleted-object', ref, 'Operation targets an object deleted by an earlier operation');
        continue;
      }
      const object = objects.get(key);
      if (operation.kind === 'add') {
        if (object) report('duplicate-object', ref, 'Add conflicts with an existing object');
        else objects.set(key, operation.object);
      } else if (!object) {
        report('unknown-object', ref, 'Operation targets an unknown object');
      } else if (operation.kind === 'delete') {
        objects.delete(key);
        tombstones.set(key, ref);
      } else if (operation.kind === 'transform') {
        objects.set(key, { ...object, transform: operation.transform });
      } else {
        objects.set(key, { ...object, appearance: { ...object.appearance, ...operation.style } });
      }
    }
  }
  return { objects: [...objects.values()], tombstones: [...tombstones.values()], diagnostics };
}

export type EditHistory = {
  readonly past: readonly (readonly EditLayer[])[];
  readonly present: readonly EditLayer[];
  readonly future: readonly (readonly EditLayer[])[];
};

/** Snapshot complete transactions so subsequent caller edits cannot alter history. */
export function createEditHistory(initial: readonly EditLayer[] = []): EditHistory {
  return { past: [], present: structuredClone(initial), future: [] };
}

export function commitEditHistory(history: EditHistory, layers: readonly EditLayer[]): EditHistory {
  return { past: [...history.past, history.present], present: structuredClone(layers), future: [] };
}

export function undoEditHistory(history: EditHistory): EditHistory {
  const previous = history.past.at(-1);
  return previous === undefined ? history : {
    past: history.past.slice(0, -1), present: previous, future: [history.present, ...history.future],
  };
}

export function redoEditHistory(history: EditHistory): EditHistory {
  const next = history.future[0];
  return next === undefined ? history : {
    past: [...history.past, history.present], present: next, future: history.future.slice(1),
  };
}
