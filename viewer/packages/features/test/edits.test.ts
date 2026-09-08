import { describe, expect, it } from 'vitest';
import {
  canRedo,
  canUndo,
  emptyDocument,
  getSlice,
  hasErrors,
  history,
  identityMatrix,
  parseDocument,
  putSlice,
  translation,
  type EditState,
} from '@bim-open-toolkit/model';
import {
  editEffect,
  editLayers,
  editsFeature,
  editsSlice,
  noEditsState,
  type EditsState,
} from '../src/edits.js';
import { appearanceFeatureFor, resolveAppearance } from '../src/appearance.js';
import { boundScene, featureSession, fixtureKeys, key, stored } from './appearance-fixture.js';

const hide = (targets: readonly string[]) => ({ kind: 'hide', targets });

describe('the edits slice', () => {
  it('round-trips through a document as JSON, layers and history alike', () => {
    const layers: EditState = [
      {
        id: 'presentation',
        name: 'Presentation',
        enabled: true,
        operations: [
          { kind: 'hide', targets: [key(0)] },
          { kind: 'delete', targets: [key(1)] },
          { kind: 'transform', targets: [key(2)], transform: translation([1, 2, 3]) },
          { kind: 'color', targets: [key(2)], change: { color: [1, 0, 0], opacity: 0.25 } },
        ],
      },
    ];
    const state: EditsState = { history: { past: [[]], present: layers, future: [] } };
    const document = putSlice(emptyDocument(), editsSlice, state);
    const parsed = parseDocument(JSON.parse(JSON.stringify(document)));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const read = getSlice(parsed.value, editsSlice);
    expect(read.ok && read.value).toEqual(state);
  });

  it('reads an absent slice as no layers and nothing to undo', () => {
    const read = getSlice(emptyDocument(), editsSlice);
    expect(read.ok && read.value).toEqual(noEditsState);
    expect(hasErrors(read.diagnostics)).toBe(false);
  });

  it('refuses an operation kind it does not know', () => {
    const broken = {
      ...emptyDocument(),
      slices: {
        edits: {
          version: 1,
          value: {
            history: {
              past: [],
              present: [{ id: 'a', name: 'a', enabled: true, operations: [{ kind: 'explode', targets: [] }] }],
              future: [],
            },
          },
        },
      },
    };
    expect(getSlice(broken, editsSlice).ok).toBe(false);
  });

  it('refuses a transform that is not sixteen finite numbers', () => {
    const state = {
      history: history<EditState>([
        { id: 'a', name: 'a', enabled: true, operations: [{ kind: 'transform', targets: [key(0)], transform: identityMatrix }] },
      ]),
    };
    const document = putSlice(emptyDocument(), editsSlice, state);
    const broken = JSON.parse(JSON.stringify(document));
    broken.slices.edits.value.history.present[0].operations[0].transform = [1, 2, 3];
    expect(getSlice(broken, editsSlice).ok).toBe(false);
  });
});

