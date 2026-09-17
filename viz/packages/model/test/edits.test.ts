import { describe, expect, it } from 'vitest';
import {
  addLayer, canRedo, canUndo, clearHistory, colorObjects, commit, deleteObjects, editLayer,
  editedTransform, emptyEditHistory, enabledLayers, hideObjects, history, isDeleted, isHidden, noEdits,
  redo, removeLayer, resolveEdits, setLayerEnabled, transformObjects, undo, updateLayer,
  type EditState,
} from '../src/edits.js';
import { identityMatrix, translation } from '../src/math.js';
import { setKeys } from '../src/sets.js';

const moved = translation([1, 0, 0]);
const movedAgain = translation([0, 2, 0]);

const layers: EditState = [
  editLayer('l1', 'Demolition', [deleteObjects(['a']), hideObjects(['b'])]),
  editLayer('l2', 'Relocation', [transformObjects(['c'], moved), colorObjects(['c'], { color: [1, 0, 0] })]),
];

describe('edit layers', () => {
  it('adds, removes, updates and switches layers without changing the input', () => {
    const added = addLayer(layers, editLayer('l3', 'Notes', []));
    expect(added.map((layer) => layer.id)).toEqual(['l1', 'l2', 'l3']);
    expect(layers.map((layer) => layer.id)).toEqual(['l1', 'l2']);
    expect(removeLayer(layers, 'l1').map((layer) => layer.id)).toEqual(['l2']);
    expect(removeLayer(layers, 'missing')).toEqual(layers);
    expect(updateLayer(layers, 'l1', (layer) => ({ ...layer, name: 'Strip out' }))[0]?.name).toBe('Strip out');
    expect(enabledLayers(setLayerEnabled(layers, 'l1', false)).map((layer) => layer.id)).toEqual(['l2']);
  });

  it('resolves what the enabled layers do to each object', () => {
    const effect = resolveEdits(layers);
    expect(setKeys(effect.deleted)).toEqual(['a']);
    expect(setKeys(effect.hidden)).toEqual(['b']);
    expect(isDeleted(effect, 'a')).toBe(true);
    expect(isHidden(effect, 'b')).toBe(true);
    expect(editedTransform(effect, 'c')).toEqual(moved);
    expect(effect.appearance.get('c')).toEqual({ color: [1, 0, 0] });
  });

  it('ignores a disabled layer', () => {
    const effect = resolveEdits(setLayerEnabled(layers, 'l1', false));
    expect(setKeys(effect.deleted)).toEqual([]);
    expect(isHidden(effect, 'b')).toBe(false);
  });

  it('composes transforms in layer order, later after earlier', () => {
    const two = addLayer(layers, editLayer('l3', 'Nudge', [transformObjects(['c'], movedAgain)]));
    expect(editedTransform(resolveEdits(two), 'c')).toEqual(translation([1, 2, 0]));
  });

  it('merges appearance changes, later winning per property', () => {
    const two = addLayer(layers, editLayer('l3', 'Fade', [colorObjects(['c'], { opacity: 0.5 })]));
    expect(resolveEdits(two).appearance.get('c')).toEqual({ color: [1, 0, 0], opacity: 0.5 });
  });

  it('gives the identity transform and no change for an untouched object', () => {
    expect(editedTransform(resolveEdits(layers), 'z')).toEqual(identityMatrix);
    expect(editedTransform(noEdits, 'z')).toEqual(identityMatrix);
    expect(isDeleted(noEdits, 'z')).toBe(false);
  });
});

describe('history', () => {
  it('starts with nothing to undo or redo', () => {
    expect(canUndo(emptyEditHistory)).toBe(false);
    expect(canRedo(emptyEditHistory)).toBe(false);
    expect(emptyEditHistory.present).toEqual([]);
  });

  it('returns to an earlier state and back again', () => {
    const first = commit(history('a'), 'b');
    const second = commit(first, 'c');
    expect(second.present).toBe('c');
    expect(undo(second).present).toBe('b');
    expect(undo(undo(second)).present).toBe('a');
    expect(redo(undo(second)).present).toBe('c');
    expect(canUndo(second)).toBe(true);
    expect(canRedo(undo(second))).toBe(true);
  });

  it('stands still at the ends rather than failing', () => {
    const start = history('a');
    expect(undo(start)).toBe(start);
    expect(redo(start)).toBe(start);
  });

  it('drops what was undone once a new state is committed', () => {
    const branched = commit(undo(commit(history('a'), 'b')), 'c');
    expect(branched.present).toBe('c');
    expect(canRedo(branched)).toBe(false);
    expect(branched.past).toEqual(['a']);
  });

  it('forgets the past while keeping the present', () => {
    const cleared = clearHistory(commit(history('a'), 'b'));
    expect(cleared.present).toBe('b');
    expect(canUndo(cleared)).toBe(false);
  });

  it('leaves every earlier state untouched, so undo restores exactly', () => {
    const first = history(layers);
    const second = commit(first, addLayer(layers, editLayer('l3', 'Notes', [])));
    expect(undo(second).present).toBe(layers);
    expect(first.present).toBe(layers);
  });
});
