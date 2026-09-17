// The measurements the product brief asks for beyond frame time: how long loading took, phase by
// phase; how much memory a scene holds; and how long a bulk operation took to complete.
//
// The brief is explicit that a load time is not one number, that a GPU figure may be unavailable,
// and that an unavailable figure is reported as unavailable rather than replaced by a plausible
// one. That is why every reading carries a note and an absent value is `undefined`, not zero.

import { timingStats, type TimingStats } from './timings.js';

// The stages of loading the brief asks to be timed separately.
export const loadPhases = ['access', 'decode', 'normalize', 'upload', 'firstFrame', 'ready'] as const;

// One stage of loading.
export type LoadPhase = (typeof loadPhases)[number];

// How long each stage took. A stage that did not happen is 0 and is reported as such.
export type LoadTiming = { readonly phaseMs: Readonly<Record<LoadPhase, number>> };

// Every stage at zero.
export const emptyLoadTiming: LoadTiming = {
  phaseMs: { access: 0, decode: 0, normalize: 0, upload: 0, firstFrame: 0, ready: 0 },
};

// The whole load: every stage added together.
export const totalLoadMs = (timing: LoadTiming): number =>
  loadPhases.reduce((total, phase) => total + timing.phaseMs[phase], 0);

// Times the stages of a load as they finish.
export type LoadTimer = {
  // Records the time since the previous mark, or since the timer started, as this stage.
  readonly mark: (phase: LoadPhase) => void;
  readonly finish: () => LoadTiming;
};

// A timer over any clock, so the same code times a load in Node and inside a page.
export function loadTimer(nowMs: () => number): LoadTimer {
  const phaseMs: Record<LoadPhase, number> = { ...emptyLoadTiming.phaseMs };
  let previous = nowMs();
  return {
    mark: (phase) => {
      const at = nowMs();
      phaseMs[phase] += at - previous;
      previous = at;
    },
    finish: () => ({ phaseMs: { ...phaseMs } }),
  };
}

// One memory figure. An absent value means it could not be measured here, and the note says why.
export type MemoryReading = {
  readonly label: string;
  readonly heapBytes: number | undefined;
  readonly gpuBytes: number | undefined;
  readonly note: string;
};

// Bytes as megabytes, for a report.
export const megabytes = (bytes: number): number => bytes / (1024 * 1024);

// The process heap now. GPU allocation is not observable from Node, and says so.
export const nodeHeapReading = (label: string): MemoryReading => ({
  label,
  heapBytes: process.memoryUsage().heapUsed,
  gpuBytes: undefined,
  note: 'Node heap in use; GPU allocation is not observable from this process.',
});

// A reading nobody could take, kept in the report so the gap is visible.
export const unavailableReading = (label: string, note: string): MemoryReading => ({
  label,
  heapBytes: undefined,
  gpuBytes: undefined,
  note,
});

// One bulk operation, measured over repeated runs. `objectCount` is what the budget is stated per.
export type OperationMeasurement = {
  readonly operation: string;
  readonly objectCount: number;
  readonly samplesMs: readonly number[];
};

// A measured operation with its statistics, reported against the bulk update budget.
export type OperationReport = {
  readonly operation: string;
  readonly objectCount: number;
  readonly stats: TimingStats;
};

// The statistics of one measured operation.
export const operationReport = (
  measurement: OperationMeasurement,
  budgetMs: number,
): OperationReport => ({
  operation: measurement.operation,
  objectCount: measurement.objectCount,
  stats: timingStats(measurement.samplesMs, budgetMs),
});
