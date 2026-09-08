import { describe, expect, it } from 'vitest';
import {
  cameraPose,
  metresZUpLocal,
  perspective,
  viewDistance,
  viewState,
  type Bounds,
  type Vec3,
  type ViewState,
} from '@bim-open-toolkit/model';
import { cameraBasis, orbitAngles, screenHeading } from '../src/camera.js';
import { frameHeightAt } from '../src/projection.js';
import { defaultBindings } from '../src/bindings.js';
import {
  emptyFrame,
  type InputFrame,
  type ModifierName,
  type MouseButton,
  type PointerSample,
  type Viewport,
} from '../src/input.js';
import {
  constrainToMode,
  defaultNavSettings,
  firstPersonMode,
  fitState,
  modeReducers,
  navState,
  orbitMode,
  overheadMode,
  setMode,
  stepNavigation,
  type NavState,
} from '../src/navigation.js';

const zUp: Vec3 = [0, 0, 1];
const viewport: Viewport = { width: 800, height: 400 };

// A perspective view twenty metres east of the origin, looking at it.
const startView: ViewState = viewState(cameraPose([20, 0, 0], [0, 0, 0], zUp), perspective(50), metresZUpLocal);

const start = (mode: NavState['mode'] = 'orbit'): NavState => navState(startView, mode);

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

// A mouse drag of that many pixels, with those buttons and modifiers held.
const drag = (
  buttons: readonly MouseButton[],
  dx: number,
  dy: number,
  modifiers: readonly ModifierName[] = [],
): InputFrame =>
  frame({ modifiers, pointers: [pointer({ id: 1, kind: 'mouse', x: dx, y: dy, dx, dy, buttons })] });

// The height of scene the view covers at its target, which is what a full drag pans by.
const screenHeight = (state: NavState): number =>
  frameHeightAt(state.view.projection, viewDistance(state.view.camera));

const dt = 1 / 60;

describe('orbit navigation', () => {
  it('lets the scene follow the pointer: dragging right swings the camera left', () => {
    const before = start();
    const after = stepNavigation(before, drag(['left'], 100, 0), dt);
    const turned = orbitAngles(after.view.camera, zUp).azimuth - orbitAngles(before.view.camera, zUp).azimuth;
    expect(turned).toBeCloseTo((-100 / viewport.height) * defaultNavSettings.rotateSpeed);
    expect(after.view.camera.position[1]).toBeLessThan(0);
    expect(viewDistance(after.view.camera)).toBeCloseTo(20);
  });

  it('lifts the camera when the pointer is dragged down', () => {
    const after = stepNavigation(start(), drag(['left'], 0, 100), dt);
    expect(after.view.camera.position[2]).toBeGreaterThan(0);
  });

  it('turns by the same angle for the same fraction of the viewport, at any size', () => {
    const small = stepNavigation(start(), drag(['left'], 50, 0), dt);
    const tall: InputFrame = {
      ...drag(['left'], 100, 0),
      viewport: { width: 1600, height: 800 },
    };
    expect(orbitAngles(small.view.camera, zUp).azimuth).toBeCloseTo(
      orbitAngles(stepNavigation(start(), tall, dt).view.camera, zUp).azimuth,
    );
  });

  it('clamps the tilt so the camera never flips over either pole', () => {
    const held = (dy: number): number => {
      let state = start();
      for (let i = 0; i < 30; i++) state = stepNavigation(state, drag(['left'], 0, dy), dt);
      return orbitAngles(state.view.camera, zUp).polar;
    };
    expect(held(100)).toBeCloseTo(defaultNavSettings.orbit.minPolar);
    expect(held(-100)).toBeCloseTo(defaultNavSettings.orbit.maxPolar);
  });

  it('pans with the right button, moving the scene with the pointer', () => {
    const state = start();
    const after = stepNavigation(state, drag(['right'], 100, 0), dt);
    expect(after.view.camera.target[1]).toBeCloseTo((-100 / viewport.height) * screenHeight(state));
    expect(viewDistance(after.view.camera)).toBeCloseTo(20);
  });

  it('pans instead of orbiting when shift is held, because that binding is more specific', () => {
    const shifted = stepNavigation(start(), drag(['left'], 100, 0, ['shift']), dt);
    expect(shifted.view.camera.target[1]).toBeLessThan(0);
    expect(orbitAngles(shifted.view.camera, zUp).azimuth).toBeCloseTo(orbitAngles(startView.camera, zUp).azimuth);
  });

  it('dollies with the wheel and clamps at the distance limits', () => {
    expect(viewDistance(stepNavigation(start(), frame({ wheel: 100 }), dt).view.camera)).toBeCloseTo(
      20 * Math.exp(0.1),
    );
    expect(viewDistance(stepNavigation(start(), frame({ wheel: 1e9 }), dt).view.camera)).toBeCloseTo(
      defaultNavSettings.orbit.maxDistance,
    );
    expect(viewDistance(stepNavigation(start(), frame({ wheel: -1e9 }), dt).view.camera)).toBeCloseTo(
      defaultNavSettings.orbit.minDistance,
    );
  });

  it('ignores a mouse that is only hovering', () => {
    const state = start();
    expect(stepNavigation(state, drag([], 100, 100), dt)).toBe(state);
  });

  it('does nothing at all when nothing is happening', () => {
    const state = start();
    expect(stepNavigation(state, emptyFrame(viewport), dt)).toBe(state);
  });
});

