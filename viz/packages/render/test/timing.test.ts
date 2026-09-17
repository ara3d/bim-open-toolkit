import { describe, expect, it } from 'vitest';
import { buildInstanceTable } from '../src/instance-table.js';
import {
  DurationLog,
  FrameTimer,
  frameBudgetMs,
  framesPerSecond,
  gpuUnavailable,
  hudData,
  noDurations,
  noGpuTimer,
  percentileOf,
  readGpuTimer,
  sceneStatistics,
  type GpuFrameTimer,
} from '../src/timing.js';
import { writeVisibility } from '../src/updates.js';
import { fixtureKey, standardKeys, standardScene } from './fixture.js';

const logOf = (values: readonly number[], capacity = 240): DurationLog => {
  const log = new DurationLog(capacity);
  for (const value of values) log.add(value);
  return log;
};

describe('percentileOf', () => {
  it('reports a value that was actually measured', () => {
    const sorted = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    expect(percentileOf(sorted, 0.5)).toBe(5);
    expect(percentileOf(sorted, 0.95)).toBe(10);
    expect(percentileOf(sorted, 0)).toBe(1);
    expect(percentileOf([], 0.5)).toBe(0);
  });
});

describe('DurationLog', () => {
  it('reports the run it holds', () => {
    const stats = logOf([10, 20, 30, 40]).stats();
    expect(stats.count).toBe(4);
    expect(stats.minMs).toBe(10);
    expect(stats.maxMs).toBe(40);
    expect(stats.medianMs).toBe(20);
    expect(stats.p95Ms).toBe(40);
  });

  it('forgets the oldest values once it is full', () => {
    const log = logOf([1, 2, 3, 100, 100, 100], 3);
    expect(log.size).toBe(3);
    expect(log.capacity).toBe(3);
    expect(log.stats().minMs).toBe(100);
  });

  it('ignores a reading that is not a duration', () => {
    const log = logOf([Number.NaN, -1, Number.POSITIVE_INFINITY]);
    expect(log.size).toBe(0);
    expect(log.stats()).toEqual(noDurations);
  });

  it('forgets everything on reset', () => {
    const log = logOf([1, 2, 3]);
    log.reset();
    expect(log.stats()).toEqual(noDurations);
  });
});

describe('FrameTimer', () => {
  it('measures the interval between presented frames, not the first frame', () => {
    const timer = new FrameTimer();
    expect(timer.mark(1000)).toBeUndefined();
    expect(timer.mark(1016)).toBe(16);
    expect(timer.mark(1049)).toBe(33);
    expect(timer.size).toBe(2);
    expect(timer.stats().medianMs).toBe(16);
  });

  it('ignores a clock that went backwards or stopped being a number', () => {
    const timer = new FrameTimer();
    timer.mark(1000);
    expect(timer.mark(900)).toBeUndefined();
    expect(timer.mark(Number.NaN)).toBeUndefined();
    expect(timer.size).toBe(0);
  });

  it('starts again after a reset, so a resize does not leave a long frame in the run', () => {
    const timer = new FrameTimer();
    timer.mark(0);
    timer.mark(500);
    timer.reset();
    expect(timer.mark(1000)).toBeUndefined();
    expect(timer.stats()).toEqual(noDurations);
  });
});

describe('framesPerSecond', () => {
  it('converts a frame time, and reports nothing for no measurement', () => {
    expect(framesPerSecond(16)).toBeCloseTo(62.5, 6);
    expect(framesPerSecond(frameBudgetMs)).toBeCloseTo(30, 6);
    expect(framesPerSecond(0)).toBe(0);
  });
});

describe('GPU timing', () => {
  const workingTimer = (readings: number[]): GpuFrameTimer => ({
    availability: { state: 'available' },
    begin: () => undefined,
    end: () => undefined,
    poll: () => readings.shift(),
  });

  it('says it is unavailable and why, rather than reporting a zero', () => {
    const reading = readGpuTimer(noGpuTimer(), new DurationLog());
    expect(reading.state).toBe('unavailable');
    if (reading.state !== 'unavailable') return;
    expect(reading.reason).toContain('extension');
    const refused = gpuUnavailable('driver refused');
    expect(refused.state === 'unavailable' && refused.reason).toBe('driver refused');
  });

  it('drains every finished measurement into the log', () => {
    const log = new DurationLog();
    const reading = readGpuTimer(workingTimer([4, 5, 6]), log);
    expect(reading.state).toBe('available');
    if (reading.state !== 'available') return;
    expect(reading.stats.count).toBe(3);
    expect(reading.stats.medianMs).toBe(5);
  });

  it('reports what it has when nothing has finished yet', () => {
    const reading = readGpuTimer(workingTimer([]), new DurationLog());
    expect(reading.state === 'available' && reading.stats).toEqual(noDurations);
  });
});

describe('sceneStatistics', () => {
  it('distinguishes source objects, rendered instances, visible instances and triangles', () => {
    const geometry = standardScene();
    const result = buildInstanceTable(geometry, standardKeys);
    if (!result.ok) throw new Error('fixture did not build');
    const table = result.value;
    expect(sceneStatistics(table, geometry)).toEqual({
      sourceObjects: 5,
      groups: 3,
      renderedInstances: 5,
      visibleInstances: 5,
      renderedTriangles: 60,
    });
    writeVisibility(table, Int32Array.of(0, 1), Uint8Array.of(0));
    expect(sceneStatistics(table, geometry).visibleInstances).toBe(3);
    expect(sceneStatistics(table, geometry).renderedInstances).toBe(5);
  });
});

describe('hudData', () => {
  const scene = {
    sourceObjects: 5,
    groups: 3,
    renderedInstances: 5,
    visibleInstances: 5,
    renderedTriangles: 60,
  };

  it('reports frames a second and whether the 95th percentile met the budget', () => {
    const fast = hudData(logOf([16, 16, 17, 16]).stats(), { state: 'unavailable', reason: 'none' }, scene, 'perspective');
    expect(fast.framesPerSecond).toBeCloseTo(62.5, 6);
    expect(fast.withinBudget).toBe(true);
    const slow = hudData(logOf([16, 16, 16, 90]).stats(), { state: 'unavailable', reason: 'none' }, scene, 'orthographic');
    expect(slow.withinBudget).toBe(false);
    expect(slow.camera).toBe('orthographic');
  });

  it('is out of budget when nothing has been measured, rather than claiming success', () => {
    expect(hudData(noDurations, { state: 'unavailable', reason: 'none' }, scene, 'perspective').withinBudget).toBe(false);
  });

  it('carries the pointed-at object only when there is one', () => {
    const gpu = { state: 'unavailable', reason: 'none' } as const;
    expect(hudData(noDurations, gpu, scene, 'perspective').pointedAt).toBeUndefined();
    expect(hudData(noDurations, gpu, scene, 'perspective', fixtureKey(2)).pointedAt).toBe(fixtureKey(2));
  });
});
