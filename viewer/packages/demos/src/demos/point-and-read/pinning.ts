// What the demo is reading, and the commands that change it.
//
// Pointing writes the selection; clicking writes a named set holding the one object that was
// clicked. The set is what makes a pin outlast the pointer: while it has a member, that member is
// what the tag and the sheet show, whatever the pointer is over. Clicking nothing leaves the set in
// place with no members, so unpinning is one more `sets.define` rather than a removal that fails
// when there is nothing to remove.

import { findSet, setsSlice } from '@bim-open-toolkit/features';
import type { ObjectKey, Session } from '@bim-open-toolkit/model';
import type { ObjectHit } from '@bim-open-toolkit/render';
import { hideWallsRule, hideWallsRuleId, inspectIndex, type CommandCall } from './building.js';

// The set the demo pins the object it is reading into. It holds one member, or none.
export const pinnedSetId = 'point-and-read/pinned';

// The object the tag and the inspector show: the pinned one, or the one under the pointer.
export const shownKey = (session: Session): ObjectKey | undefined => {
  const state = session.read(setsSlice);
  return findSet(state, pinnedSetId)?.members[0] ?? state.selection[0];
};

// True when what is being shown was pinned by a click rather than pointed at.
export const isPinned = (session: Session): boolean =>
  findSet(session.read(setsSlice), pinnedSetId)?.members[0] !== undefined;

// What the demo does as it opens: take the walls away so the doors inside them can be seen.
export const openingCalls = (): readonly CommandCall[] => [
  { command: 'appearance.addRules', input: { rules: [hideWallsRule(inspectIndex())] } },
];

// What pointing at something does. Pointing at nothing empties the selection rather than keeping the
// last object under a pointer that has moved off it.
export const hoverCalls = (hit: ObjectHit | undefined): readonly CommandCall[] => [
  { command: 'sets.select', input: { members: hit === undefined ? [] : [hit.key], mode: 'replace' } },
];

// What clicking does: pin what was clicked, or unpin when the click hit nothing.
export const pinCalls = (hit: ObjectHit | undefined): readonly CommandCall[] => [
  {
    command: 'sets.define',
    input: { id: pinnedSetId, name: 'Pinned object', members: hit === undefined ? [] : [hit.key] },
  },
  ...hoverCalls(hit),
];

// What pressing the tag does: drop the pin and leave the selection alone.
export const unpinCalls = (): readonly CommandCall[] => [
  { command: 'sets.define', input: { id: pinnedSetId, name: 'Pinned object', members: [] } },
];

// What the demo undoes when it is disposed: the rule it added and everything it selected or pinned.
export const resetCalls = (): readonly CommandCall[] => [
  { command: 'appearance.removeRule', input: { id: hideWallsRuleId } },
  { command: 'sets.clear', input: {} },
];
