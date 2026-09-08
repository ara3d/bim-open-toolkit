// Seeded pseudo-random generator as pure functions over an explicit state value.
//
// The algorithm is xoshiro128** seeded by splitmix32. Every operation uses only 32-bit integer
// arithmetic (`Math.imul`, shifts, xor), so a given seed produces the same sequence on every
// engine and platform. `gaussian` deliberately avoids `Math.log` and `Math.cos`, whose precision
// is implementation defined, so it stays bit-identical too.

// Immutable generator state. Produced by `seed`; never mutated, always replaced.
export type Rng = { readonly s0: number; readonly s1: number; readonly s2: number; readonly s3: number };

// One draw: the value produced and the state to pass to the next draw.
export type Draw<T> = { readonly rng: Rng; readonly value: T };

// One splitmix32 step: the advanced seed state and the scrambled 32-bit output.
function mix(state: number): { readonly state: number; readonly value: number } {
  const advanced = (state + 0x9e3779b9) >>> 0;
  const a = Math.imul(advanced ^ (advanced >>> 16), 0x21f0aaad) >>> 0;
  const b = Math.imul(a ^ (a >>> 15), 0x735a2d97) >>> 0;
  return { state: advanced, value: (b ^ (b >>> 15)) >>> 0 };
}

// 32-bit left rotation.
function rotl(value: number, bits: number): number {
  return ((value << bits) | (value >>> (32 - bits))) >>> 0;
}

// Expands any integer seed into a generator state. The all-zero state is impossible.
export function seed(value: number): Rng {
  const a = mix(value >>> 0);
  const b = mix(a.state);
  const c = mix(b.state);
  const d = mix(c.state);
  const state = { s0: a.value, s1: b.value, s2: c.value, s3: d.value };
  return state.s0 === 0 && state.s1 === 0 && state.s2 === 0 && state.s3 === 0
    ? { s0: 0x9e3779b9, s1: 0x243f6a88, s2: 0xb7e15162, s3: 0x85ebca6b }
    : state;
}

// Draws the next unsigned 32-bit integer.
export function next(rng: Rng): Draw<number> {
  const value = Math.imul(rotl(Math.imul(rng.s1, 5) >>> 0, 7), 9) >>> 0;
  const shifted = (rng.s1 << 9) >>> 0;
  const x2 = (rng.s2 ^ rng.s0) >>> 0;
  const x3 = (rng.s3 ^ rng.s1) >>> 0;
  return {
    rng: { s0: (rng.s0 ^ x3) >>> 0, s1: (rng.s1 ^ x2) >>> 0, s2: (x2 ^ shifted) >>> 0, s3: rotl(x3, 11) },
    value,
  };
}

// Draws a fraction in [0, 1) with 24 bits of precision, exactly representable as a double.
export function float(rng: Rng): Draw<number> {
  const draw = next(rng);
  return { rng: draw.rng, value: (draw.value >>> 8) / 0x1000000 };
}

// Draws a number in [minimum, maximum).
export function range(rng: Rng, minimum: number, maximum: number): Draw<number> {
  if (!(maximum > minimum)) throw new Error(`range requires minimum < maximum, got ${minimum} and ${maximum}`);
  const draw = float(rng);
  return { rng: draw.rng, value: minimum + draw.value * (maximum - minimum) };
}

// Draws an integer in [minimum, maximum). Bias is below one part in 2^24 for spans under 2^12.
export function int(rng: Rng, minimum: number, maximum: number): Draw<number> {
  if (!Number.isInteger(minimum) || !Number.isInteger(maximum)) throw new Error(`int requires integer bounds, got ${minimum} and ${maximum}`);
  if (!(maximum > minimum)) throw new Error(`int requires minimum < maximum, got ${minimum} and ${maximum}`);
  const draw = float(rng);
  return { rng: draw.rng, value: minimum + Math.floor(draw.value * (maximum - minimum)) };
}

// Draws one element of a non-empty array. Throws for an empty array or an `undefined` element.
export function pick<T>(rng: Rng, items: readonly T[]): Draw<T> {
  if (items.length === 0) throw new Error('pick requires a non-empty array');
  const draw = int(rng, 0, items.length);
  const value = items[draw.value];
  if (value === undefined) throw new Error('pick does not support arrays holding undefined');
  return { rng: draw.rng, value };
}

// Returns a new array holding the same elements in a drawn order; the input is not modified.
export function shuffle<T>(rng: Rng, items: readonly T[]): Draw<readonly T[]> {
  const result = items.slice();
  let state = rng;
  for (let index = result.length - 1; index > 0; index--) {
    const draw = int(state, 0, index + 1);
    state = draw.rng;
    const high = result[index];
    const low = result[draw.value];
    if (high === undefined || low === undefined) throw new Error('shuffle does not support arrays holding undefined');
    result[index] = low;
    result[draw.value] = high;
  }
  return { rng: state, value: result };
}

// Draws an approximately normal value: the Irwin-Hall sum of twelve uniforms, so it uses no
// transcendental function and is therefore bit-identical everywhere. Values are truncated to
// mean +/- six standard deviations, which is accurate enough for dimensional jitter.
export function gaussian(rng: Rng, mean: number, standardDeviation: number): Draw<number> {
  let state = rng;
  let sum = 0;
  for (let index = 0; index < 12; index++) {
    const draw = float(state);
    state = draw.rng;
    sum += draw.value;
  }
  return { rng: state, value: mean + (sum - 6) * standardDeviation };
}
