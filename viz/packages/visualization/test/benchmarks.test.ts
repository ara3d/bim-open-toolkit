import { describe, expect, it, vi } from 'vitest';
import { measureOperation, summarizeMeasurements } from '../src/benchmarks.js';

describe('measureOperation', () => {
  it('excludes warmups, uses nearest rank and retains input sample order', async () => {
    let time = 0, index = 0;
    const progress = vi.fn();
    const result = await measureOperation(() => { time += [100, 100, 9, 1, 3, 7][index++]!; }, { name: 'color', counts: { objects: 10_000 }, warmups: 2, samples: 4, now: () => time, onProgress: progress });
    expect(result).toEqual({ name: 'color', counts: { objects: 10_000 }, warmups: 2, samples: [9, 1, 3, 7], p50: 3, p95: 9, unit: 'ms' });
    expect(progress).toHaveBeenNthCalledWith(2, { phase: 'warmup', completed: 2, total: 2 });
    expect(progress).toHaveBeenLastCalledWith({ phase: 'sample', completed: 4, total: 4 });
    expect(summarizeMeasurements(Array.from({ length: 20 }, (_, i) => i + 1))).toEqual({ p50: 10, p95: 19 });
  });
  it('awaits operation completion before sampling the clock', async () => {
    let clock = 1;
    const result = await measureOperation(async () => { await Promise.resolve(); clock += 12; }, { warmups: 0, samples: 1, now: () => clock });
    expect(result.samples).toEqual([12]);
  });
  it.each([{ warmups: -1, samples: 1 }, { warmups: 0, samples: 0 }, { warmups: 0.1, samples: 1 }, { warmups: 0, samples: 1, counts: { objects: Infinity } }])('rejects invalid measurement options', async options => {
    const operation = vi.fn();
    await expect(measureOperation(operation, options)).rejects.toMatchObject({ code: 'invalid-options' });
    expect(operation).not.toHaveBeenCalled();
  });
  it('rejects invalid or backwards clocks', async () => {
    await expect(measureOperation(() => {}, { warmups: 0, samples: 1, now: () => NaN })).rejects.toMatchObject({ code: 'invalid-clock' });
    let time = 2;
    await expect(measureOperation(() => {}, { warmups: 0, samples: 1, now: () => time-- })).rejects.toMatchObject({ code: 'invalid-clock' });
  });
  it('propagates operation and progress failures without fabricated results', async () => {
    const failure = new Error('render failed');
    await expect(measureOperation(() => { throw failure; }, { warmups: 0, samples: 2 })).rejects.toBe(failure);
    await expect(measureOperation(() => {}, { warmups: 0, samples: 2, onProgress: () => { throw failure; } })).rejects.toBe(failure);
  });
  it('honors pre-cancellation and promptly cancels a pending operation', async () => {
    const before = new AbortController(); before.abort();
    const operation = vi.fn();
    await expect(measureOperation(operation, { warmups: 0, samples: 1, signal: before.signal })).rejects.toMatchObject({ code: 'cancelled' });
    expect(operation).not.toHaveBeenCalled();
    const during = new AbortController();
    const pending = measureOperation(() => new Promise<void>(() => {}), { warmups: 0, samples: 1, signal: during.signal });
    await Promise.resolve(); during.abort();
    await expect(pending).rejects.toMatchObject({ code: 'cancelled' });
  });
  it('cancels between samples and snapshots workload counts', async () => {
    const controller = new AbortController();
    const operation = vi.fn();
    await expect(measureOperation(operation, { warmups: 0, samples: 3, signal: controller.signal, onProgress: () => controller.abort() })).rejects.toMatchObject({ code: 'cancelled' });
    expect(operation).toHaveBeenCalledTimes(1);
    const counts = { objects: 1 };
    const result = await measureOperation(() => { counts.objects = 9; }, { warmups: 0, samples: 1, counts });
    expect(result.counts.objects).toBe(1);
  });
});
