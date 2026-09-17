import { describe, expect, it } from 'vitest';
import { advancePlayback, createPlayback, pausePlayback, playPlayback, resetPlayback, sampleCircularTranslation, seekPlayback, setPlaybackRate } from '../src/animation.js';

describe('timestamp driven playback', () => {
  it('pauses without accruing idle time, resumes without a jump and preserves rate-change continuity', () => {
    let state = playPlayback(createPlayback(20, { timestamp: 100 }), 100);
    state = pausePlayback(state, 103);
    expect(state.time).toBe(3);
    state = playPlayback(state, 110);
    expect(state.time).toBe(3);
    state = setPlaybackRate(state, 2, 112);
    expect(state.time).toBe(5);
    expect(advancePlayback(state, 114).time).toBe(9);
  });

  it('clamps the end, restarts completed playback and resets to paused baseline', () => {
    const state = advancePlayback(playPlayback(createPlayback(2), 0), 10);
    expect(state.time).toBe(2);
    expect(state.playing).toBe(false);
    const restarted = playPlayback(state, 11);
    expect(restarted.time).toBe(0);
    expect(restarted.playing).toBe(true);
    expect(resetPlayback(restarted, 12)).toMatchObject({ time: 0, playing: false, rate: 1 });
  });

  it('loops deterministically across multiple periods and seeking matches direct playback', () => {
    const initial = createPlayback(10, { loop: true });
    const advanced = advancePlayback(playPlayback(initial, 0), 32.5);
    expect(advanced.time).toBe(2.5);
    const sought = seekPlayback(initial, 2.5, 32.5);
    expect(sampleCircularTranslation(advanced.time, { period: 10, radius: 2 })).toEqual(sampleCircularTranslation(sought.time, { period: 10, radius: 2 }));
    expect(seekPlayback(initial, -1, 0).time).toBe(0);
    expect(seekPlayback(initial, 99, 0).time).toBe(10);
    expect(initial.time).toBe(0);
  });

  it('rejects invalid clock/rate/duration and samples the circular baseline', () => {
    expect(() => createPlayback(0)).toThrow();
    expect(() => advancePlayback(createPlayback(1, { timestamp: 2 }), 1)).toThrow();
    expect(() => setPlaybackRate(createPlayback(1), 0, 0)).toThrow();
    expect(() => seekPlayback(createPlayback(1), NaN, 0)).toThrow();
    expect(sampleCircularTranslation(0, { period: 4, radius: 3 })).toEqual([0, 0, 0]);
    expect(sampleCircularTranslation(2, { period: 4, radius: 3 })[0]).toBeCloseTo(-6);
  });
});
