/**
 * Timing helpers for the performance tests.
 *
 * Every case repeats untimed setup, then times one body call. The median of
 * the repetitions is reported because it is far less sensitive to a single
 * scheduling hiccup than the mean, and the minimum and maximum are kept so a
 * noisy run is visible rather than hidden.
 */

/** Result of one measured case. Times are milliseconds. */
export interface Sample {
  readonly label: string;
  readonly medianMs: number;
  readonly minMs: number;
  readonly maxMs: number;
  readonly repetitions: number;
  /** Value the last repetition returned, so the timed work cannot be optimised away. */
  readonly result: number;
}

/** One thing to measure. */
export interface Case<TState> {
  readonly label: string;
  /** Runs before each timed repetition and is not timed. Restore mutated state here. */
  readonly setup: () => TState;
  /** The timed work. Must return a number derived from the work it did. */
  readonly body: (state: TState) => number;
}

export interface MeasureOptions {
  readonly repetitions: number;
  readonly warmups: number;
}

/**
 * Well above the five timed repetitions the measurement protocol requires.
 *
 * Seven was tried first and was not enough: on a busy machine the medians of two
 * cases a few hundred microseconds apart swapped places between runs, so a test
 * asserting the relationship between them failed at random. Twenty-five costs
 * milliseconds and made those medians stable. Cases whose body takes tens of
 * milliseconds pass their own smaller count.
 */
export const defaultMeasureOptions: MeasureOptions = { repetitions: 25, warmups: 5 };

const nowMs = (): number => performance.now();

/** Middle value, or the mean of the two middle values. Throws on an empty list. */
export function median(values: readonly number[]): number {
  if (values.length === 0) throw new Error('median of no values');
  const sorted = [...values].sort((a, b) => a - b);
  const half = sorted.length >> 1;
  if (sorted.length % 2 === 1) return sorted[half] ?? 0;
  return ((sorted[half - 1] ?? 0) + (sorted[half] ?? 0)) / 2;
}

/** Runs the case and returns its statistics. */
export function measureCase<TState>(
  subject: Case<TState>,
  options: MeasureOptions = defaultMeasureOptions,
): Sample {
  const times: number[] = [];
  let result = 0;
  for (let i = 0; i < options.warmups + options.repetitions; i++) {
    const state = subject.setup();
    const start = nowMs();
    result = subject.body(state);
    const elapsed = nowMs() - start;
    if (i >= options.warmups) times.push(elapsed);
  }
  return {
    label: subject.label,
    medianMs: median(times),
    minMs: Math.min(...times),
    maxMs: Math.max(...times),
    repetitions: options.repetitions,
    result,
  };
}

/** The sample with this label. Throws if it is missing, so an assertion cannot pass by accident. */
export function sampleFor(samples: readonly Sample[], label: string): Sample {
  const found = samples.find((sample) => sample.label === label);
  if (!found) throw new Error(`no sample labelled "${label}"`);
  return found;
}

/** How many times slower `slower` is than `faster`. */
export const slowdown = (slower: Sample, faster: Sample): number =>
  faster.medianMs === 0 ? Infinity : slower.medianMs / faster.medianMs;

const round = (value: number): string => value.toFixed(value < 10 ? 3 : 1);

/** A markdown table of medians, minimums and maximums. */
export function formatSamples(samples: readonly Sample[]): string {
  const rows = samples.map((sample) => [
    sample.label,
    round(sample.medianMs),
    round(sample.minMs),
    round(sample.maxMs),
    String(sample.repetitions),
  ]);
  const header = ['case', 'median ms', 'min ms', 'max ms', 'reps'];
  const widths = header.map((title, column) =>
    Math.max(title.length, ...rows.map((row) => (row[column] ?? '').length)));
  const line = (cells: readonly string[]): string =>
    `| ${cells.map((cell, i) => cell.padEnd(widths[i] ?? 0)).join(' | ')} |`;
  return [
    line(header),
    `| ${widths.map((width) => '-'.repeat(width)).join(' | ')} |`,
    ...rows.map(line),
  ].join('\n');
}

/** Prints a titled table of samples so a perf run leaves readable evidence. */
export function reportSamples(title: string, samples: readonly Sample[]): void {
  console.log(`\n${title}\n${formatSamples(samples)}`);
}
