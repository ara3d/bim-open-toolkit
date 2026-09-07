export type MeasurementProgress = { readonly phase: 'warmup' | 'sample'; readonly completed: number; readonly total: number };
export type MeasurementOptions = {
  readonly warmups: number; readonly samples: number; readonly name?: string;
  readonly counts?: Readonly<Record<string, number>>; readonly now?: () => number; readonly signal?: AbortSignal;
  readonly onProgress?: (progress: MeasurementProgress) => void;
};
export type OperationMeasurement = {
  readonly name: string; readonly counts: Readonly<Record<string, number>>; readonly warmups: number;
  readonly samples: readonly number[]; readonly p50: number; readonly p95: number; readonly unit: 'ms';
};
export class MeasurementError extends Error {
  constructor(readonly code: 'invalid-options' | 'invalid-clock' | 'cancelled', message: string) { super(message); this.name = 'MeasurementError'; }
}
/** Nearest-rank quantiles, preserving the caller's sample order. */
export function summarizeMeasurements(samples: readonly number[]): { readonly p50: number; readonly p95: number } {
  if (!samples.length || samples.some(value => !Number.isFinite(value) || value < 0)) throw new MeasurementError('invalid-options', 'Measurements must contain finite nonnegative durations');
  const sorted = [...samples].sort((a, b) => a - b);
  return { p50: sorted[Math.ceil(sorted.length * 0.5) - 1]!, p95: sorted[Math.ceil(sorted.length * 0.95) - 1]! };
}
const checkAbort = (signal?: AbortSignal) => { if (signal?.aborted) throw new MeasurementError('cancelled', 'Measurement cancelled'); };
async function runOperation(operation: (signal?: AbortSignal) => void | Promise<void>, signal?: AbortSignal): Promise<void> {
  checkAbort(signal);
  if (!signal) { await operation(); return; }
  let onAbort!: () => void;
  const cancelled = new Promise<never>((_resolve, reject) => {
    onAbort = () => reject(new MeasurementError('cancelled', 'Measurement cancelled'));
    signal.addEventListener('abort', onAbort, { once: true });
  });
  try { await Promise.race([Promise.resolve().then(() => { checkAbort(signal); return operation(signal); }), cancelled]); checkAbort(signal); }
  finally { signal.removeEventListener('abort', onAbort); }
}
/** Measures the supplied completion contract. Operation/progress errors propagate unchanged. */
export async function measureOperation(operation: (signal?: AbortSignal) => void | Promise<void>, options: MeasurementOptions): Promise<OperationMeasurement> {
  const { warmups, samples, name = 'operation', counts = {}, now = () => performance.now(), signal, onProgress } = options;
  if (!Number.isSafeInteger(warmups) || warmups < 0 || !Number.isSafeInteger(samples) || samples <= 0 || !Number.isSafeInteger(warmups + samples)
    || Object.values(counts).some(value => !Number.isSafeInteger(value) || value < 0)) throw new MeasurementError('invalid-options', 'Warmups/counts must be nonnegative integers and samples must be positive');
  checkAbort(signal);
  const workload = { ...counts };
  const durations: number[] = [];
  for (let index = 0; index < warmups + samples; index++) {
    checkAbort(signal);
    const start = now();
    if (!Number.isFinite(start)) throw new MeasurementError('invalid-clock', 'Clock must return finite milliseconds');
    await runOperation(operation, signal);
    const end = now();
    if (!Number.isFinite(end) || end < start) throw new MeasurementError('invalid-clock', 'Clock must advance monotonically');
    if (index >= warmups) durations.push(end - start);
    const phase = index < warmups ? 'warmup' : 'sample';
    onProgress?.({ phase, completed: phase === 'warmup' ? index + 1 : index - warmups + 1, total: phase === 'warmup' ? warmups : samples });
  }
  checkAbort(signal);
  return { name, counts: workload, warmups, samples: durations, ...summarizeMeasurements(durations), unit: 'ms' };
}