describe('the edit commands', () => {
  it('creates a layer on first use and appends to it after', () => {
    const session = featureSession();
    expect(session.dispatch('edits.apply', { layerId: 'demo', name: 'Demo', operation: hide([key(0)]) }).ok).toBe(true);
    expect(session.events).toContain('edits.apply:edits');
    session.dispatch('edits.apply', { layerId: 'demo', operation: hide([key(1)]) });
    const layers = editLayers(session.read(editsSlice));
    expect(layers).toHaveLength(1);
    expect(layers[0]?.name).toBe('Demo');
    expect(layers[0]?.operations).toHaveLength(2);
  });

  it('refuses an input its schema does not accept', () => {
    const session = featureSession();
    const bad = session.dispatch('edits.apply', { layerId: 'demo', operation: { kind: 'hide' } });
    expect(bad.ok).toBe(false);
    expect(session.read(editsSlice)).toEqual(noEditsState);
  });

  it('refuses a repeated layer id and an unknown one', () => {
    const session = featureSession();
    session.dispatch('edits.addLayer', { id: 'a', name: 'A' });
    const again = session.dispatch('edits.addLayer', { id: 'a', name: 'A' });
    expect(again.ok).toBe(false);
    expect(again.diagnostics[0]?.code).toBe('edits/repeated-layer');
    expect(session.dispatch('edits.removeLayer', { id: 'z' }).diagnostics[0]?.code).toBe('edits/unknown-layer');
    expect(session.dispatch('edits.enableLayer', { id: 'z', enabled: false }).diagnostics[0]?.code).toBe(
      'edits/unknown-layer',
    );
  });

  it('switches a layer off without losing what it holds', () => {
    const session = featureSession();
    session.dispatch('edits.apply', { layerId: 'a', operation: hide([key(0)]) });
    session.dispatch('edits.enableLayer', { id: 'a', enabled: false });
    expect(editLayers(session.read(editsSlice))[0]?.operations).toHaveLength(1);
    expect(editEffect(session.read(editsSlice)).hidden.size).toBe(0);
    session.dispatch('edits.enableLayer', { id: 'a', enabled: true });
    expect(editEffect(session.read(editsSlice)).hidden.size).toBe(1);
  });

  it('composes two layers in order, the later winning', () => {
    const session = featureSession();
    session.dispatch('edits.apply', { layerId: 'a', operation: { kind: 'color', targets: [key(0)], change: { color: [1, 0, 0] } } });
    session.dispatch('edits.apply', { layerId: 'b', operation: { kind: 'color', targets: [key(0)], change: { color: [0, 1, 0] } } });
    expect(editEffect(session.read(editsSlice)).appearance.get(key(0))?.color).toEqual([0, 1, 0]);
  });
});

describe('undo and redo', () => {
  it('reverses one command at a time and reapplies it', () => {
    const session = featureSession();
    session.dispatch('edits.apply', { layerId: 'a', operation: hide([key(0)]) });
    session.dispatch('edits.apply', { layerId: 'a', operation: hide([key(1)]) });
    expect(editEffect(session.read(editsSlice)).hidden.size).toBe(2);
    session.dispatch('edits.undo', {});
    expect(editEffect(session.read(editsSlice)).hidden.size).toBe(1);
    session.dispatch('edits.undo', {});
    expect(editLayers(session.read(editsSlice))).toEqual([]);
    session.dispatch('edits.redo', {});
    expect(editEffect(session.read(editsSlice)).hidden.size).toBe(1);
  });

  it('reports having nothing to undo or redo rather than pretending it did something', () => {
    const session = featureSession();
    const nothing = session.dispatch('edits.undo', {});
    expect(nothing.ok).toBe(true);
    expect(nothing.diagnostics[0]?.code).toBe('edits/nothing-to-undo');
    expect(session.events).toContain('edits.undo:');
    expect(session.dispatch('edits.redo', {}).diagnostics[0]?.code).toBe('edits/nothing-to-redo');
  });

  it('drops the redo branch when a new edit follows an undo', () => {
    const session = featureSession();
    session.dispatch('edits.apply', { layerId: 'a', operation: hide([key(0)]) });
    session.dispatch('edits.undo', {});
    session.dispatch('edits.apply', { layerId: 'b', operation: hide([key(1)]) });
    expect(canRedo(session.read(editsSlice).history)).toBe(false);
    expect(canUndo(session.read(editsSlice).history)).toBe(true);
    expect(editLayers(session.read(editsSlice)).map((layer) => layer.id)).toEqual(['b']);
  });

  it('reverses a layer being switched off, because that is a command too', () => {
    const session = featureSession();
    session.dispatch('edits.apply', { layerId: 'a', operation: hide([key(0)]) });
    session.dispatch('edits.enableLayer', { id: 'a', enabled: false });
    session.dispatch('edits.undo', {});
    expect(editLayers(session.read(editsSlice))[0]?.enabled).toBe(true);
  });

  it('forgets the history when the edits are cleared', () => {
    const session = featureSession();
    session.dispatch('edits.apply', { layerId: 'a', operation: hide([key(0)]) });
    session.dispatch('edits.clear', {});
    expect(session.read(editsSlice)).toEqual(noEditsState);
    expect(canUndo(session.read(editsSlice).history)).toBe(false);
  });
});

