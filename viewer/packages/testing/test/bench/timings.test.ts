import { describe, expect, it } from 'vitest';
import {
  bulkUpdateBudgetMs,
  cpuTimesOf,
  frameReport,
  frameTimeCollector,
  framesPerSecond,
  intervalsOf,
  percentile,
  targetFrameBudgetMs,
  timingStats,
} from '../../src/bench/timings.js';
import {
  emptyLoadTiming,
  loadPhases,
  loadTimer,
  megabytes,
  nodeHeapReading,
  operationReport,
  totalLoadMs,
  unavailableReading,
} from '../../src/bench/measurements.js';

describe('percentiles', () => {
  it('interpolates between neighbours', () => {
    expect(percentile([1, 2, 3, 4], 0)).toBe(1);
    expect(percentile([1, 2, 3, 4], 1)).toBe(4);
    expect(percentile([1, 2, 3, 4], 0.5)).toBeCloseTo(2.5);
  });

  it('does not care what order the values arrive in', () => {
    expect(percentile([4, 1, 3, 2], 0.5)).toBeCloseTo(percentile([1, 2, 3, 4], 0.5));
  });

  it('refuses an empty list rather than inventing a number', () => {
    expect(() => percentile([], 0.5)).toThrow(/no values/);
    expect(() => percentile([1], 1.5)).toThrow(/between 0 and 1/);
  });
});

describe('timing statistics', () => {
  it('reports the shape of the list and how much of it missed the budget', () => {
    const stats = timingStats([10, 20, 30, 40, 100], 35);
    expect(stats.count).toBe(5);
    expect(stats.minMs).toBe(10);
    expect(stats.maxMs).toBe(100);
    expect(stats.medianMs).toBe(30);
    expect(stats.meanMs).toBe(40);
    expect(stats.overBudget).toBe(2);
    expect(stats.budgetMs).toBe(35);
  });

  it('turns a median frame interval into frames a second', () => {
    expect(framesPerSecond(timingStats([20, 20, 20], targetFrameBudgetMs))).toBeCloseTo(50);
  });

  it('refuses to report on nothing', () => {
    expect(() => timingStats([], 1)).toThrow(/no values/);
  });

  it('states the two budgets the brief sets', () => {
    expect(targetFrameBudgetMs).toBeCloseTo(33.333, 2);
    expect(bulkUpdateBudgetMs).toBe(1000);
  });
});

describe('collecting frames', () => {
  it('numbers frames from zero and keeps both times', () => {
    const collector = frameTimeCollector();
    collector.add(4, 16);
    collector.add(6, 18);
    expect(collector.samples()).toEqual([
      { frame: 0, cpuMs: 4, intervalMs: 16 },
      { frame: 1, cpuMs: 6, intervalMs: 18 },
    ]);
    expect(intervalsOf(collector.samples())).toEqual([16, 18]);
    expect(cpuTimesOf(collector.samples())).toEqual([4, 6]);
    collector.reset();
    expect(collector.samples()).toEqual([]);
  });

  it('reports what the viewer saw separately from what the work cost', () => {
    const collector = frameTimeCollector();
    for (const interval of [16, 16, 50, 16]) collector.add(2, interval);
    const report = frameReport(collector.samples());
    expect(report.interval.maxMs).toBe(50);
    expect(report.cpu.maxMs).toBe(2);
    expect(report.interval.overBudget).toBe(1);
    expect(report.framesPerSecond).toBeCloseTo(62.5);
  });
});

describe('load timing', () => {
  it('records each phase as the time since the previous mark', () => {
    let clock = 0;
    const timer = loadTimer(() => clock);
    clock = 10;
    timer.mark('access');
    clock = 40;
    timer.mark('decode');
    clock = 45;
    timer.mark('ready');
    const timing = timer.finish();
    expect(timing.phaseMs.access).toBe(10);
    expect(timing.phaseMs.decode).toBe(30);
    expect(timing.phaseMs.ready).toBe(5);
    expect(timing.phaseMs.upload).toBe(0);
    expect(totalLoadMs(timing)).toBe(45);
  });

  it('adds up repeated marks of the same phase', () => {
    let clock = 0;
    const timer = loadTimer(() => clock);
    clock = 5;
    timer.mark('decode');
    clock = 12;
    timer.mark('decode');
    expect(timer.finish().phaseMs.decode).toBe(12);
  });

  it('starts with every phase at zero', () => {
    expect(loadPhases.every((phase) => emptyLoadTiming.phaseMs[phase] === 0)).toBe(true);
    expect(totalLoadMs(emptyLoadTiming)).toBe(0);
  });
});

describe('memory readings', () => {
  it('reads the node heap and says the GPU is not observable', () => {
    const reading = nodeHeapReading('after loading');
    expect(reading.heapBytes).toBeGreaterThan(0);
    expect(reading.gpuBytes).toBeUndefined();
    expect(reading.note).toMatch(/GPU/);
  });

  it('keeps a reading nobody could take, with the reason', () => {
    const reading = unavailableReading('gpu', 'no timer query extension');
    expect(reading.heapBytes).toBeUndefined();
    expect(reading.note).toBe('no timer query extension');
  });

  it('converts bytes to megabytes', () => {
    expect(megabytes(1024 * 1024)).toBe(1);
  });
});

describe('bulk operations', () => {
  it('reports an operation against the bulk update budget', () => {
    const report = operationReport(
      { operation: 'colour', objectCount: 10_000, samplesMs: [400, 450, 900, 1200] },
      bulkUpdateBudgetMs,
    );
    expect(report.operation).toBe('colour');
    expect(report.objectCount).toBe(10_000);
    expect(report.stats.overBudget).toBe(1);
    expect(report.stats.p95Ms).toBeGreaterThan(1000);
  });
});
