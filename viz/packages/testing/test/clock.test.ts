import { describe, expect, it } from 'vitest';
import { cameraPose, metresZUpLocal, perspective, viewState } from '@bim-open-toolkit/model';
// Imported to prove the clock drives the real animation, not a copy of its shape. The testing
// package does not depend on interact at run time; this is a test-only import.
import { advanceFlight, flightView, flyTo, isFlightDone } from '@bim-open-toolkit/interact';
import { fakeClock } from '../src/clock.js';

describe('the fake clock', () => {
  it('starts where it is told and only moves when advanced', () => {
    const clock = fakeClock({ startMs: 100 });
    expect(clock.now()).toBe(100);
    clock.advance(50);
    expect(clock.now()).toBe(150);
  });

  it('runs a callback at its due time, not at the time advanced to', () => {
    const clock = fakeClock();
    const seen: number[] = [];
    clock.after(10, (timeMs) => seen.push(timeMs));
    expect(clock.advance(100)).toBe(1);
    expect(seen).toEqual([10]);
    expect(clock.now()).toBe(100);
  });

  it('runs callbacks in time order, and in scheduling order at the same time', () => {
    const clock = fakeClock();
    const seen: string[] = [];
    clock.after(20, () => seen.push('late'));
    clock.after(10, () => seen.push('first at ten'));
    clock.after(10, () => seen.push('second at ten'));
    clock.advance(30);
    expect(seen).toEqual(['first at ten', 'second at ten', 'late']);
  });

  it('does not run a callback that is not due yet, and reports when it is', () => {
    const clock = fakeClock();
    clock.after(10, () => undefined);
    expect(clock.advance(5)).toBe(0);
    expect(clock.pending()).toBe(1);
    expect(clock.nextDueMs()).toBe(10);
  });

  it('cancels a callback, and cancelling twice is harmless', () => {
    const clock = fakeClock();
    let ran = false;
    const cancel = clock.after(10, () => { ran = true; });
    cancel();
    cancel();
    expect(clock.advance(100)).toBe(0);
    expect(ran).toBe(false);
    expect(clock.pending()).toBe(0);
  });

  it('runs a callback scheduled for a time already past at the next advance', () => {
    const clock = fakeClock({ startMs: 50 });
    const seen: number[] = [];
    clock.at(10, (timeMs) => seen.push(timeMs));
    expect(clock.advance(1)).toBe(1);
    expect(seen).toEqual([50]);
  });

  it('picks up work scheduled from inside a callback that comes due in the same advance', () => {
    const clock = fakeClock();
    const seen: number[] = [];
    clock.after(10, (timeMs) => {
      seen.push(timeMs);
      clock.after(10, (later) => seen.push(later));
    });
    expect(clock.advance(30)).toBe(2);
    expect(seen).toEqual([10, 20]);
  });

  it('refuses to move backwards', () => {
    const clock = fakeClock({ startMs: 100 });
    expect(() => clock.advance(-1)).toThrow(/at least 0/);
    expect(() => clock.advanceTo(50)).toThrow(/move the clock back/);
  });

  it('stops a callback that reschedules itself with no delay instead of hanging', () => {
    const clock = fakeClock({ maxCallbacksPerAdvance: 50 });
    const again = (): void => { clock.after(0, again); };
    clock.after(0, again);
    expect(() => clock.advance(1)).toThrow(/reschedules itself/);
  });
});

describe('the clock as a frame scheduler', () => {
  it('delivers one frame per interval', () => {
    const clock = fakeClock({ frameIntervalMs: 16 });
    const times: number[] = [];
    const loop = (timeMs: number): void => {
      times.push(timeMs);
      clock.frames(loop);
    };
    clock.frames(loop);
    clock.advance(50);
    expect(times).toEqual([16, 32, 48]);
  });

  it('stops delivering frames once the request is cancelled', () => {
    const clock = fakeClock({ frameIntervalMs: 16 });
    let frames = 0;
    const cancel = clock.frames(() => { frames += 1; });
    cancel();
    clock.advance(100);
    expect(frames).toBe(0);
  });

  it('refuses to run a frame loop that never ends', () => {
    const clock = fakeClock({ frameIntervalMs: 16, maxCallbacksPerAdvance: 20 });
    const loop = (): void => { clock.frames(loop); };
    clock.frames(loop);
    expect(() => clock.runPending()).toThrow(/for ever/);
  });
});

describe('driving a camera flight', () => {
  const from = viewState(cameraPose([0, -10, 0], [0, 0, 0], [0, 0, 1]), perspective(), metresZUpLocal);
  const to = viewState(cameraPose([10, 0, 0], [0, 0, 0], [0, 0, 1]), perspective(), metresZUpLocal);

  it('advances a real CameraFlight one frame at a time and lands exactly on its destination', () => {
    const clock = fakeClock({ frameIntervalMs: 100 });
    let flight = flyTo(from, to, 600);
    let lastFrameMs = clock.now();
    const step = (timeMs: number): void => {
      flight = advanceFlight(flight, timeMs - lastFrameMs);
      lastFrameMs = timeMs;
      if (!isFlightDone(flight)) clock.frames(step);
    };
    clock.frames(step);
    clock.runPending();
    expect(clock.now()).toBe(600);
    expect(isFlightDone(flight)).toBe(true);
    expect(flightView(flight).camera.position).toEqual(to.camera.position);
  });

  it('is halfway along the flight halfway through its time', () => {
    const clock = fakeClock();
    const flight = flyTo(from, to, 1000);
    clock.advance(500);
    const halfway = flightView(advanceFlight(flight, clock.now()));
    expect(halfway.camera.position).not.toEqual(from.camera.position);
    expect(halfway.camera.position).not.toEqual(to.camera.position);
  });
});
