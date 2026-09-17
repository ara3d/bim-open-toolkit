import { describe, expect, it } from 'vitest';
import {
  emptyDocument,
  getSlice,
  hasErrors,
  identityMatrix,
  parseDocument,
  putSlice,
  storedSliceIds,
  translation,
} from '@bim-open-toolkit/model';
import { representationRegistry } from '@bim-open-toolkit/render';
import {
  ephemeralSlices,
  noReplacementsState,
  replacementChanges,
  replacementDelta,
  replacementFeature,
  replacementFeatureFor,
  replacementSlice,
  replacementStateOf,
  replacementsOf,
  savedReplacements,
  type ReplacementsState,
} from '../src/replacement.js';
import { appearanceFeatureFor } from '../src/appearance.js';
import {
  boundScene,
  featureSession,
  fixtureRegistry,
  installedSession,
  key,
  recordingRepresentations,
  stored,
} from './appearance-fixture.js';

describe('the replacement slice', () => {
  it('round-trips through a document as JSON, so a session reads back what it wrote', () => {
    const state: ReplacementsState = {
      replacements: [{ key: key(0), representationId: 'box', transform: translation([1, 2, 3]) }],
    };
    const document = putSlice(emptyDocument(), replacementSlice, state);
    const parsed = parseDocument(JSON.parse(JSON.stringify(document)));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const read = getSlice(parsed.value, replacementSlice);
    expect(read.ok && read.value).toEqual(state);
  });

  it('is ephemeral: a saved document leaves it out', () => {
    expect(ephemeralSlices).toEqual(['replacement']);
    const session = featureSession();
    session.dispatch('replacement.set', { key: key(0), representationId: 'box' });
    const saved = [replacementSlice.id].filter((id) => !ephemeralSlices.includes(id));
    expect(saved).toEqual([]);
    expect(storedSliceIds(emptyDocument())).toEqual([]);
  });

  it('reads an absent slice as nothing replaced', () => {
    const read = getSlice(emptyDocument(), replacementSlice);
    expect(read.ok && read.value).toEqual(noReplacementsState);
    expect(hasErrors(read.diagnostics)).toBe(false);
  });

  it('converts between the slice and the state the render package addresses', () => {
    const state: ReplacementsState = {
      replacements: [{ key: key(0), representationId: 'box', transform: identityMatrix }],
    };
    expect(savedReplacements(replacementStateOf(state))).toEqual(state);
  });
});

describe('the replacement commands', () => {
  it('records a replacement and publishes the slice that changed', () => {
    const session = featureSession();
    expect(session.dispatch('replacement.set', { key: key(0), representationId: 'box' }).ok).toBe(true);
    expect(session.events).toContain('replacement.set:replacement');
    expect(session.read(replacementSlice).replacements).toEqual([
      { key: key(0), representationId: 'box', transform: identityMatrix },
    ]);
  });

  it('replaces the substitute rather than the original, so the base reference is never lost', () => {
    const session = featureSession();
    session.dispatch('replacement.set', { key: key(0), representationId: 'box' });
    session.dispatch('replacement.set', { key: key(0), representationId: 'sphere' });
    const held = session.read(replacementSlice).replacements;
    expect(held).toHaveLength(1);
    expect(held[0]?.representationId).toBe('sphere');
    session.dispatch('replacement.clear', { key: key(0) });
    expect(session.read(replacementSlice)).toEqual(noReplacementsState);
  });

  it('refuses clearing an object that is not replaced, and clears everything when given no key', () => {
    const session = featureSession();
    session.dispatch('replacement.set', { key: key(0), representationId: 'box' });
    session.dispatch('replacement.set', { key: key(1), representationId: 'box' });
    const unknown = session.dispatch('replacement.clear', { key: key(2) });
    expect(unknown.ok).toBe(false);
    expect(unknown.diagnostics[0]?.code).toBe('replacement/unknown-key');
    expect(session.dispatch('replacement.clear', {}).ok).toBe(true);
    expect(session.read(replacementSlice).replacements).toEqual([]);
  });

  it('refuses an input its schema does not accept', () => {
    const session = featureSession();
    const bad = session.dispatch('replacement.set', { key: key(0), representationId: 'box', transform: [1, 2, 3] });
    expect(bad.ok).toBe(false);
    expect(session.read(replacementSlice)).toEqual(noReplacementsState);
  });

  it('names exactly the keys whose rows have to be shown or hidden again', () => {
    const before = replacementStateOf({ replacements: [{ key: key(0), representationId: 'box', transform: identityMatrix }] });
    const after = replacementStateOf({
      replacements: [
        { key: key(0), representationId: 'box', transform: identityMatrix },
        { key: key(1), representationId: 'box', transform: identityMatrix },
      ],
    });
    expect(replacementDelta(before, after)).toEqual([key(1)]);
    expect(replacementDelta(after, before)).toEqual([key(1)]);
    expect(replacementDelta(after, after)).toEqual([]);
  });

  it('makes a change table naming the replaced objects as hidden', () => {
    const session = featureSession();
    session.dispatch('replacement.set', { key: key(1), representationId: 'box' });
    const changes = replacementChanges(replacementsOf(session));
    expect(changes.rowCount).toBe(1);
    expect(changes.columns.get('key')?.values).toEqual([key(1)]);
    expect(changes.columns.get('visible')?.values).toEqual(Uint8Array.of(0));
  });
});

