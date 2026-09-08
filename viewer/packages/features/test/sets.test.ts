import { describe, expect, it } from 'vitest';
import {
  emptyDocument,
  getSlice,
  hasErrors,
  parseDocument,
  putSlice,
  setKeys,
  styleRule,
} from '@bim-open-toolkit/model';
import {
  effectiveSelection,
  findSet,
  isolationOf,
  membersOf,
  namedSetOf,
  noSetsState,
  savedSetOf,
  selectionOf,
  setsFeature,
  setsSlice,
  type SetsState,
} from '../src/sets.js';
import { appearanceFeatureFor, resolveAppearance } from '../src/appearance.js';
import { editEffectOf } from '../src/edits.js';
import { boundScene, featureSession, fixtureKeys, installedSession, key, stored } from './appearance-fixture.js';

describe('the sets slice', () => {
  it('round-trips through a document as JSON', () => {
    const state: SetsState = {
      sets: [{ id: 'doors', name: 'Doors', members: [key(0), key(1)] }],
      selection: [key(1)],
      isolated: [key(0)],
    };
    const document = putSlice(emptyDocument(), setsSlice, state);
    const parsed = parseDocument(JSON.parse(JSON.stringify(document)));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const read = getSlice(parsed.value, setsSlice);
    expect(read.ok && read.value).toEqual(state);
  });

  it('reads an absent slice as nothing selected and nothing isolated', () => {
    const read = getSlice(emptyDocument(), setsSlice);
    expect(read.ok && read.value).toEqual(noSetsState);
    expect(hasErrors(read.diagnostics)).toBe(false);
  });

  it('keeps null and an empty list apart, because they mean different things', () => {
    expect(isolationOf({ ...noSetsState, isolated: null })).toBeUndefined();
    expect(isolationOf({ ...noSetsState, isolated: [] })?.size).toBe(0);
  });

  it('converts between a saved set and the model package\'s named set', () => {
    const saved = { id: 'doors', name: 'Doors', members: [key(0), key(1)] };
    expect(savedSetOf(namedSetOf(saved))).toEqual(saved);
  });
});

describe('the named set commands', () => {
  it('defines a set, replaces one of the same id, and refuses removing an unknown one', () => {
    const session = featureSession();
    expect(session.dispatch('sets.define', { id: 'doors', name: 'Doors', members: [key(0)] }).ok).toBe(true);
    expect(session.events).toContain('sets.define:sets');
    session.dispatch('sets.define', { id: 'doors', name: 'Every door', members: [key(0), key(1)] });
    expect(session.read(setsSlice).sets).toHaveLength(1);
    expect(findSet(session.read(setsSlice), 'doors')?.name).toBe('Every door');
    const gone = session.dispatch('sets.remove', { id: 'windows' });
    expect(gone.ok).toBe(false);
    expect(gone.diagnostics[0]?.code).toBe('sets/unknown-set');
  });

  it('drops a repeated member as it defines, because a set holds a key once', () => {
    const session = featureSession();
    session.dispatch('sets.define', { id: 'doors', name: 'Doors', members: [key(0), key(0), key(1)] });
    expect(findSet(session.read(setsSlice), 'doors')?.members).toEqual([key(0), key(1)]);
  });

  it('refuses an input its schema does not accept', () => {
    const session = featureSession();
    const bad = session.dispatch('sets.define', { id: 'doors', name: 'Doors', members: [7] });
    expect(bad.ok).toBe(false);
    expect(session.read(setsSlice)).toEqual(noSetsState);
  });

  it('combines named sets by union, intersection and difference', () => {
    const session = featureSession();
    session.dispatch('sets.define', { id: 'a', name: 'A', members: [key(0), key(1)] });
    session.dispatch('sets.define', { id: 'b', name: 'B', members: [key(1), key(2)] });
    session.dispatch('sets.union', { id: 'u', name: 'U', from: ['a', 'b'] });
    session.dispatch('sets.intersect', { id: 'i', name: 'I', from: ['a', 'b'] });
    session.dispatch('sets.difference', { id: 'd', name: 'D', from: ['a', 'b'] });
    const state = session.read(setsSlice);
    expect(setKeys(membersOf(state, 'u'))).toEqual([key(0), key(1), key(2)]);
    expect(setKeys(membersOf(state, 'i'))).toEqual([key(1)]);
    expect(setKeys(membersOf(state, 'd'))).toEqual([key(0)]);
  });

  it('refuses combining a set it does not hold, and combining nothing', () => {
    const session = featureSession();
    session.dispatch('sets.define', { id: 'a', name: 'A', members: [key(0)] });
    const unknown = session.dispatch('sets.union', { id: 'u', name: 'U', from: ['a', 'z'] });
    expect(unknown.ok).toBe(false);
    expect(unknown.diagnostics[0]?.code).toBe('sets/unknown-set');
    const empty = session.dispatch('sets.union', { id: 'u', name: 'U', from: [] });
    expect(empty.ok).toBe(false);
    expect(empty.diagnostics[0]?.code).toBe('sets/no-operands');
  });
});

