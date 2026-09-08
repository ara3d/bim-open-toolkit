import { describe, expect, it } from 'vitest';
import {
  cameraPose,
  metresZUpLocal,
  perspective,
  viewDistance,
  viewState,
  type Vec3,
  type ViewState,
} from '@bim-open-toolkit/model';
import { cameraBasis } from '../src/camera.js';
import { emptyFrame, type InputFrame, type MouseButton, type PointerSample, type Viewport } from '../src/input.js';
import { navState, type NavState } from '../src/navigation.js';
import { flightFraction, type CameraFlight } from '../src/animation.js';
import { cancelFlight, isFlying, navSession, startFlight, stepSession, type NavSession } from '../src/session.js';

const zUp: Vec3 = [0, 0, 1];
const viewport: Viewport = { width: 800, height: 400 };

const startView: ViewState = viewState(cameraPose([20, 0, 0], [0, 0, 0], zUp), perspective(50), metresZUpLocal);
const destination: ViewState = viewState(cameraPose([0, 60, 30], [0, 0, 0], zUp), perspective(50), metresZUpLocal);

const session = (mode: NavState['mode'] = 'orbit'): NavSession => navSession(navState(startView, mode));

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

const drag = (buttons: readonly MouseButton[], dx: number, dy: number): InputFrame =>
  frame({ pointers: [pointer({ id: 1, kind: 'mouse', x: dx, y: dy, dx, dy, buttons })] });

// The flight a session must have, insisting rather than quietly standing in for it.
const flightOf = (from: NavSession): CameraFlight => {
  if (from.flight === undefined) throw new Error('expected the session to be flying');
  return from.flight;
};

// Steps the session with nothing happening, a frame at a time on a clock the test winds.
const coast = (from: NavSession, steps: number, stepMs = 100): NavSession =>
  Array.from({ length: steps }).reduce<NavSession>(
    (current) => stepSession(current, emptyFrame(viewport), stepMs),
    from,
  );

describe('a session without a flight', () => {
  it('just navigates', () => {
    const after = stepSession(session(), drag(['left'], 100, 0), 16);
    expect(isFlying(after)).toBe(false);
    expect(after.nav.view.camera.position[1]).toBeLessThan(0);
  });

  it('does nothing when nothing happens', () => {
    const idle = session();
    expect(stepSession(idle, emptyFrame(viewport), 16)).toEqual(idle);
  });
});

describe('flying to a view', () => {
  it('starts from where the view is now and reaches the destination exactly', () => {
    const flying = startFlight(session(), destination, 1000);
    expect(isFlying(flying)).toBe(true);
    expect(flying.flight?.from).toBe(startView);
    const arrived = coast(flying, 10);
    expect(arrived.nav.view).toEqual(destination);
    expect(isFlying(arrived)).toBe(false);
  });

  it('moves part of the way in part of the time', () => {
    const halfway = coast(startFlight(session(), destination, 1000), 5);
    expect(isFlying(halfway)).toBe(true);
    expect(flightFraction(flightOf(halfway))).toBeCloseTo(0.5);
    expect(halfway.nav.view.camera.position).not.toEqual(startView.camera.position);
    expect(halfway.nav.view.camera.position).not.toEqual(destination.camera.position);
  });

  it('does not depend on how the clock is chopped up', () => {
    const oneStep = stepSession(startFlight(session(), destination, 1000), emptyFrame(viewport), 400);
    const manySteps = coast(startFlight(session(), destination, 1000), 4);
    expect(oneStep.nav.view.camera.position[0]).toBeCloseTo(manySteps.nav.view.camera.position[0], 9);
    expect(oneStep.nav.view.camera.position[2]).toBeCloseTo(manySteps.nav.view.camera.position[2], 9);
  });

  it('replaces a flight already running, starting from where it had reached', () => {
    const halfway = coast(startFlight(session(), destination, 1000), 5);
    const redirected = startFlight(halfway, startView, 1000);
    expect(redirected.flight?.from).toEqual(halfway.nav.view);
    expect(redirected.flight?.elapsedMs).toBe(0);
  });

  it('arrives at once when given no time', () => {
    const instant = stepSession(startFlight(session(), destination, 0), emptyFrame(viewport), 16);
    expect(instant.nav.view).toBe(destination);
    expect(isFlying(instant)).toBe(false);
  });
});

describe('interrupting a flight', () => {
  it('hands the camera back on a press and carries on from where the flight had reached', () => {
    const halfway = coast(startFlight(session(), destination, 1000), 5);
    const reached = halfway.nav.view.camera;
    const grabbed = stepSession(halfway, drag(['left'], 100, 0), 16);
    expect(isFlying(grabbed)).toBe(false);
    expect(viewDistance(grabbed.nav.view.camera)).toBeCloseTo(viewDistance(reached));
    expect(grabbed.nav.view.camera.target).toEqual(reached.target);
    expect(grabbed.nav.view.camera.position).not.toEqual(reached.position);
  });

  it('is handed back by a wheel turn and by a held key too', () => {
    for (const input of [frame({ wheel: 100 }), frame({ keys: ['w'] })]) {
      expect(isFlying(stepSession(startFlight(session('first-person'), destination, 1000), input, 16))).toBe(false);
    }
  });

  it('is not handed back by a mouse merely crossing the picture', () => {
    const hovering = stepSession(startFlight(session(), destination, 1000), drag([], 100, 100), 100);
    expect(isFlying(hovering)).toBe(true);
    expect(flightFraction(flightOf(hovering))).toBeCloseTo(0.1);
  });

  it('can be dropped without moving the camera', () => {
    const halfway = coast(startFlight(session(), destination, 1000), 5);
    const dropped = cancelFlight(halfway);
    expect(isFlying(dropped)).toBe(false);
    expect(dropped.nav.view).toEqual(halfway.nav.view);
  });

  it('leaves a session that is not flying exactly as it was', () => {
    const idle = session();
    expect(cancelFlight(idle)).toBe(idle);
  });
});

describe('a flight under a mode constraint', () => {
  it('stays overhead all the way, because the mode says so', () => {
    const flying = startFlight(session('overhead'), destination, 1000);
    for (const steps of [1, 3, 5, 10]) {
      const at = coast(flying, steps);
      expect(cameraBasis(at.nav.view.camera).forward[2]).toBeCloseTo(-1);
      expect(at.nav.view.projection.kind).toBe('orthographic');
    }
  });
});

describe('robustness', () => {
  it('treats an impossible step length as no time passing', () => {
    const flying = startFlight(session(), destination, 1000);
    for (const bad of [Number.NaN, -50, Number.POSITIVE_INFINITY]) {
      expect(stepSession(flying, emptyFrame(viewport), bad).nav.view.camera.position).toEqual(startView.camera.position);
    }
  });
});