describe('the replacement render hook', () => {
  const install = (scene = boundScene(), registry = fixtureRegistry()) => {
    const session = featureSession();
    const representations = recordingRepresentations();
    const stops = [
      appearanceFeatureFor(scene.target).install?.(session),
      replacementFeatureFor(registry, representations, scene.target).install?.(session),
    ];
    return { scene, session, representations, stop: () => stops.forEach((item) => item?.dispose()) };
  };

  it('draws the substitute and hides the object it stands for, leaving the other instances alone', () => {
    const held = install();
    held.session.dispatch('replacement.set', { key: key(1), representationId: 'box' });
    expect(held.representations.drawn().map((item) => item.key)).toEqual([key(1)]);
    expect(held.scene.shown(1)).toBe(false);
    expect(held.scene.shown(0)).toBe(true);
    expect(held.scene.shown(2)).toBe(true);
    held.stop();
  });

  it('shows the object again when the replacement is cleared', () => {
    const held = install();
    held.session.dispatch('replacement.set', { key: key(1), representationId: 'box' });
    held.session.dispatch('replacement.clear', { key: key(1) });
    expect(held.representations.drawn()).toEqual([]);
    expect(held.scene.shown(1)).toBe(true);
    held.stop();
  });

  it('keeps the object hidden when the appearance is rewritten under it', () => {
    const held = install();
    held.session.dispatch('replacement.set', { key: key(1), representationId: 'box' });
    held.session.dispatch('appearance.addRule', {
      rule: { id: 'r', name: 'r', enabled: true, priority: 0, targets: [key(1)], change: { color: [1, 0, 0] } },
    });
    expect(held.scene.shown(1)).toBe(false);
    expect(held.scene.colorOf(0).slice(0, 3)).toEqual(stored([0.8, 0.8, 0.8]));
    held.stop();
  });

  it('gives the substitute the appearance the object it stands for resolved to', () => {
    const scene = boundScene();
    const session = featureSession();
    const representations = recordingRepresentations();
    const stop = replacementFeatureFor(fixtureRegistry(), representations, scene.target, () => ({
      color: [0, 0, 1],
      opacity: 0.5,
      visible: true,
    })).install?.(session);
    session.dispatch('replacement.set', { key: key(2), representationId: 'box' });
    expect(representations.drawn()[0]?.appearance).toEqual({ color: [0, 0, 1], opacity: 0.5, visible: true });
    stop?.dispose();
  });

  it('draws nothing for a representation the registry does not hold, rather than guessing', () => {
    const empty = representationRegistry([]);
    expect(empty.ok).toBe(true);
    if (!empty.ok) return;
    const held = install(boundScene(), empty.value);
    held.session.dispatch('replacement.set', { key: key(1), representationId: 'box' });
    expect(held.representations.drawn()).toEqual([]);
    expect(held.scene.shown(1)).toBe(false);
    held.stop();
  });

  it('places the substitute where the command put it', () => {
    const held = install();
    held.session.dispatch('replacement.set', {
      key: key(0),
      representationId: 'box',
      transform: [...translation([5, 0, 0])],
    });
    expect(held.representations.drawn()[0]?.transform).toEqual(translation([5, 0, 0]));
    held.stop();
  });
});

describe('the replacement feature', () => {
  it('owns one slice, depends on the appearance and names its commands', () => {
    expect(replacementFeature.id).toBe('replacement');
    expect(replacementFeature.slice.id).toBe('replacement');
    expect(replacementFeature.slice.version).toBe(1);
    expect(replacementFeature.dependsOn).toEqual(['appearance']);
    expect(replacementFeature.commands.map((item) => item.name)).toEqual([
      'replacement.set',
      'replacement.clear',
    ]);
  });
});

describe('the replacement feature in a real session', () => {
  it('installs into Track V’s session, replaces one object and restores it', () => {
    const { session, host } = installedSession();
    expect(host.installed('replacement')).toBe(true);
    expect(session.dispatch('replacement.set', { key: key(0), representationId: 'box' }).ok).toBe(true);
    expect(session.read(replacementSlice).replacements).toHaveLength(1);
    expect(session.dispatch('replacement.clear', { key: key(1) }).ok).toBe(false);
    expect(session.dispatch('replacement.clear', { key: key(0) }).ok).toBe(true);
    expect(session.read(replacementSlice)).toEqual(noReplacementsState);
    host.dispose();
  });
});
