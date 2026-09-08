// Analytical colours, which are never theme tokens (GALLERY-PLAN.md decision 7).
//
// A coverage state, a change type or a delivery state means the same thing in a light page and in a
// dark one, so it is written here as a fixed value rather than as a custom property. Switching
// theme or text size changes chrome only; the acceptance test in `test/gallery/theme.test.ts` reads
// this table before and after applying every theme and compares it.
//
// The names are the model package's own vocabulary, so a legend built from a `Coverage` or a
// `ChangeEvent` never has to translate.

import type { ValueState } from '@bim-open-toolkit/ui-gratify';

// What a value's state looks like: known, nobody recorded it, or the sources disagree.
export const valueStateColors: Readonly<Record<ValueState, string>> = {
  known: '#2f7d55',
  missing: '#8a8578',
  conflicting: '#c0392b',
};

// What happened to an object between two issues of a model.
export type ChangeKind = 'added' | 'removed' | 'changed' | 'unchanged';

export const changeKindColors: Readonly<Record<ChangeKind, string>> = {
  added: '#2f7d55',
  removed: '#c0392b',
  changed: '#c98a12',
  unchanged: '#8a8578',
};

// Where something has got to on a delivery schedule.
export type DeliveryState = 'planned' | 'delivered' | 'accepted' | 'installed';

export const deliveryStateColors: Readonly<Record<DeliveryState, string>> = {
  planned: '#8a8578',
  delivered: '#2f6fb0',
  accepted: '#2f7d55',
  installed: '#1c4f7a',
};

// Every analytical colour in one table, which is what the invariance test compares.
export const analyticalColors: Readonly<Record<string, string>> = {
  ...Object.fromEntries(Object.entries(valueStateColors).map(([key, value]) => [`value.${key}`, value])),
  ...Object.fromEntries(Object.entries(changeKindColors).map(([key, value]) => [`change.${key}`, value])),
  ...Object.fromEntries(Object.entries(deliveryStateColors).map(([key, value]) => [`delivery.${key}`, value])),
};

// The custom properties the chrome is allowed to change. An analytical colour is not one of them,
// and the test checks that no value above is reachable through any of these names.
export const chromeTokenNames: readonly string[] = [
  '--paper',
  '--panel',
  '--ink',
  '--ink-muted',
  '--rule',
  '--accent',
  '--link',
  '--viewport-clear',
  '--scrim',
  '--text-scale',
];
