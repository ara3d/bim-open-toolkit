import { describe, expect, it } from 'vitest';
import {
  cameraPose,
  metresZUpLocal,
  orthographic,
  perspective,
  viewDistance,
  viewState,
  type Vec3,
  type ViewState,
} from '@bim-open-toolkit/model';
import { cameraBasis } from '../src/camera.js';
import { emptyFrame, type InputFrame, type PointerSample, type Viewport } from '../src/input.js';
import {
  advanceFlight,
  blendPose,
  blendProjection,
  defaultFlightMs,
  easings,
  flightFraction,
  flightView,
  flyTo,
  interrupts,
  isFlightDone,
  type EaseName,
} from '../src/animation.js';

const zUp: Vec3 = [0, 0, 1];
const viewport: Viewport = { width: 800, height: 400 };
const frame = (fields: Partial<InputFrame> = {}): InputFrame => ({ ...emptyFrame(viewport), ...fields });

const pointer = (fields: Partial<PointerSample> & { readonly id: number }): PointerSample => ({
  kind: 'touch',
  x: 0,
  y: 0,
  dx: 0,
  dy: 0,
  buttons: [],
  ...fields,
});

const near: ViewState = viewState(cameraPose([20, 0, 0], [0, 0, 0], zUp), perspective(50), metresZUpLocal);
const far: ViewState = viewState(cameraPose([0, 0, 2000], [10, 10, 5], zUp), perspective(30), metresZUpLocal);

// A clock a test winds by hand, in milliseconds.
const wind = (from: ViewState, to: ViewState, steps: readonly number[], durationMs = 1000) =>
  steps.reduce((flight, step) => advanceFlight(flight, step), flyTo(from, to, durationMs, 'linear'));

const easeNames: readonly EaseName[] = ['linear', 'easeIn', 'easeOut', 'easeInOut'];

describe('easings', () => {
  it('all start at nothing and end at everything', () => {
    for (const name of easeNames) {
      const ease = easings[name];
      expect(ease(0)).toBeCloseTo(0);
      expect(ease(1)).toBeCloseTo(1);
    }
  });

  it('never leave the range in between, and rise all the way', () => {
    for (const name of easeNames) {
      const ease = easings[name];
      let previous = -1;
      for (let step = 0; step <= 20; step++) {
        const value = ease(step / 20);
        expect(value).toBeGreaterThanOrEqual(-1e-12);
        expect(value).toBeLessThanOrEqual(1 + 1e-12);
        expect(value).toBeGreaterThanOrEqual(previous);
        previous = value;
      }
    }
  });

  it('start slowly when they ease in and finish slowly when they ease out', () => {
    expect(easings.easeIn(0.1)).toBeLessThan(0.1);
    expect(easings.easeOut(0.1)).toBeGreaterThan(0.1);
    expect(easings.easeInOut(0.25)).toBeLessThan(0.25);
    expect(easings.easeInOut(0.75)).toBeGreaterThan(0.75);
    expect(easings.linear(0.37)).toBeCloseTo(0.37);
  });
});

describe('flight timing', () => {
  it('starts at the beginning and lasts as long as it was given', () => {
    const flight = flyTo(near, far, 1000);
    expect(flight.elapsedMs).toBe(0);
    expect(flightFraction(flight)).toBe(0);
    expect(isFlightDone(flight)).toBe(false);
    expect(flyTo(near, far).durationMs).toBe(defaultFlightMs);
  });

  it('advances by the clock and stops at the end', () => {
    expect(flightFraction(wind(near, far, [250]))).toBeCloseTo(0.25);
    expect(flightFraction(wind(near, far, [250, 250, 250]))).toBeCloseTo(0.75);
    const over = wind(near, far, [600, 600, 600]);
    expect(flightFraction(over)).toBe(1);
    expect(over.elapsedMs).toBe(1000);
    expect(isFlightDone(over)).toBe(true);
  });

  it('never runs backwards, whatever the clock reports', () => {
    for (const bad of [-100, Number.NaN, Number.NEGATIVE_INFINITY]) {
      expect(advanceFlight(wind(near, far, [400]), bad).elapsedMs).toBe(400);
    }
  });

  it('is over before it starts when it is given no time', () => {
    const instant = flyTo(near, far, 0);
    expect(isFlightDone(instant)).toBe(true);
    expect(flightView(instant)).toBe(far);
  });
});