describe('touch navigation', () => {
  it('orbits with one finger', () => {
    const after = stepNavigation(start(), frame({ pointers: [pointer({ id: 1, x: 100, dx: 100 })] }), dt);
    expect(orbitAngles(after.view.camera, zUp).azimuth).not.toBeCloseTo(orbitAngles(startView.camera, zUp).azimuth);
  });

  it('pans with two fingers moving together, without turning', () => {
    const state = start();
    const together = frame({
      pointers: [pointer({ id: 1, x: 50, dx: 50 }), pointer({ id: 2, x: 250, dx: 50 })],
    });
    const after = stepNavigation(state, together, dt);
    expect(after.view.camera.target[1]).toBeCloseTo((-50 / viewport.height) * screenHeight(state));
    expect(orbitAngles(after.view.camera, zUp).azimuth).toBeCloseTo(orbitAngles(startView.camera, zUp).azimuth);
  });

  it('moves closer when two fingers spread apart, without panning', () => {
    const apart = frame({
      pointers: [pointer({ id: 1, x: 0, dx: -50 }), pointer({ id: 2, x: 200, dx: 50 })],
    });
    const after = stepNavigation(start(), apart, dt);
    expect(viewDistance(after.view.camera)).toBeCloseTo(10);
    expect(after.view.camera.target).toEqual([0, 0, 0]);
  });

  it('moves away when two fingers close together', () => {
    const closing = frame({
      pointers: [pointer({ id: 1, x: 50, dx: 50 }), pointer({ id: 2, x: 150, dx: -50 })],
    });
    expect(viewDistance(stepNavigation(start(), closing, dt).view.camera)).toBeCloseTo(40);
  });

  it('ignores a finger count that is not bound', () => {
    const three = frame({
      pointers: [pointer({ id: 1, dx: 50 }), pointer({ id: 2, x: 100, dx: 50 }), pointer({ id: 3, x: 200, dx: 50 })],
    });
    expect(stepNavigation(start(), three, dt).view.camera).toEqual(startView.camera);
  });
});