describe('the selection', () => {
  it('replaces, adds, removes and toggles', () => {
    const session = featureSession();
    session.dispatch('sets.select', { members: [key(0), key(1)] });
    expect(session.read(setsSlice).selection).toEqual([key(0), key(1)]);
    session.dispatch('sets.select', { members: [key(2)], mode: 'add' });
    expect(setKeys(selectionOf(session.read(setsSlice)))).toEqual([key(0), key(1), key(2)]);
    session.dispatch('sets.select', { members: [key(0)], mode: 'remove' });
    expect(session.read(setsSlice).selection).toEqual([key(1), key(2)]);
    session.dispatch('sets.select', { members: [key(1), key(0)], mode: 'toggle' });
    expect(setKeys(selectionOf(session.read(setsSlice)))).toEqual([key(2), key(0)]);
  });

  it('selects the members of a named set and refuses an unknown one', () => {
    const session = featureSession();
    session.dispatch('sets.define', { id: 'doors', name: 'Doors', members: [key(0), key(2)] });
    expect(session.dispatch('sets.selectSet', { id: 'doors' }).ok).toBe(true);
    expect(session.read(setsSlice).selection).toEqual([key(0), key(2)]);
    expect(session.dispatch('sets.selectSet', { id: 'windows' }).ok).toBe(false);
  });

  it('refuses a mode outside its vocabulary', () => {
    const session = featureSession();
    const bad = session.dispatch('sets.select', { members: [key(0)], mode: 'invert' });
    expect(bad.ok).toBe(false);
    expect(session.read(setsSlice).selection).toEqual([]);
  });

  it('never holds an object an edit layer deleted', () => {
    const session = featureSession();
    session.dispatch('edits.apply', {
      layerId: 'demolition',
      operation: { kind: 'delete', targets: [key(1)] },
    });
    session.dispatch('sets.select', { members: [key(0), key(1), key(2)] });
    expect(session.read(setsSlice).selection).toEqual([key(0), key(2)]);
  });

  it('leaves a hidden object out of the selection a style composes, and takes it back when shown', () => {
    const session = featureSession();
    session.dispatch('sets.select', { members: [key(0), key(1)] });
    session.dispatch('edits.apply', { layerId: 'hiding', operation: { kind: 'hide', targets: [key(1)] } });
    const state = session.read(setsSlice);
    expect(state.selection).toEqual([key(0), key(1)]);
    expect(setKeys(effectiveSelection(state, editEffectOf(session)))).toEqual([key(0)]);
    session.dispatch('edits.enableLayer', { id: 'hiding', enabled: false });
    expect(setKeys(effectiveSelection(state, editEffectOf(session)))).toEqual([key(0), key(1)]);
  });

  it('marks a selected object without making a hidden one visible', () => {
    const session = featureSession();
    session.dispatch('edits.apply', { layerId: 'hiding', operation: { kind: 'hide', targets: [key(1)] } });
    session.dispatch('sets.select', { members: [key(1)] });
    const resolved = resolveAppearance(session, fixtureKeys);
    expect(resolved.byKey.get(key(1))?.visible).toBe(false);
    expect(resolved.byKey.get(key(1))?.color).toEqual([0.8, 0.8, 0.8]);
  });
});

