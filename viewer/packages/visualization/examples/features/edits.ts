import { composeAppearance, composeEdits, createEditHistory, commitEditHistory, undoEditHistory, redoEditHistory, objectKey, type EditOperation, type ObjectRecord, type Matrix4 } from '../../src/index.js';
import type { FeatureDemo } from '../gallery/contracts.js';

export const editsDemo: FeatureDemo = {
  id: 'edits', title: 'Edit transactions and undo',
  description: 'Select Snowdon objects, hide or move them, then undo and redo complete transactions. The loaded model stays unchanged.',
  source: 'examples/features/edits.ts', tests: 'test/edits.test.ts · test/appearance.test.ts',
  mount(context) {
    let history = createEditHistory();
    let serial = 0;
    const refresh = () => {
      const edited = composeEdits(context.base, history.present);
      context.update(composeAppearance(edited.objects, { selection: context.selection.snapshot(), selectionColor: [0.05, 0.95, 0.5] }));
      undo.disabled = !history.past.length; redo.disabled = !history.future.length;
      context.status(`${context.selection.snapshot().length} selected · ${history.present.length} transactions · move uses +1 scene coordinate on X (source units may be unknown).`);
    };
    const edit = (operation: (object: ObjectRecord) => EditOperation) => {
      const selected = new Set(context.selection.snapshot().map(objectKey));
      const objects = composeEdits(context.base, history.present).objects.filter(object => selected.has(objectKey(object.ref)));
      if (!objects.length) { context.status('Pick an object, or select the first object, before editing.'); return; }
      history = commitEditHistory(history, [...history.present, { id: `edit-${++serial}`, enabled: true, operations: objects.map(operation) }]);
      refresh();
    };
    context.button('Select first rendered object', () => {
      for (const group of context.viewer.scene.groups) {
        const binding = context.render.resolveInstance(group, 0);
        if (binding) { context.selection.replace([binding.ref]); return; }
      }
      context.status('No rendered object is available to select.');
    });
    context.button('Hide selected', () => edit(object => ({ kind: 'style', ref: object.ref, style: { visible: false } })));
    context.button('Move selected +X', () => edit(object => ({ kind: 'transform', ref: object.ref, transform: object.transform.map((value, index) => index === 12 ? value + 1 : value) as unknown as Matrix4 })));
    const undo = context.button('Undo', () => { history = undoEditHistory(history); refresh(); });
    const redo = context.button('Redo', () => { history = redoEditHistory(history); refresh(); });
    context.button('Reset edits demo', () => { context.reset(); });
    const unsubscribe = context.selection.subscribe(refresh);
    refresh();
    return unsubscribe;
  },
};
