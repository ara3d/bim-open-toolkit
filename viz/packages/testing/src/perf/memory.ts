/**
 * Heap accounting for the performance tests.
 *
 * `heapUsed` is a sampled number, so treat every figure as a comparison between
 * two layouts measured the same way rather than an exact object size. A
 * collection is forced before and after each reading: without one, a collection
 * that happens to run during a reading makes a structure look free, or even
 * negative.
 *
 * Node normally exposes a collection only under `--expose-gc`. `enableGarbageCollection`
 * turns it on from inside the process instead, so the perf run needs no special
 * command line.
 */
import { setFlagsFromString } from 'node:v8';
import { runInNewContext } from 'node:vm';

const isThunk = (value: unknown): value is () => void => typeof value === 'function';

let collector: (() => void) | undefined;

/** True when a collection can be forced. */
export const canCollectGarbage = (): boolean => collector !== undefined;

/**
 * Makes `collectGarbage` work. Returns whether it can. Safe to call repeatedly.
 *
 * Sets the flag the runtime reads and evaluates `gc` in a fresh context, which
 * reaches the collector without restarting the process. The flag is turned off
 * again so the rest of the run behaves as it did before.
 */
export function enableGarbageCollection(): boolean {
  if (collector) return true;
  const existing: unknown = globalThis.gc;
  if (isThunk(existing)) {
    collector = existing;
    return true;
  }
  setFlagsFromString('--expose-gc');
  const exposed: unknown = runInNewContext('gc');
  setFlagsFromString('--no-expose-gc');
  if (isThunk(exposed)) collector = exposed;
  return collector !== undefined;
}

/** Runs a full collection when one is available. Does nothing otherwise. */
export function collectGarbage(): void {
  collector?.();
}

/** Heap bytes in use. */
export const heapUsedBytes = (): number => process.memoryUsage().heapUsed;

export interface HeapGrowth<TValue> {
  /** Heap bytes retained after `build`. */
  readonly bytes: number;
  /** The built value, returned so the caller keeps it alive across the measurement. */
  readonly value: TValue;
}

/**
 * Heap growth caused by `build`, with the result kept reachable while it is
 * measured. `attempts` readings are taken and the median is reported, so one
 * disturbed reading does not decide the answer.
 */
export function measureHeapGrowth<TValue>(build: () => TValue, attempts = 3): HeapGrowth<TValue> {
  const readings: number[] = [];
  let value: TValue | undefined;
  for (let i = 0; i < attempts; i++) {
    collectGarbage();
    const before = heapUsedBytes();
    const built = build();
    collectGarbage();
    readings.push(heapUsedBytes() - before);
    value = built;
  }
  if (value === undefined) throw new Error('measureHeapGrowth needs at least one attempt');
  readings.sort((a, b) => a - b);
  const middle = readings[readings.length >> 1];
  return { bytes: middle ?? 0, value };
}

export const megabytes = (bytes: number): number => bytes / (1024 * 1024);