describe('isolation', () => {
  it('shows only what it names, and shows everything again', () => {
    const session = featureSession();
    session.dispatch('sets.isolate', { members: [key(1)] });
    const isolated = resolveAppearance(session, fixtureKeys);
    expect(isolated.byKey.get(key(0))?.visible).toBe(false);
    expect(isolated.byKey.get(key(1))).toBeUndefined();
    session.dispatch('sets.showAll', {});
    expect(resolveAppearance(session, fixtureKeys).byKey.size).toBe(0);
  });

  it('treats an empty isolation as hiding everything, which is a state and not an error', () => {
    const session = featureSession();
    expect(session.dispatch('sets.isolate', { members: [] }).ok).toBe(true);
    const resolved = resolveAppearance(session, fixtureKeys);
    for (const held of fixtureKeys) expect(resolved.byKey.get(held)?.visible).toBe(false);
  });
});

describe('the sets render hook', () => {
  it('marks the selection in the bound scene and unmarks it again', () => {
    const scene = boundScene();
    const session = featureSession();
    const stop = appearanceFeatureFor(scene.target).install?.(session);
    session.dispatch('sets.select', { members: [key(1)] });
    expect(scene.colorOf(1).slice(0, 3)).toEqual(stored([1, 0.6, 0.1]));
    expect(scene.shown(1)).toBe(true);
    session.dispatch('sets.select', { members: [] });
    expect(scene.colorOf(1).slice(0, 3)).toEqual(stored([0.8, 0.8, 0.8]));
    stop?.dispose();
  });

  it('never draws a selected object that an edit layer hid', () => {
    const scene = boundScene();
    const session = featureSession();
    const stop = appearanceFeatureFor(scene.target).install?.(session);
    session.dispatch('edits.apply', { layerId: 'hiding', operation: { kind: 'hide', targets: [key(2)] } });
    session.dispatch('sets.select', { members: [key(2)] });
    expect(scene.shown(2)).toBe(false);
    expect(scene.colorOf(2).slice(0, 3)).toEqual(stored([0.8, 0.8, 0.8]));
    stop?.dispose();
  });

  it('isolates in the bound scene, leaving a rule on the isolated object in force', () => {
    const scene = boundScene();
    const session = featureSession();
    const stop = appearanceFeatureFor(scene.target).install?.(session);
    session.dispatch('appearance.addRule', { rule: styleRule('a', 'a', [key(0)], { color: [1, 0, 0] }) });
    session.dispatch('sets.isolate', { members: [key(0)] });
    expect(scene.shown(0)).toBe(true);
    expect(scene.colorOf(0).slice(0, 3)).toEqual(stored([1, 0, 0]));
    expect(scene.shown(1)).toBe(false);
    stop?.dispose();
  });
});

describe('the sets feature', () => {
  it('owns one slice and names its commands', () => {
    expect(setsFeature.id).toBe('sets');
    expect(setsFeature.slice.version).toBe(1);
    expect(setsFeature.dependsOn).toEqual(['edits']);
    expect(setsFeature.commands.map((item) => item.name)).toEqual([
      'sets.define',
      'sets.remove',
      'sets.select',
      'sets.selectSet',
      'sets.union',
      'sets.intersect',
      'sets.difference',
      'sets.isolate',
      'sets.showAll',
      'sets.clear',
    ]);
  });

  it('clears every named set, the selection and the isolation at once', () => {
    const session = featureSession();
    session.dispatch('sets.define', { id: 'a', name: 'A', members: [key(0)] });
    session.dispatch('sets.select', { members: [key(0)] });
    session.dispatch('sets.isolate', { members: [key(0)] });
    expect(session.dispatch('sets.clear', {}).ok).toBe(true);
    expect(session.read(setsSlice)).toEqual(noSetsState);
  });
});

describe('the sets feature in a real session', () => {
  it('installs into Track V’s session and keeps a deleted object out of the selection', () => {
    const { session, host } = installedSession();
    expect(host.installed('sets')).toBe(true);
    session.dispatch('edits.apply', { layerId: 'a', operation: { kind: 'delete', targets: [key(1)] } });
    expect(session.dispatch('sets.select', { members: [key(0), key(1)] }).ok).toBe(true);
    expect(session.read(setsSlice).selection).toEqual([key(0)]);
    expect(session.dispatch('sets.select', { members: [key(0)], mode: 'invert' }).ok).toBe(false);
    host.dispose();
  });
});
