/**
 * Timing helpers for this package's performance tests. Never imported by `src`.
 *
 * A report is returned as text and written to a file as well as printed, because the vitest run
 * swallows console output and the numbers are the point of the run.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// One measured quantity: every sample, and the median, which is what a report should quote.
export type Measurement = {
  readonly name: string;
  readonly samples: readonly number[];
  readonly median: number;
};

// The middle sample, or the mean of the middle two.
export function median(samples: readonly number[]): number {
  if (samples.length === 0) return Number.NaN;
  const sorted = [...samples].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle] ?? Number.NaN
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

// Runs `work` once to warm up, then `repetitions` times, timing each run.
export async function repeat<T>(
  name: string,
  repetitions: number,
  work: () => Promise<T> | T,
): Promise<{ readonly measurement: Measurement; readonly last: T }> {
  let last = await work();
  const samples: number[] = [];
  for (let run = 0; run < repetitions; run += 1) {
    const started = performance.now();
    last = await work();
    samples.push(performance.now() - started);
  }
  return { measurement: { name, samples, median: median(samples) }, last };
}

// Times one run of `work` without repeating it, for steps too slow to sample.
export async function once<T>(name: string, work: () => Promise<T> | T): Promise<{
  readonly measurement: Measurement;
  readonly value: T;
}> {
  const started = performance.now();
  const value = await work();
  const elapsed = performance.now() - started;
  return { measurement: { name, samples: [elapsed], median: elapsed }, value };
}

// A markdown table of measurements.
export function report(title: string, measurements: readonly Measurement[]): string {
  const lines = [`### ${title}`, '', '| Step | Median ms | Samples |', '|---|---:|---|'];
  for (const each of measurements)
    lines.push(`| ${each.name} | ${each.median.toFixed(1)} | ${each.samples.map((s) => s.toFixed(0)).join(', ')} |`);
  return `${lines.join('\n')}\n`;
}

// A count or size list for the same report.
export function reportValues(title: string, values: Readonly<Record<string, number | string>>): string {
  const lines = [`### ${title}`, ''];
  for (const [name, value] of Object.entries(values))
    lines.push(`- ${name}: ${typeof value === 'number' ? value.toLocaleString('en-US') : value}`);
  return `${lines.join('\n')}\n`;
}

// Where a written report lands: `viewer/packages/formats/docs/<name>`.
const docsDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'docs');

// Prints a report and writes it beside the package docs, so the numbers survive the run.
export function writeReport(name: string, sections: readonly string[]): void {
  const text = sections.join('\n');
  console.log(text);
  mkdirSync(docsDirectory, { recursive: true });
  writeFileSync(resolve(docsDirectory, name), text, 'utf-8');
}