describe('first-person navigation', () => {
  it('turns the view in place rather than around a target', () => {
    const after = firstPersonMode(start('first-person'), drag(['left'], 100, 0), dt);
    expect(after.view.camera.position).toEqual(startView.camera.position);
    expect(after.view.camera.target).not.toEqual(startView.camera.target);
  });

  it('looks where the pointer goes, and the other way when the look is inverted', () => {
    const state = start('first-person');
    const down = firstPersonMode(state, drag(['left'], 0, 100), dt);
    const inverted = firstPersonMode(
      { ...state, settings: { ...state.settings, invertLook: true } },
      drag(['left'], 0, 100),
      dt,
    );
    expect(cameraBasis(down.view.camera).forward[2]).toBeLessThan(0);
    expect(cameraBasis(inverted.view.camera).forward[2]).toBeGreaterThan(0);
  });

  it('walks at the settings speed for as long as the key is held', () => {
    const state = start('first-person');
    const after = firstPersonMode(state, frame({ keys: ['w'] }), 1);
    expect(after.view.camera.position).toEqual([15, 0, 0]);
    expect(firstPersonMode(state, frame({ keys: ['w'] }), 2).view.camera.position).toEqual([10, 0, 0]);
  });

  it('does not go faster diagonally', () => {
    const state = start('first-person');
    const straight = firstPersonMode(state, frame({ keys: ['w'] }), 1).view.camera.position;
    const diagonal = firstPersonMode(state, frame({ keys: ['w', 'd'] }), 1).view.camera.position;
    const moved = (to: Vec3): number => Math.hypot(to[0] - 20, to[1], to[2]);
    expect(moved(diagonal)).toBeCloseTo(moved(straight));
  });

  it('multiplies the speed while the boost key is held', () => {
    const state = start('first-person');
    const walked = firstPersonMode(state, frame({ keys: ['w'] }), 1).view.camera.position[0];
    const boosted = firstPersonMode(state, frame({ keys: ['w', 'shift'] }), 1).view.camera.position[0];
    expect(20 - boosted).toBeCloseTo((20 - walked) * defaultNavSettings.boostFactor);
  });

  it('rises and falls along the up axis, not along the view', () => {
    const tilted = navState(
      viewState(cameraPose([20, 0, 20], [0, 0, 0], zUp), perspective(50), metresZUpLocal),
      'first-person',
    );
    const risen = firstPersonMode(tilted, frame({ keys: ['e'] }), 1);
    expect(risen.view.camera.position).toEqual([20, 0, 25]);
  });

  it('changes walking speed with the wheel, within limits', () => {
    const state = start('first-person');
    expect(firstPersonMode(state, frame({ wheel: -100 }), dt).settings.moveSpeed).toBeCloseTo(5 / Math.exp(-0.1));
    expect(firstPersonMode(state, frame({ wheel: -1e9 }), dt).settings.moveSpeed).toBe(defaultNavSettings.maxMoveSpeed);
    expect(firstPersonMode(state, frame({ wheel: 1e9 }), dt).settings.moveSpeed).toBe(defaultNavSettings.minMoveSpeed);
    expect(firstPersonMode(state, frame({ wheel: -100 }), dt).view.camera).toEqual(startView.camera);
  });

  it('ignores movement keys in orbit navigation, which binds none', () => {
    expect(orbitMode(start(), frame({ keys: ['w'] }), 1).view.camera).toEqual(startView.camera);
  });
});

describe('overhead navigation', () => {
  const overhead = (): NavState => start('overhead');

  it('starts looking straight down, projecting orthographically, at the heading it had', () => {
    const state = overhead();
    expect(state.view.projection.kind).toBe('orthographic');
    expect(cameraBasis(state.view.camera).forward[2]).toBeCloseTo(-1);
    expect(state.view.camera.position).toEqual([0, 0, 20]);
    expect(screenHeading(state.view.camera, zUp)).toBeCloseTo(screenHeading(startView.camera, zUp));
  });

  it('stays fixed in orientation whatever the input', () => {
    const state = overhead();
    const heading = screenHeading(state.view.camera, zUp);
    const inputs = [drag(['left'], 120, -80), frame({ wheel: -240 }), frame({ keys: ['a', 'w'] })];
    const after = inputs.reduce((current, input) => overheadMode(current, input, 1), state);
    expect(screenHeading(after.view.camera, zUp)).toBeCloseTo(heading);
    expect(cameraBasis(after.view.camera).forward[2]).toBeCloseTo(-1);
  });

  it('pans with a drag, keeping the camera above its target', () => {
    const state = overhead();
    const after = overheadMode(state, drag(['left'], 100, 0), dt);
    expect(after.view.camera.target[1]).toBeCloseTo((-100 / viewport.height) * screenHeight(state));
    expect(after.view.camera.position[0] - after.view.camera.target[0]).toBeCloseTo(0);
    expect(after.view.camera.position[2] - after.view.camera.target[2]).toBeCloseTo(20);
  });

  it('zooms the frame with the wheel instead of moving the camera', () => {
    const state = overhead();
    const after = overheadMode(state, frame({ wheel: 100 }), dt);
    expect(after.view.projection.kind === 'orthographic' && after.view.projection.height).toBeCloseTo(
      screenHeight(state) * Math.exp(0.1),
    );
    expect(after.view.camera.position).toEqual(state.view.camera.position);
  });

  it('pans a screen height a second with the movement keys, so it keeps up when zoomed out', () => {
    const state = overhead();
    const near = overheadMode(state, frame({ keys: ['w'] }), 1);
    const zoomedOut = overheadMode(state, frame({ wheel: 2000 }), dt);
    const far = overheadMode(zoomedOut, frame({ keys: ['w'] }), 1);
    const travelled = (from: NavState, to: NavState): number =>
      Math.hypot(to.view.camera.target[0] - from.view.camera.target[0], to.view.camera.target[1] - from.view.camera.target[1]);
    expect(travelled(state, near)).toBeCloseTo(screenHeight(state));
    expect(travelled(zoomedOut, far)).toBeGreaterThan(travelled(state, near) * 5);
  });

  it('never turns, even when its table binds an orbit', () => {
    const state: NavState = { ...overhead(), bindings: defaultBindings.orbit };
    expect(overheadMode(state, drag(['left'], 100, 100), dt).view.camera).toEqual(state.view.camera);
  });

  it('is already settled, so constraining it again changes nothing', () => {
    const state = overhead();
    expect(constrainToMode(state)).toEqual(state);
  });
});

