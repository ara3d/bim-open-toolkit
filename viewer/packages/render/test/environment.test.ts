import { describe, expect, it } from 'vitest';
import { emptyBounds, type Bounds } from '@bim-open-toolkit/model';
import {
  applyEnvironment,
  axisLengthFor,
  axisLines,
  checkEnvironment,
  defaultEnvironment,
  environmentDrawing,
  gridLines,
  gridSpacingFor,
  groundHeight,
  type EnvironmentDrawing,
} from '../src/environment.js';

const building: Bounds = { min: [0, 0, 0], max: [40, 30, 12] };
const handle: Bounds = { min: [0, 0, 0], max: [0.12, 0.02, 0.02] };

describe('checkEnvironment', () => {
  it('accepts the default', () => {
    expect(checkEnvironment(defaultEnvironment).ok).toBe(true);
  });

  it('refuses a colour outside zero to one', () => {
    const result = checkEnvironment({ ...defaultEnvironment, background: [2, 0, 0] });
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe('bad-color');
  });

  it('refuses a sun with no direction and an intensity that is not a number', () => {
    expect(checkEnvironment({ ...defaultEnvironment, rig: { ...defaultEnvironment.rig, sunDirection: [0, 0, 0] } }).ok).toBe(false);
    expect(checkEnvironment({ ...defaultEnvironment, rig: { ...defaultEnvironment.rig, sunIntensity: Number.NaN } }).ok).toBe(false);
    expect(checkEnvironment({ ...defaultEnvironment, rig: { ...defaultEnvironment.rig, warmth: 2 } }).ok).toBe(false);
  });

  it('refuses a negative grid spacing and a fractional emphasis', () => {
    expect(checkEnvironment({ ...defaultEnvironment, grid: { ...defaultEnvironment.grid, spacing: -1 } }).ok).toBe(false);
    expect(checkEnvironment({ ...defaultEnvironment, grid: { ...defaultEnvironment.grid, emphasisEvery: 1.5 } }).ok).toBe(false);
  });
});

describe('gridSpacingFor', () => {
  it('picks a spacing a person reads, scaled to the model', () => {
    expect(gridSpacingFor(building)).toBe(2);
    expect(gridSpacingFor(handle)).toBe(0.005);
    expect(gridSpacingFor({ min: [0, 0, 0], max: [1000, 1000, 20] })).toBe(50);
  });

  it('falls back to one metre for an empty or degenerate bounds', () => {
    expect(gridSpacingFor(emptyBounds)).toBe(1);
    expect(gridSpacingFor({ min: [3, 3, 3], max: [3, 3, 3] })).toBe(1);
  });

  it('gives between ten and fifty lines across the model', () => {
    for (const size of [0.5, 7, 40, 350, 9000]) {
      const bounds: Bounds = { min: [0, 0, 0], max: [size, size, size] };
      const lines = size / gridSpacingFor(bounds);
      expect(lines).toBeGreaterThanOrEqual(10);
      expect(lines).toBeLessThanOrEqual(50);
    }
  });
});

describe('gridLines', () => {
  it('covers the model and reaches one spacing past it', () => {
    const lines = gridLines(defaultEnvironment, building);
    expect(lines.length).toBeGreaterThan(0);
    const xs = lines.flatMap((line) => [line.from[0], line.to[0]]);
    expect(Math.min(...xs)).toBe(-2);
    expect(Math.max(...xs)).toBe(42);
  });

  it('lies in the ground plane of the declared up axis', () => {
    const zUp = gridLines(defaultEnvironment, building, 5);
    expect(zUp.every((line) => line.from[2] === 5 && line.to[2] === 5)).toBe(true);
    const yUp = gridLines({ ...defaultEnvironment, up: 'y' }, building, 5);
    expect(yUp.every((line) => line.from[1] === 5 && line.to[1] === 5)).toBe(true);
  });

  it('emphasises every nth line', () => {
    const lines = gridLines(defaultEnvironment, building);
    const emphasis = lines.filter((line) => line.color === defaultEnvironment.grid.emphasisColor);
    expect(emphasis.length).toBeGreaterThan(0);
    expect(emphasis.length).toBeLessThan(lines.length);
  });

  it('draws nothing when it is turned off', () => {
    expect(gridLines({ ...defaultEnvironment, grid: { ...defaultEnvironment.grid, enabled: false } }, building)).toHaveLength(0);
  });

  it('honours an explicit spacing', () => {
    const lines = gridLines({ ...defaultEnvironment, grid: { ...defaultEnvironment.grid, spacing: 10 } }, building);
    const xs = [...new Set(lines.map((line) => line.from[0]))].sort((a, b) => a - b);
    expect((xs[1] ?? 0) - (xs[0] ?? 0)).toBe(10);
  });

  it('draws a default grid at the origin for an empty model', () => {
    expect(gridLines(defaultEnvironment, emptyBounds).length).toBeGreaterThan(0);
  });
});

describe('axisLines', () => {
  it('draws three axes of the asked-for length', () => {
    const axes = axisLines(defaultEnvironment, 5);
    expect(axes).toHaveLength(3);
    expect(axes[0]?.to).toEqual([5, 0, 0]);
    expect(axes[2]?.to).toEqual([0, 0, 5]);
  });

  it('draws nothing when they are turned off or the length is not positive', () => {
    expect(axisLines({ ...defaultEnvironment, axes: false }, 5)).toHaveLength(0);
    expect(axisLines(defaultEnvironment, 0)).toHaveLength(0);
  });

  it('takes its length from the grid spacing', () => {
    expect(axisLengthFor(defaultEnvironment, building)).toBe(2);
    expect(axisLengthFor({ ...defaultEnvironment, grid: { ...defaultEnvironment.grid, spacing: 7 } }, building)).toBe(7);
  });
});

describe('groundHeight', () => {
  it('sits at the bottom of the model on the up axis', () => {
    expect(groundHeight(defaultEnvironment, { min: [0, 0, -3], max: [1, 1, 1] })).toBe(-3);
    expect(groundHeight({ ...defaultEnvironment, up: 'y' }, { min: [0, -4, 0], max: [1, 1, 1] })).toBe(-4);
  });

  it('sits at zero for an empty model', () => {
    expect(groundHeight(defaultEnvironment, emptyBounds)).toBe(0);
  });
});

describe('environmentDrawing and applyEnvironment', () => {
  const fakeTarget = () => {
    const applied: (EnvironmentDrawing | undefined)[] = [];
    return { applied, setEnvironment: (drawing: EnvironmentDrawing | undefined) => applied.push(drawing) };
  };

  it('collects everything a renderer draws', () => {
    const drawing = environmentDrawing(defaultEnvironment, building);
    expect(drawing.ok).toBe(true);
    if (!drawing.ok) return;
    expect(drawing.value.grid.length).toBeGreaterThan(0);
    expect(drawing.value.axes).toHaveLength(3);
    expect(drawing.value.groundHeight).toBe(0);
    expect(drawing.value.background).toEqual(defaultEnvironment.background);
  });

  it('puts the environment in place and takes it away on disposal', () => {
    const target = fakeTarget();
    const result = applyEnvironment(target, defaultEnvironment, building);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(target.applied[0]?.grid.length).toBeGreaterThan(0);
    result.value.dispose();
    expect(target.applied[1]).toBeUndefined();
    expect(target.applied).toHaveLength(2);
  });

  it('touches the target only when the settings are valid', () => {
    const target = fakeTarget();
    expect(applyEnvironment(target, { ...defaultEnvironment, background: [-1, 0, 0] }, building).ok).toBe(false);
    expect(target.applied).toHaveLength(0);
  });
});
