// The three modes through the real session: `createSession` plus `featureHost` with the edits,
// sets and appearance features over `noRenderTarget`, which is what the page runs minus the canvas.
// Every count asserted here is the number the page reports, read from the same composition.

import { beforeEach, describe, expect, it } from 'vitest';
import { defaultBuildingOptions, generateBuilding } from '@bim-open-toolkit/synthetic';
import {
  defaultAppearance,
  objectKey,
  styleOf,
  type Appearance,
  type ObjectKey,
} from '@bim-open-toolkit/model';
import {
  appearanceFeatureFor,
  appearanceSlice,
  editsFeature,
  noRenderTarget,
  resolveAppearance,
  setsFeature,
  setsSlice,
} from '@bim-open-toolkit/features';
import { createSession, featureHost, type ViewerSession } from '@bim-open-toolkit/viewer';
import { findGroup, groupsOf, type ObjectGroup } from '../../../src/feature-demos/show-by/groups.js';
import {
  applyShow,
  clearShow,
  ghostOpacity,
  ghostRuleId,
  hideRuleId,
  isShowMode,
  shownObjects,
} from '../../../src/feature-demos/show-by/show.js';

const model = generateBuilding({ ...defaultBuildingOptions, roof: true, ceilings: true }).model;
const groups = groupsOf(model);
const keys: readonly ObjectKey[] = model.objects.map((record) => objectKey(record.ref));
const base: ReadonlyMap<ObjectKey, Appearance> = new Map(
  model.objects.map((record) => [objectKey(record.ref), record.appearance ?? defaultAppearance]),
);

// The session the page installs, without a renderer.
const shownSession = (): ViewerSession => {
  const created = createSession();
  if (!created.ok) throw new Error(created.diagnostics.map((item) => item.message).join('; '));
  const installed = featureHost(created.value).install([
    editsFeature,
    setsFeature,
    appearanceFeatureFor(noRenderTarget, base),
  ]);
  if (!installed.ok) throw new Error(installed.diagnostics.map((item) => item.message).join('; '));
  return created.value;
};

// A group that must be there, so a missing one fails on its own line rather than as a count.
const named = (kind: 'storey' | 'room' | 'category', id: string): ObjectGroup => {
  const found = findGroup(groups, kind, id);
  if (found === undefined) throw new Error(`the building has no ${kind} "${id}"`);
  return found;
};

const shown = (session: ViewerSession): number => shownObjects(session, keys, base).length;

let session: ViewerSession;

beforeEach(() => {
  session = shownSession();
});

describe('showing a group', () => {
  it('draws everything before anything is shown by', () => {
    expect(shown(session)).toBe(model.objects.length);
  });

  it.each([
    ['storey', 'storey-2'],
    ['room', 'room-1-1'],
    ['category', 'Door'],
  ] as const)('isolates one %s and draws only its objects', (kind, id) => {
    const group = named(kind, id);
    expect(applyShow(session, { members: group.members, all: keys, mode: 'isolate' }).ok).toBe(true);
    expect(shown(session)).toBe(group.count);
    expect(session.read(setsSlice).isolated).toHaveLength(group.count);
  });

  it.each([
    ['storey', 'storey-2'],
    ['room', 'room-1-1'],
    ['category', 'Door'],
  ] as const)('ghosts everything outside one %s without hiding it', (kind, id) => {
    const group = named(kind, id);
    const applied = applyShow(session, { members: group.members, all: keys, mode: 'ghost' });
    expect(applied.ok && applied.value).toHaveLength(model.objects.length - group.count);
    expect(shown(session)).toBe(model.objects.length);
    const resolved = resolveAppearance(session, keys, base);
    const outside = keys.filter((key) => !group.members.includes(key));
    expect(outside.every((key) => styleOf(resolved, key).opacity === ghostOpacity)).toBe(true);
    const inside = group.members[0];
    expect(inside === undefined ? ghostOpacity : styleOf(resolved, inside).opacity).toBeGreaterThan(ghostOpacity);
  });

  it.each([
    ['storey', 'storey-2'],
    ['room', 'room-1-1'],
    ['category', 'Roof'],
  ] as const)('hides one %s and leaves the rest drawn', (kind, id) => {
    const group = named(kind, id);
    expect(applyShow(session, { members: group.members, all: keys, mode: 'hide' }).ok).toBe(true);
    expect(shown(session)).toBe(model.objects.length - group.count);
  });

  it('replaces the last choice rather than stacking rules on it', () => {
    const storey = named('storey', 'storey-2');
    const doors = named('category', 'Door');
    applyShow(session, { members: storey.members, all: keys, mode: 'ghost' });
    expect(session.read(appearanceSlice).rules.map((rule) => rule.id)).toEqual([ghostRuleId]);
    applyShow(session, { members: doors.members, all: keys, mode: 'hide' });
    expect(session.read(appearanceSlice).rules.map((rule) => rule.id)).toEqual([hideRuleId]);
    expect(shown(session)).toBe(model.objects.length - doors.count);
    applyShow(session, { members: doors.members, all: keys, mode: 'isolate' });
    expect(session.read(appearanceSlice).rules).toEqual([]);
    expect(shown(session)).toBe(doors.count);
  });

  it('puts everything back on a reset, from any mode', () => {
    const storey = named('storey', 'storey-1');
    for (const mode of ['isolate', 'ghost', 'hide'] as const) {
      applyShow(session, { members: storey.members, all: keys, mode });
      expect(clearShow(session).ok).toBe(true);
      expect(session.read(setsSlice).isolated).toBeNull();
      expect(session.read(appearanceSlice).rules).toEqual([]);
      expect(shown(session)).toBe(model.objects.length);
    }
  });

  it('leaves an isolated group selectable and drops nothing from the selection', () => {
    const storey = named('storey', 'storey-2');
    applyShow(session, { members: storey.members, all: keys, mode: 'isolate' });
    const first = storey.members[0];
    expect(first).toBeDefined();
    if (first === undefined) return;
    expect(session.dispatch('sets.select', { members: [first] }).ok).toBe(true);
    expect(session.read(setsSlice).selection).toEqual([first]);
  });
});

describe('the mode a page reads back', () => {
  it('accepts the three modes and nothing else', () => {
    expect(['isolate', 'ghost', 'hide'].every(isShowMode)).toBe(true);
    expect(isShowMode('ghosted')).toBe(false);
  });
});