describe('edits in the composition', () => {
  it('leaves a deleted object out of the resolution altogether', () => {
    const session = featureSession();
    session.dispatch('edits.apply', { layerId: 'a', operation: { kind: 'delete', targets: [key(1)] } });
    const resolved = resolveAppearance(session, fixtureKeys);
    expect(resolved.deleted.has(key(1))).toBe(true);
    expect(resolved.byKey.has(key(1))).toBe(false);
  });

  it('lets a rule win over an edit layer colour, which is the M1 order', () => {
    const session = featureSession();
    session.dispatch('edits.apply', { layerId: 'a', operation: { kind: 'color', targets: [key(0)], change: { color: [1, 0, 0] } } });
    session.dispatch('appearance.addRule', {
      rule: { id: 'r', name: 'r', enabled: true, priority: 0, targets: [key(0)], change: { color: [0, 0, 1] } },
    });
    expect(resolveAppearance(session, fixtureKeys).byKey.get(key(0))?.color).toEqual([0, 0, 1]);
  });
});

describe('the edits render hook', () => {
  it('hides an object in the bound scene and an undo brings it back unchanged', () => {
    const scene = boundScene();
    const session = featureSession();
    const stop = appearanceFeatureFor(scene.target).install?.(session);
    session.dispatch('appearance.addRule', {
      rule: { id: 'r', name: 'r', enabled: true, priority: 0, targets: [key(1)], change: { color: [1, 0, 0] } },
    });
    expect(scene.colorOf(1).slice(0, 3)).toEqual(stored([1, 0, 0]));
    session.dispatch('edits.apply', { layerId: 'a', operation: hide([key(1)]) });
    expect(scene.shown(1)).toBe(false);
    expect(scene.shown(0)).toBe(true);
    session.dispatch('edits.undo', {});
    expect(scene.shown(1)).toBe(true);
    expect(scene.colorOf(1).slice(0, 3)).toEqual(stored([1, 0, 0]));
    stop?.dispose();
  });

  it('leaves the other instances of the same mesh alone', () => {
    const scene = boundScene();
    const session = featureSession();
    const stop = appearanceFeatureFor(scene.target).install?.(session);
    session.dispatch('edits.apply', { layerId: 'a', operation: { kind: 'color', targets: [key(0)], change: { color: [0, 0, 1] } } });
    expect(scene.colorOf(0).slice(0, 3)).toEqual(stored([0, 0, 1]));
    expect(scene.colorOf(1).slice(0, 3)).toEqual(stored([0.8, 0.8, 0.8]));
    expect(scene.colorOf(2).slice(0, 3)).toEqual(stored([0.8, 0.8, 0.8]));
    stop?.dispose();
  });

  it('writes nothing when a layer is toggled off and on again', () => {
    const scene = boundScene();
    const session = featureSession();
    const stop = appearanceFeatureFor(scene.target).install?.(session);
    session.dispatch('edits.apply', { layerId: 'a', operation: hide([key(1)]) });
    session.dispatch('edits.enableLayer', { id: 'a', enabled: false });
    session.dispatch('edits.enableLayer', { id: 'a', enabled: true });
    const again = scene.binding.applyStyles('fa-fixture', resolveAppearance(session, fixtureKeys));
    expect(again.ok && again.value.rowsWritten).toBe(0);
    stop?.dispose();
  });
});

describe('the edits feature', () => {
  it('owns one slice, depends on nothing and names its commands', () => {
    expect(editsFeature.id).toBe('edits');
    expect(editsFeature.slice.version).toBe(1);
    expect(editsFeature.dependsOn).toEqual([]);
    expect(editsFeature.commands.map((item) => item.name)).toEqual([
      'edits.apply',
      'edits.addLayer',
      'edits.removeLayer',
      'edits.enableLayer',
      'edits.undo',
      'edits.redo',
      'edits.clear',
    ]);
  });
});
