// A cursor over the seeded generator's state.
//
// `prng` is a pure function of an immutable state, which is right for its own tests but verbose
// inside a generator that draws hundreds of times. A cursor is created and discarded inside one
// generator call and never escapes it, so the generator stays a pure function of its options while
// its body reads as a sequence of draws.

import { float, gaussian, int, pick, range, seed, shuffle, type Rng } from './prng.js';

// The generator's position in its draw sequence. Created by `cursor`, never shared between calls.
export type Cursor = { state: Rng };

// A cursor at the start of the sequence for an integer seed.
export const cursor = (value: number): Cursor => ({ state: seed(value) });

// Draws a number in [0, 1).
export function drawFloat(target: Cursor): number {
  const draw = float(target.state);
  target.state = draw.rng;
  return draw.value;
}

// Draws a number in [minimum, maximum).
export function drawRange(target: Cursor, minimum: number, maximum: number): number {
  const draw = range(target.state, minimum, maximum);
  target.state = draw.rng;
  return draw.value;
}

// Draws an integer in [minimum, maximum).
export function drawInt(target: Cursor, minimum: number, maximum: number): number {
  const draw = int(target.state, minimum, maximum);
  target.state = draw.rng;
  return draw.value;
}

// Draws one element of a non-empty array.
export function drawPick<T>(target: Cursor, items: readonly T[]): T {
  const draw = pick(target.state, items);
  target.state = draw.rng;
  return draw.value;
}

// Draws the same elements in a drawn order; the input is not modified.
export function drawShuffle<T>(target: Cursor, items: readonly T[]): readonly T[] {
  const draw = shuffle(target.state, items);
  target.state = draw.rng;
  return draw.value;
}

// Draws an approximately normal value.
export function drawGaussian(target: Cursor, mean: number, standardDeviation: number): number {
  const draw = gaussian(target.state, mean, standardDeviation);
  target.state = draw.rng;
  return draw.value;
}

// Draws true with the given probability. The draw is always made, so a rate of 0 costs the same
// position in the sequence as any other rate and changing one rate never shifts an unrelated one.
export const drawChance = (target: Cursor, probability: number): boolean => drawFloat(target) < probability;
