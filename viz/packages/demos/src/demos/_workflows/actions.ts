// Making one object the selection from a click.
//
// SHIM. An `OverlayAction` - what an overlay click and an inspector row click both run - carries a
// record of strings, numbers and flags only, and no landed command selects an object from one. The
// nearest is `sets.selectSet`, which takes a set id. So a demo that must select one object from a
// click defines a one-member set for it up front and the click names that set.
//
// Requested of Track FA: `sets.selectKeys { keys: string }`, taking space-separated object keys the
// way the synthetic tables already carry a list in one cell. When it lands, `focusAction` becomes
// one command and `focusSets` goes away.

import { namedSet, objectKey, objectRef, type ModelRef, type NamedSet } from '@bim-open-toolkit/model';
import type { OverlayAction } from '@bim-open-toolkit/render';

// The id of the one-member set that stands for one object of one demo.
export const focusSetId = (prefix: string, objectId: string): string => `${prefix}/focus/${objectId}`;

// A one-member set per object, so a click can name exactly one of them.
export const focusSets = (prefix: string, model: ModelRef, ids: readonly string[]): readonly NamedSet[] =>
  [...new Set(ids)].map((id) =>
    namedSet(focusSetId(prefix, id), id, new Set([objectKey(objectRef(model, id))])),
  );

// What a click on the row or marker of one object runs.
export const focusAction = (prefix: string, objectId: string): OverlayAction => ({
  command: 'sets.selectSet',
  input: { id: focusSetId(prefix, objectId) },
});

// What a click runs when it should select a whole named set rather than one object.
export const selectSetAction = (setId: string): OverlayAction => ({
  command: 'sets.selectSet',
  input: { id: setId },
});
