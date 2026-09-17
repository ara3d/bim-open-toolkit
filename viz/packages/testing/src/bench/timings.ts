// Frame times, percentiles and the statistics a report states.
//
// The product brief asks for median and 95th-percentile frame time against a 33.3 ms budget, and
// for bulk operations to be reported at the 95th percentile against a 1,000 ms budget. Those are
// the same arithmetic over different lists, so there is one statistics function and two budgets.
//
// Two numbers are kept per frame, because they answer different questions. `intervalMs` is the gap
// between frames, which is what a person sees. `cpuMs` is the time spent in the work being
// measured, which is what a change to that work moves. A frame can be slow because the page is
// slow, so a report that shows only one of them is not honest.

// One measured frame.
export type FrameTimeSample = {
  readonly frame: number;
  readonly cpuMs: number;
  readonly intervalMs: number;
};

// Collects frames as they happen.
export type FrameTimeCollector = {
  readonly add: (cpuMs: number, intervalMs: number) => void;
  readonly samples: () => readonly FrameTimeSample[];
  readonly reset: () => void;
};

// A collector that numbers frames from zero.
export function frameTimeCollector(): FrameTimeCollector {
  let samples: FrameTimeSample[] = [];
  return {
    add: (cpuMs, intervalMs) => { samples.push({ frame: samples.length, cpuMs, intervalMs }); },
    samples: () => samples,
    reset: () => { samples = []; },
  };
}

// The gaps between frames, which is what a viewer sees.
export const intervalsOf = (samples: readonly FrameTimeSample[]): readonly number[] =>
  samples.map((sample) => sample.intervalMs);

// The time spent in the measured work each frame.
export const cpuTimesOf = (samples: readonly FrameTimeSample[]): readonly number[] =>
  samples.map((sample) => sample.cpuMs);

// The value at a fraction of the way through the sorted list, interpolating between neighbours.
// `percentile(values, 0.95)` is the 95th percentile. Throws on an empty list rather than inventing
// a number for a measurement nobody took.
export function percentile(valuesMs: readonly number[], fraction: number): number {
  if (valuesMs.length === 0) throw new Error('percentile of no values');
  if (!(fraction >= 0 && fraction <= 1)) throw new Error(`fraction must be between 0 and 1, got ${fraction}`);
  const sorted = [...valuesMs].sort((a, b) => a - b);
  const position = fraction * (sorted.length - 1);
  const lower = Math.floor(position);
  const upper = Math.ceil(position);
  const low = sorted[lower] ?? 0;
  const high = sorted[upper] ?? low;
  return low + (high - low) * (position - lower);
}

// The frame budget thirty frames a second implies.
export const targetFrameBudgetMs = 1000 / 30;

// The completion budget the brief sets for a bulk update of ten thousand objects.
export const bulkUpdateBudgetMs = 1000;

// What a report states about a list of times.
export type TimingStats = {
  readonly count: number;
  readonly meanMs: number;
  readonly medianMs: number;
  readonly p95Ms: number;
  readonly minMs: number;
  readonly maxMs: number;
  readonly budgetMs: number;
  // Values above the budget. Reported as a count, not as a pass or a fail.
  readonly overBudget: number;
};

// The statistics of a list of times against a budget.
export function timingStats(valuesMs: readonly number[], budgetMs: number): TimingStats {
  if (valuesMs.length === 0) throw new Error('timing statistics of no values');
  const total = valuesMs.reduce((sum, value) => sum + value, 0);
  return {
    count: valuesMs.length,
    meanMs: total / valuesMs.length,
    medianMs: percentile(valuesMs, 0.5),
    p95Ms: percentile(valuesMs, 0.95),
    minMs: Math.min(...valuesMs),
    maxMs: Math.max(...valuesMs),
    budgetMs,
    overBudget: valuesMs.filter((value) => value > budgetMs).length,
  };
}

// Frames a second implied by the median frame interval.
export const framesPerSecond = (stats: TimingStats): number =>
  stats.medianMs <= 0 ? Infinity : 1000 / stats.medianMs;

// The frame statistics of a run: what the viewer saw and what the measured work cost.
export type FrameReport = {
  readonly interval: TimingStats;
  readonly cpu: TimingStats;
  readonly framesPerSecond: number;
};

// Both sets of statistics for a run of frames.
export function frameReport(
  samples: readonly FrameTimeSample[],
  budgetMs: number = targetFrameBudgetMs,
): FrameReport {
  const interval = timingStats(intervalsOf(samples), budgetMs);
  return { interval, cpu: timingStats(cpuTimesOf(samples), budgetMs), framesPerSecond: framesPerSecond(interval) };
}
