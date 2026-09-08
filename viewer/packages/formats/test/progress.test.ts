import { describe, expect, it } from 'vitest';
import { formatCode } from '../src/diagnostics.js';
import {
  isCancelled,
  reportProgress,
  throwIfCancelled,
  withinPhase,
  type LoadProgress,
} from '../src/progress.js';

describe('progress and cancellation', () => {
  it('reports a step with and without a known total', () => {
    const seen: LoadProgress[] = [];
    const context = { onProgress: (p: LoadProgress) => seen.push(p) };
    reportProgress(context, 'parse', 1, 2);
    reportProgress(context, 'convert', 3);
    expect(seen).toEqual([
      { phase: 'parse', loaded: 1, total: 2 },
      { phase: 'convert', loaded: 3 },
    ]);
  });

  it('publishes nothing once the caller has cancelled', () => {
    const seen: LoadProgress[] = [];
    const context = { onProgress: (p: LoadProgress) => seen.push(p), signal: AbortSignal.abort() };
    expect(isCancelled(context)).toBe(true);
    expect(() => reportProgress(context, 'parse', 1)).toThrowError(/cancelled/i);
    expect(seen).toEqual([]);
  });

  it('ends a load with the cancellation code', () => {
    try {
      throwIfCancelled({ signal: AbortSignal.abort() });
      expect.unreachable('throwIfCancelled should have thrown');
    } catch (error) {
      expect(error).toMatchObject({ code: formatCode.cancelled });
    }
  });

  it('does nothing when there is no signal or it has not aborted', () => {
    expect(isCancelled({})).toBe(false);
    expect(() => throwIfCancelled({ signal: new AbortController().signal })).not.toThrow();
  });

  it('relabels an inner loader’s progress into one phase', () => {
    const seen: LoadProgress[] = [];
    const inner = withinPhase({ onProgress: (p: LoadProgress) => seen.push(p) }, 'convert');
    reportProgress(inner, 'parse', 1, 2);
    expect(seen).toEqual([{ phase: 'convert', loaded: 1, total: 2 }]);
  });
});
