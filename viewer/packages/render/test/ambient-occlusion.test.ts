import { describe, expect, it } from 'vitest';
import { emptyBounds, type Bounds } from '@bim-open-toolkit/model';
import {
  ambientOcclusionPass,
  applyAmbientOcclusion,
  checkAmbientOcclusion,
  defaultAmbientOcclusion,
  heightFieldVisibility,
  leastResolutionScale,
  mostSamples,
  occlusionBufferSize,
  occlusionRadiusFor,
  type AmbientOcclusionPass,
  type HeightField,
} from '../src/ambient-occlusion.js';

const building: Bounds = { min: [0, 0, 0], max: [40, 30, 12] };
const handle: Bounds = { min: [0, 0, 0], max: [0.12, 0.02, 0.02] };

describe('checkAmbientOcclusion', () => {
  it('accepts the default', () => {
    expect(checkAmbientOcclusion(defaultAmbientOcclusion).ok).toBe(true);
  });

  it('refuses a negative radius and an intensity outside zero to one', () => {
    const radius = checkAmbientOcclusion({ ...defaultAmbientOcclusion, radius: -1 });
    expect(radius.ok).toBe(false);
    expect(radius.diagnostics[0]?.code).toBe('bad-radius');
    expect(checkAmbientOcclusion({ ...defaultAmbientOcclusion, intensity: 1.5 }).ok).toBe(false);
    expect(checkAmbientOcclusion({ ...defaultAmbientOcclusion, intensity: Number.NaN }).ok).toBe(false);
  });

  it('refuses a sample count that is fractional, zero or past the most a pass unrolls', () => {
    expect(checkAmbientOcclusion({ ...defaultAmbientOcclusion, samples: 2.5 }).ok).toBe(false);
    expect(checkAmbientOcclusion({ ...defaultAmbientOcclusion, samples: 0 }).ok).toBe(false);
    expect(checkAmbientOcclusion({ ...defaultAmbientOcclusion, samples: mostSamples + 1 }).ok).toBe(false);
    expect(checkAmbientOcclusion({ ...defaultAmbientOcclusion, samples: mostSamples }).ok).toBe(true);
  });

  it('refuses a resolution scale below a quarter or above one', () => {
    expect(checkAmbientOcclusion({ ...defaultAmbientOcclusion, resolutionScale: 0.1 }).ok).toBe(false);
    expect(checkAmbientOcclusion({ ...defaultAmbientOcclusion, resolutionScale: 2 }).ok).toBe(false);
    expect(checkAmbientOcclusion({ ...defaultAmbientOcclusion, resolutionScale: leastResolutionScale }).ok).toBe(true);
  });
});

describe('occlusionRadiusFor', () => {
  it('reaches two per cent of the widest extent', () => {
    expect(occlusionRadiusFor(building)).toBeCloseTo(0.8);
    expect(occlusionRadiusFor(handle)).toBeCloseTo(0.0024);
  });

  it('falls back to one unit for an empty or degenerate model', () => {
    expect(occlusionRadiusFor(emptyBounds)).toBe(1);
    expect(occlusionRadiusFor({ min: [3, 3, 3], max: [3, 3, 3] })).toBe(1);
  });
});

describe('occlusionBufferSize', () => {
  it('scales the drawing buffer and rounds to whole pixels', () => {
    expect(occlusionBufferSize({ ...defaultAmbientOcclusion, resolutionScale: 0.5 }, { width: 1281, height: 800 })).toEqual({
      width: 641,
      height: 400,
    });
    expect(occlusionBufferSize(defaultAmbientOcclusion, { width: 1280, height: 800 })).toEqual({ width: 1280, height: 800 });
  });

  it('is never smaller than one pixel on a side', () => {
    expect(occlusionBufferSize({ ...defaultAmbientOcclusion, resolutionScale: 0.25 }, { width: 1, height: 1 })).toEqual({
      width: 1,
      height: 1,
    });
  });
});

describe('ambientOcclusionPass', () => {
  it('resolves a zero radius from the model and passes everything else through', () => {
    const pass = ambientOcclusionPass(defaultAmbientOcclusion, building);
    expect(pass.ok).toBe(true);
    if (!pass.ok) return;
    expect(pass.value?.radius).toBeCloseTo(0.8);
    expect(pass.value?.intensity).toBe(defaultAmbientOcclusion.intensity);
    expect(pass.value?.samples).toBe(defaultAmbientOcclusion.samples);
    expect(pass.value?.output).toBe('shaded');
  });

  it('keeps an explicit radius', () => {
    const pass = ambientOcclusionPass({ ...defaultAmbientOcclusion, radius: 0.3 }, building);
    expect(pass.ok && pass.value?.radius).toBe(0.3);
  });

  it('is undefined when the settings turn it off', () => {
    const pass = ambientOcclusionPass({ ...defaultAmbientOcclusion, enabled: false }, building);
    expect(pass.ok).toBe(true);
    expect(pass.ok && pass.value).toBeUndefined();
  });

  it('checks the settings even when they are off', () => {
    expect(ambientOcclusionPass({ ...defaultAmbientOcclusion, enabled: false, samples: 0 }, building).ok).toBe(false);
  });
});

