import { describe, expect, it } from 'vitest';
import { float, gaussian, int, next, pick, range, seed, shuffle, type Rng } from '../src/prng.js';

// Collects `count` unsigned 32-bit draws from a seed.
function integers(from: number, count: number): number[] {
  const values: number[] = [];
  let rng = seed(from);
  for (let index = 0; index < count; index++) {
    const draw = next(rng);
    rng = draw.rng;
    values.push(draw.value);
  }
  return values;
}

// Expected outputs of splitmix32-seeded xoshiro128**, produced by an independent reference
// implementation of the published algorithms. They pin the wire format of the generator: a change
// here means every seeded fixture in the repository changes too.
const pinned: ReadonlyArray<readonly [number, readonly number[]]> = [
  [0, [1789933344, 44971166, 2521387044, 3848737593, 1138324114, 749234105, 1899511038, 1995189375]],
  [1, [393288148, 2174103013, 3814759091, 2092745082, 1865176206, 2179171167, 3207394750, 2858353069]],
  [12345, [1093274547, 203003357, 3741353573, 3803725158, 4178738660, 810247443, 1347789520, 4037788777]],
  [2026, [1488141057, 2736994499, 1930590800, 4121196190, 70697473, 868887433, 1443538011, 1781031851]],
];

describe('prng', () => {
  it('matches the pinned reference sequences', () => {
    for (const [from, expected] of pinned) expect(integers(from, expected.length)).toEqual([...expected]);
  });

  it('pins the first floats of seed 12345', () => {
    let rng: Rng = seed(12345);
    const values: number[] = [];
    for (let index = 0; index < 4; index++) {
      const draw = float(rng);
      rng = draw.rng;
      values.push(draw.value);
    }
    expect(values).toEqual([0.25454777479171753, 0.04726535081863403, 0.8711017370223999, 0.8856237530708313]);
  });

  it('repeats for the same seed and differs for another', () => {
    expect(integers(7, 16)).toEqual(integers(7, 16));
    expect(integers(7, 16)).not.toEqual(integers(8, 16));
  });

  it('never produces the all-zero state', () => {
    for (let from = -4; from < 8; from++) {
      const state = seed(from);
      expect(state.s0 | state.s1 | state.s2 | state.s3).not.toBe(0);
    }
  });

  it('leaves the input state untouched', () => {
    const rng = seed(3);
    const before = { ...rng };
    next(rng);
    float(rng);
    gaussian(rng, 0, 1);
    expect(rng).toEqual(before);
  });

  it('draws floats inside [0, 1)', () => {
    let rng = seed(11);
    for (let index = 0; index < 5000; index++) {
      const draw = float(rng);
      rng = draw.rng;
      expect(draw.value).toBeGreaterThanOrEqual(0);
      expect(draw.value).toBeLessThan(1);
    }
  });

  it('draws ranges inside their bounds and covers them', () => {
    let rng = seed(13);
    let lowest = Number.POSITIVE_INFINITY;
    let highest = Number.NEGATIVE_INFINITY;
    for (let index = 0; index < 5000; index++) {
      const draw = range(rng, -2.5, 7.5);
      rng = draw.rng;
      lowest = Math.min(lowest, draw.value);
      highest = Math.max(highest, draw.value);
    }
    expect(lowest).toBeGreaterThanOrEqual(-2.5);
    expect(highest).toBeLessThan(7.5);
    expect(lowest).toBeLessThan(-2.4);
    expect(highest).toBeGreaterThan(7.4);
  });

  it('draws every integer of a small range and nothing outside it', () => {
    let rng = seed(17);
    const counts = new Map<number, number>();
    for (let index = 0; index < 4000; index++) {
      const draw = int(rng, 3, 8);
      rng = draw.rng;
      counts.set(draw.value, (counts.get(draw.value) ?? 0) + 1);
    }
    expect([...counts.keys()].sort((a, b) => a - b)).toEqual([3, 4, 5, 6, 7]);
    for (const count of counts.values()) expect(count).toBeGreaterThan(600);
  });

  it('rejects empty and inverted ranges', () => {
    const rng = seed(1);
    expect(() => int(rng, 5, 5)).toThrow();
    expect(() => int(rng, 5, 1)).toThrow();
    expect(() => int(rng, 0.5, 5)).toThrow();
    expect(() => range(rng, 5, 5)).toThrow();
    expect(() => pick(rng, [])).toThrow();
  });

  it('picks only members of the array', () => {
    const items = ['a', 'b', 'c'] as const;
    let rng = seed(19);
    const seen = new Set<string>();
    for (let index = 0; index < 200; index++) {
      const draw = pick<string>(rng, [...items]);
      rng = draw.rng;
      seen.add(draw.value);
    }
    expect([...seen].sort()).toEqual(['a', 'b', 'c']);
  });

  it('shuffles into a permutation without touching the input', () => {
    const items = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
    const draw = shuffle(seed(23), items);
    expect(items).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect([...draw.value].sort((a, b) => a - b)).toEqual(items);
    expect(draw.value).not.toEqual(items);
    expect(shuffle(seed(23), items).value).toEqual(draw.value);
    expect(shuffle(seed(24), items).value).not.toEqual(draw.value);
  });

  it('shuffles an empty or single-element array to a copy', () => {
    expect(shuffle(seed(1), []).value).toEqual([]);
    expect(shuffle(seed(1), ['only']).value).toEqual(['only']);
  });

  it('draws gaussians with the requested mean and spread', () => {
    let rng = seed(29);
    const values: number[] = [];
    for (let index = 0; index < 20000; index++) {
      const draw = gaussian(rng, 10, 2);
      rng = draw.rng;
      values.push(draw.value);
    }
    const mean = values.reduce((total, value) => total + value, 0) / values.length;
    const variance = values.reduce((total, value) => total + (value - mean) ** 2, 0) / values.length;
    expect(mean).toBeGreaterThan(9.9);
    expect(mean).toBeLessThan(10.1);
    expect(Math.sqrt(variance)).toBeGreaterThan(1.9);
    expect(Math.sqrt(variance)).toBeLessThan(2.1);
    for (const value of values) {
      expect(value).toBeGreaterThanOrEqual(10 - 12);
      expect(value).toBeLessThanOrEqual(10 + 12);
    }
  });
});
