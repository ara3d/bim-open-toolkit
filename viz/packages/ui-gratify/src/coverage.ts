// Analytical colours are never theme tokens (GALLERY-PLAN.md decision 7): what a value's coverage
// state looks like must not change when the chrome does, because the colour carries meaning. These
// are fixed, and `applyGalleryTheme` does not touch them.
import { rgb, type Color } from 'gratify';
import type { ValueState } from './contracts.js';

// Amber for a value nobody recorded, violet for sources that disagree, green for one we have.
export const coverageColour: Readonly<Record<ValueState, Color>> = {
  known: rgb(47, 125, 79),
  missing: rgb(208, 135, 0),
  conflicting: rgb(123, 63, 191),
};

// The one word a badge shows for a state. A known value gets no badge at all.
export const coverageLabel: Readonly<Record<ValueState, string>> = {
  known: '',
  missing: 'missing',
  conflicting: 'conflict',
};
