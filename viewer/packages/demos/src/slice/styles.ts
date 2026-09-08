// Step two of the slice: resolve how every object looks. Pure.
//
// One rule paints the unrated doors red; everything else keeps the appearance it was generated
// with. The selection is composed after the rule, so a selected red door is marked without losing
// what the rule said about it.

import {
  resolveStyles,
  setOf,
  styleComposition,
  styleRule,
  type Color,
  type ObjectKey,
  type ResolvedStyles,
  type StyleRule,
} from '@bim-open-toolkit/model';
import type { SliceData } from './data.js';

// The colour an unrated door is painted.
export const unratedColor: Color = [1, 0, 0];

// The one rule the page carries. Its priority is above nothing, because it is the only rule.
export const unratedDoorsRule = (doors: readonly ObjectKey[]): StyleRule =>
  styleRule('unrated-doors', 'Doors with no agreed fire rating', doors, { color: unratedColor });

// Takes away what a door is set into. The building generator cuts no opening, so a door leaf is
// entirely inside its wall and nothing painted on it can be seen while the wall is there.
//
// This hides rather than ghosts. A ghost - a low opacity - does not work: every group's material
// writes depth, three sorts transparent objects only against each other and by whole object, and
// the wall groups span the whole building, so a ghosted wall drawn first still hides the doors
// behind it. Hiding writes alpha zero, which viewer-core's patched material discards outright.
export const hideEnclosureRule = (enclosure: readonly ObjectKey[]): StyleRule =>
  styleRule('hide-enclosure', 'Walls hidden so the doors show', enclosure, { visible: false });

// Every object as it was generated, with no rule and nothing selected. This is what the instance
// buffers already hold after binding, so it is the resolution the first change table starts from.
export const baseStyles = (data: SliceData): ResolvedStyles =>
  resolveStyles(styleComposition(data.base, [], []), data.keys);

// Every object with the unrated doors painted red, what hides them optionally taken away, and the
// selection marked.
export const sliceStyles = (
  data: SliceData,
  selection: readonly ObjectKey[],
  hideEnclosure: boolean,
): ResolvedStyles =>
  resolveStyles(
    styleComposition(
      data.base,
      [],
      hideEnclosure
        ? [hideEnclosureRule(data.enclosure), unratedDoorsRule(data.unratedDoors)]
        : [unratedDoorsRule(data.unratedDoors)],
      setOf(selection),
    ),
    data.keys,
  );
