import { describe, expect, it } from 'vitest';
import {
  gpuDisjointExt,
  mostPendingQueries,
  timeElapsedExt,
  timerQueryFrameTimer,
  type TimerQueryContext,
} from '../../../src/feature-demos/_shared/gpu-timer.js';

// A fake WebGL2 context whose queries finish when the test says so, in nanoseconds. `WebGLQuery` is
// an empty interface in the DOM library, so a plain object carrying an ordinal is one.

const fakeContext = (options: { readonly hasExtension: boolean }) => {
  const results = new Map<number, number>();
  const deleted: number[] = [];
  const begun: number[] = [];
  let ordinal = 0;
  let disjoint = false;
  const ordinalOf = (query: WebGLQuery): number => ('ordinal' in query && typeof query.ordinal === 'number' ? query.ordinal : -1);
  const context: TimerQueryContext = {
    QUERY_RESULT: 0x8866,
    QUERY_RESULT_AVAILABLE: 0x8867,
    createQuery: () => ({ ordinal: ordinal++ }),
    deleteQuery: (query) => {
      if (query !== null) deleted.push(ordinalOf(query));
    },
    beginQuery: (target, query) => {
      expect(target).toBe(timeElapsedExt);
      begun.push(ordinalOf(query));
    },
    endQuery: (target) => {
      expect(target).toBe(timeElapsedExt);
    },
    getQueryParameter: (query, name) => {
      const at = ordinalOf(query);
      if (name === 0x8867) return results.has(at);
      return results.get(at);
    },
    getParameter: (name) => (name === gpuDisjointExt ? disjoint : undefined),
    getExtension: (name) => (options.hasExtension && name === 'EXT_disjoint_timer_query_webgl2' ? {} : null),
  };
  return {
    context,
    begun,
    deleted,
    finish: (at: number, nanoseconds: number) => results.set(at, nanoseconds),
    setDisjoint: (value: boolean) => {
      disjoint = value;
    },
  };
};

describe('the timer-query GPU timer', () => {
  it('is unavailable, with a reason, when the extension is not present', () => {
    const timer = timerQueryFrameTimer(fakeContext({ hasExtension: false }).context);
    expect(timer.availability).toEqual({ state: 'unavailable', reason: 'EXT_disjoint_timer_query_webgl2 is not present' });
    timer.begin();
    timer.end();
    expect(timer.poll()).toBeUndefined();
  });

  it('reports a finished query in milliseconds, oldest first, and deletes it', () => {
    const fake = fakeContext({ hasExtension: true });
    const timer = timerQueryFrameTimer(fake.context);
    expect(timer.availability.state).toBe('available');
    timer.begin();
    timer.end();
    timer.begin();
    timer.end();
    expect(timer.poll()).toBeUndefined();
    fake.finish(0, 2_500_000);
    fake.finish(1, 4_000_000);
    expect(timer.poll()).toBe(2.5);
    expect(timer.poll()).toBe(4);
    expect(timer.poll()).toBeUndefined();
    expect(fake.deleted).toEqual([0, 1]);
    expect(fake.begun).toEqual([0, 1]);
  });

  it('drops every pending query after a disjoint event rather than reporting it', () => {
    const fake = fakeContext({ hasExtension: true });
    const timer = timerQueryFrameTimer(fake.context);
    timer.begin();
    timer.end();
    timer.begin();
    timer.end();
    fake.finish(0, 1_000_000);
    fake.setDisjoint(true);
    expect(timer.poll()).toBeUndefined();
    expect(fake.deleted).toEqual([1, 0]);
    fake.setDisjoint(false);
    fake.finish(1, 1_000_000);
    expect(timer.poll()).toBeUndefined();
  });

  it('forgets the oldest unpolled query once too many are pending', () => {
    const fake = fakeContext({ hasExtension: true });
    const timer = timerQueryFrameTimer(fake.context);
    for (let i = 0; i <= mostPendingQueries; i++) {
      timer.begin();
      timer.end();
    }
    expect(fake.deleted).toEqual([0]);
  });

  it('ignores a second begin before the end, and an end with nothing begun', () => {
    const fake = fakeContext({ hasExtension: true });
    const timer = timerQueryFrameTimer(fake.context);
    timer.end();
    timer.begin();
    timer.begin();
    timer.end();
    expect(fake.begun).toEqual([0]);
  });
});
