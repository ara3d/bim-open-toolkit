/**
 * Approximate heap accounting for the performance tests.
 *
 * `heapUsed` is a sampled number, not an exact object size, so treat every
 * figure here as a comparison between two layouts measured the same way, not
 * as an allocation count. Run the perf suite with `NODE_OPTIONS=--expose-gc`
 * to have a collection run before each reading; without it the numbers still
 * work as a comparison but include garbage.
 *
 * The package has no `@types/node`, so the two runtime shapes used here are
 * declared locally and checked before use.
 */

/** The part of Node's `process.memoryUsage()` result this module reads. */
interface HeapUsage {
  readonly heapUsed: number;
}

interface ProcessLike {
  memoryUsage(): HeapUsage;
}

const isProcessLike = (value: unknown): value is ProcessLike =>
  typeof value === 'object' && value !== null && 'memoryUsage' in value
  && typeof value.memoryUsage === 'function';

const isThunk = (value: unknown): value is () => void => typeof value === 'function';

// Typed as `object` so `in` narrows the two properties to `unknown` rather than
// reaching for the global type, which has no index signature.
const globals: object = globalThis;

const globalProcess = (): unknown => ('process' in globals ? globals.process : undefined);
const globalGc = (): unknown => ('gc' in globals ? globals.gc : undefined);

const nodeProcess = (): ProcessLike | undefined => {
  const candidate = globalProcess();
  return isProcessLike(candidate) ? candidate : undefined;
};

/** True when a collection can be forced, i.e. the process was started with --expose-gc. */
export const canCollectGarbage = (): boolean => isThunk(globalGc());

/** Runs a full collection when the runtime exposes one. Does nothing otherwise. */
export function collectGarbage(): void {
  const gc = globalGc();
  if (isThunk(gc)) gc();
}

/** Heap bytes in use, or 0 when the runtime does not report them. */
export const heapUsedBytes = (): number => nodeProcess()?.memoryUsage().heapUsed ?? 0;

export interface HeapGrowth<TValue> {
  /** Heap bytes retained after `build`. */
  readonly bytes: number;
  /** The built value, returned so the caller keeps it alive across the measurement. */
  readonly value: TValue;
}

/** Heap growth caused by `build`, with the result kept reachable while it is measured. */
export function measureHeapGrowth<TValue>(build: () => TValue): HeapGrowth<TValue> {
  collectGarbage();
  const before = heapUsedBytes();
  const value = build();
  collectGarbage();
  return { bytes: heapUsedBytes() - before, value };
}

export const megabytes = (bytes: number): number => bytes / (1024 * 1024);
