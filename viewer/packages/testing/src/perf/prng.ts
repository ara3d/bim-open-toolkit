/**
 * Deterministic pseudo-random numbers for performance fixtures.
 *
 * The same seed always produces the same sequence, so a measurement can be
 * repeated on another machine and compared against the numbers recorded here.
 */

/** Returns a generator of numbers in [0, 1). Same seed, same sequence (mulberry32). */
export function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** `count` distinct integers in [0, limit), in generation order. Requires count <= limit. */
export function distinctIntegers(count: number, limit: number, seed: number): Int32Array {
  if (count > limit) throw new Error(`cannot draw ${count} distinct values from ${limit}`);
  const random = createRandom(seed);
  const taken = new Uint8Array(limit);
  const out = new Int32Array(count);
  let found = 0;
  while (found < count) {
    const value = Math.floor(random() * limit);
    if (taken[value] === 0) {
      taken[value] = 1;
      out[found++] = value;
    }
  }
  return out;
}