describe('flightView', () => {
  it('shows exactly where it started and exactly where it was going', () => {
    expect(flightView(wind(near, far, []))).toEqual(near);
    expect(flightView(wind(near, far, [1000]))).toBe(far);
  });

  it('moves the target evenly along the way', () => {
    expect(flightView(wind(near, far, [500])).camera.target).toEqual([5, 5, 2.5]);
  });

  it('changes distance by ratio, so half way is the geometric mean', () => {
    const half = flightView(wind(near, far, [500])).camera;
    expect(viewDistance(half)).toBeCloseTo(Math.sqrt(viewDistance(near.camera) * viewDistance(far.camera)));
  });

  it('turns the view direction smoothly and keeps it unit length', () => {
    for (const t of [0.1, 0.3, 0.6, 0.9]) {
      const view = flightView(wind(near, far, [t * 1000]));
      expect(Math.hypot(...cameraBasis(view.camera).forward)).toBeCloseTo(1, 10);
    }
  });

  it('blends the field of view between two perspective projections', () => {
    const half = flightView(wind(near, far, [500])).projection;
    expect(half.kind === 'perspective' && half.fieldOfViewDegrees).toBeCloseTo(40);
  });

  it('takes the destination projection at once when the kinds differ, framing being another matter', () => {
    const flat = viewState(cameraPose([0, 0, 30], [0, 0, 0], zUp), orthographic(12), metresZUpLocal);
    const quarter = flightView(wind(near, flat, [250])).projection;
    expect(quarter.kind).toBe('orthographic');
    expect(quarter.kind === 'orthographic' && quarter.height).toBe(12);
  });

  it('changes an orthographic frame by ratio', () => {
    const from = viewState(cameraPose([0, 0, 30], [0, 0, 0], zUp), orthographic(10), metresZUpLocal);
    const to = viewState(cameraPose([0, 0, 30], [0, 0, 0], zUp), orthographic(1000), metresZUpLocal);
    const half = blendProjection(from.projection, to.projection, 0.5);
    expect(half.kind === 'orthographic' && half.height).toBeCloseTo(100);
  });

  it('reports the frame the destination is in', () => {
    expect(flightView(wind(near, far, [100])).coordinates).toBe(far.coordinates);
  });
});

describe('blendPose', () => {
  it('is the pose itself at both ends', () => {
    expect(blendPose(near.camera, far.camera, 0)).toEqual({
      position: near.camera.position,
      target: near.camera.target,
      up: near.camera.up,
    });
    const end = blendPose(near.camera, far.camera, 1);
    expect(end.target).toEqual(far.camera.target);
    expect(end.position.every(Number.isFinite)).toBe(true);
  });

  it('survives a pose with no view direction at either end', () => {
    const still = cameraPose([3, 3, 3], [3, 3, 3], zUp);
    expect(blendPose(still, far.camera, 0.5).position.every(Number.isFinite)).toBe(true);
    expect(blendPose(near.camera, still, 0.5).position.every(Number.isFinite)).toBe(true);
  });
});

describe('interrupts', () => {
  it('is silent for an empty frame and for a mouse that is only hovering', () => {
    expect(interrupts(emptyFrame(viewport))).toBe(false);
    expect(interrupts(frame({ pointers: [pointer({ id: 1, kind: 'mouse', dx: 50 })] }))).toBe(false);
  });

  it('answers to a press, a touch, a wheel turn and a held key', () => {
    expect(interrupts(frame({ pointers: [pointer({ id: 1, kind: 'mouse', buttons: ['left'] })] }))).toBe(true);
    expect(interrupts(frame({ pointers: [pointer({ id: 1 })] }))).toBe(true);
    expect(interrupts(frame({ wheel: -1 }))).toBe(true);
    expect(interrupts(frame({ keys: ['w'] }))).toBe(true);
  });
});