describe('switching mode', () => {
  it('takes the new mode default bindings unless a table is given', () => {
    expect(setMode(start(), 'first-person').bindings).toBe(defaultBindings['first-person']);
    expect(setMode(start(), 'first-person', defaultBindings.orbit).bindings).toBe(defaultBindings.orbit);
  });

  it('keeps the projection when overhead is left, because that is what the user can see', () => {
    const back = setMode(setMode(start(), 'overhead'), 'orbit');
    expect(back.view.projection.kind).toBe('orthographic');
    expect(back.mode).toBe('orbit');
  });

  it('offers one reducer per mode', () => {
    expect(modeReducers.overhead(start(), emptyFrame(viewport), dt).mode).toBe('overhead');
    expect(modeReducers['first-person'](start(), emptyFrame(viewport), dt).mode).toBe('first-person');
    expect(modeReducers.orbit(start('overhead'), emptyFrame(viewport), dt).mode).toBe('orbit');
  });
});

describe('fitState', () => {
  const box: Bounds = { min: [-5, -5, 0], max: [5, 5, 4] };

  it('frames the box and keeps looking from the same side', () => {
    const after = fitState(start(), box, { aspect: 2, padding: 1.05 });
    expect(after.view.camera.target).toEqual([0, 0, 2]);
    expect(after.view.camera.position[0]).toBeGreaterThan(0);
  });

  it('leaves an overhead view looking straight down', () => {
    const after = fitState(start('overhead'), box, { aspect: 2, padding: 1.05 });
    expect(cameraBasis(after.view.camera).forward[2]).toBeCloseTo(-1);
    expect(after.view.projection.kind).toBe('orthographic');
  });

  it('changes nothing when there is nothing to frame', () => {
    const state = start();
    expect(fitState(state, { min: [1, 1, 1], max: [0, 0, 0] })).toBe(state);
  });
});

describe('robustness', () => {
  it('treats an impossible step length as no time passing', () => {
    const state = start('first-person');
    for (const bad of [Number.NaN, -1, Number.POSITIVE_INFINITY]) {
      expect(stepNavigation(state, frame({ keys: ['w'] }), bad).view.camera.position).toEqual([20, 0, 0]);
    }
  });

  it('keeps the camera finite when a device reports nonsense', () => {
    const state = start();
    const nonsense = [
      frame({ wheel: Number.NaN }),
      frame({ wheel: Number.POSITIVE_INFINITY }),
      drag(['left'], Number.NaN, Number.NaN),
    ];
    for (const input of nonsense) {
      expect(stepNavigation(state, input, dt).view.camera.position.every(Number.isFinite)).toBe(true);
    }
  });

  it('leaves the state it was given untouched', () => {
    const state = start();
    stepNavigation(state, drag(['left'], 100, 100), dt);
    expect(state.view.camera.position).toEqual([20, 0, 0]);
  });

  it('is plain data, so a pose survives being saved and read back', () => {
    const moved = stepNavigation(start(), drag(['left'], 37, -11), dt);
    const text: unknown = JSON.parse(JSON.stringify(moved.view));
    expect(text).toEqual(moved.view);
  });
});