describe('applyAmbientOcclusion', () => {
  const fakeTarget = () => {
    const applied: (AmbientOcclusionPass | undefined)[] = [];
    return { applied, setAmbientOcclusion: (pass: AmbientOcclusionPass | undefined) => applied.push(pass) };
  };

  it('puts the pass in place and takes it away on disposal', () => {
    const target = fakeTarget();
    const result = applyAmbientOcclusion(target, defaultAmbientOcclusion, building);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(target.applied[0]?.radius).toBeCloseTo(0.8);
    result.value.dispose();
    expect(target.applied).toHaveLength(2);
    expect(target.applied[1]).toBeUndefined();
  });

  it('touches the target only when the settings are valid', () => {
    const target = fakeTarget();
    expect(applyAmbientOcclusion(target, { ...defaultAmbientOcclusion, intensity: -1 }, building).ok).toBe(false);
    expect(target.applied).toHaveLength(0);
  });
});

// A square field of `size` pixels one unit apart, with `heights` filled by a function of x and y.
const field = (size: number, heightAt: (x: number, y: number) => number): HeightField => {
  const heights = new Float32Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) heights[y * size + x] = heightAt(x, y);
  return { width: size, height: size, heights, spacing: 1 };
};

const at = (visibility: Float32Array, size: number, x: number, y: number): number => visibility[y * size + x] ?? Number.NaN;

describe('heightFieldVisibility', () => {
  const size = 21;
  const middle = 10;
  // A wall four units high along the middle column; the ground to either side is open.
  const wall = field(size, (x) => (x === middle ? 4 : 0));

  it('sees the whole sky from open ground', () => {
    const open = heightFieldVisibility(field(size, () => 0), 3, 8);
    expect(open.every((value) => value === 1)).toBe(true);
  });

  it('is darkest at the foot of a wall, lighter with distance, and open beyond the radius', () => {
    const visibility = heightFieldVisibility(wall, 3, 8);
    const foot = at(visibility, size, middle + 1, middle);
    const away = at(visibility, size, middle + 3, middle);
    const beyond = at(visibility, size, middle + 4, middle);
    expect(foot).toBeLessThan(1);
    expect(foot).toBeLessThan(away);
    expect(away).toBeLessThan(1);
    expect(beyond).toBe(1);
  });

  it('leaves the top of the wall open, because nothing rises above it', () => {
    expect(at(heightFieldVisibility(wall, 3, 8), size, middle, middle)).toBe(1);
  });

  it('is the same on both sides of the wall', () => {
    const visibility = heightFieldVisibility(wall, 3, 8);
    expect(at(visibility, size, middle - 2, middle)).toBeCloseTo(at(visibility, size, middle + 2, middle));
  });

  it('is darker in a corner than beside one wall', () => {
    const corner = field(size, (x, y) => (x === middle || y === middle ? 4 : 0));
    const oneWall = at(heightFieldVisibility(wall, 3, 8), size, middle + 1, middle + 5);
    const twoWalls = at(heightFieldVisibility(corner, 3, 8), size, middle + 1, middle + 1);
    expect(twoWalls).toBeLessThan(oneWall);
  });

  it('is darker for a taller wall and lighter for a wider spacing', () => {
    const tall = field(size, (x) => (x === middle ? 8 : 0));
    const low = at(heightFieldVisibility(wall, 3, 8), size, middle + 1, middle);
    const high = at(heightFieldVisibility(tall, 3, 8), size, middle + 1, middle);
    expect(high).toBeLessThan(low);
    const spread = { ...wall, spacing: 2 };
    expect(at(heightFieldVisibility(spread, 3, 8), size, middle + 1, middle)).toBeGreaterThan(low);
  });

  it('matches the closed form for a single wall seen from one pixel away', () => {
    // Four directions along the axes, marched at distances 1 and 2. Only the direction facing the
    // wall meets it, at distance 1 with a rise of 4; the other three are open.
    const visibility = heightFieldVisibility(wall, 2, 4, 2);
    const facing = 1 - Math.sin(Math.atan(4));
    expect(at(visibility, size, middle + 1, middle)).toBeCloseTo((facing + 3) / 4, 6);
  });

  it('refuses a radius, sample count, step count or spacing that is not positive', () => {
    expect(() => heightFieldVisibility(wall, 0, 8)).toThrow('radius');
    expect(() => heightFieldVisibility(wall, 3, 0)).toThrow('sample');
    expect(() => heightFieldVisibility(wall, 3, 8, 0)).toThrow('step');
    expect(() => heightFieldVisibility({ ...wall, spacing: 0 }, 3, 8)).toThrow('spacing');
  });
});
