// The two things this demo asks for at once: recolour everything, and move everything.
//
// Both go through commands that already exist. Recolouring is one style rule naming every object,
// which the appearance render hook turns into one bulk colour write; moving is the grid layout,
// which writes a translation for every instance row. Neither is a special path for this demo, which
// is the point: what the demo measures is what an ordinary command costs at this size.

import type { Color, ObjectKey, Result, Session, StyleRule } from '@bim-open-toolkit/model';

// The id the demo's colouring is held under. One id, replaced each press, so the rule list does not
// grow with every button press.
export const recolourRuleId = 'ten-thousand/recolour';

// The colours the button cycles through. Fixed values, not theme tokens: they say which press this
// is, and changing the gallery's theme must not change them.
export const recolourPalette: readonly Color[] = [
  [0.82, 0.27, 0.12],
  [0.16, 0.36, 0.82],
  [0.18, 0.62, 0.36],
  [0.76, 0.62, 0.16],
];

// The colour of press `step`.
export const recolourColor = (step: number): Color => {
  const chosen = recolourPalette[Math.abs(step) % recolourPalette.length];
  return chosen ?? [0.8, 0.8, 0.8];
};

// The rule that colours every named object at once.
export const recolourRule = (keys: readonly ObjectKey[], step: number): StyleRule => ({
  id: recolourRuleId,
  name: `Everything, press ${step}`,
  enabled: true,
  priority: 10,
  targets: keys,
  change: { color: recolourColor(step) },
});

// Replaces the colouring with one that names every object. The rule is removed first because
// `appearance.addRules` refuses an id that is already there rather than shadowing it.
export const recolourAll = (session: Session, keys: readonly ObjectKey[], step: number): Result<unknown> => {
  session.dispatch('appearance.removeRule', { id: recolourRuleId });
  return session.dispatch('appearance.addRules', { rules: [recolourRule(keys, step)] });
};

// Moves every object onto a grid, or puts every object back where the model placed it. Spacing and
// column count of zero mean the layout chooses both from the model's own footprint.
export const moveAll = (session: Session, onGrid: boolean): Result<unknown> =>
  onGrid ? session.dispatch('layouts.grid', {}) : session.dispatch('layouts.reset', {});
