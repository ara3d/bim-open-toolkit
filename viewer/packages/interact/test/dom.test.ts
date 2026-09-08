import { describe, expect, it } from 'vitest';
import { cameraPose, metresZUpLocal, perspective, viewDistance, viewState } from '@bim-open-toolkit/model';
import { navState } from '../src/navigation.js';
import { navSession, startFlight, type NavSession } from '../src/session.js';
import {
  attachNavigation,
  type FrameScheduler,
  type NavElement,
  type NavEvent,
} from '../src/dom.js';

const startView = viewState(cameraPose([20, 0, 0], [0, 0, 0], [0, 0, 1]), perspective(50), metresZUpLocal);

// A stand-in element that records what the adapter did to it and lets a test raise events.
type FakeElement = NavElement & {
  readonly dispatch: (type: string, event: NavEvent) => void;
  readonly listenerCount: () => number;
  readonly captured: number[];
  readonly released: number[];
  readonly prevented: () => number;
  readonly style: { touchAction: string };
};

const fakeElement = (): FakeElement => {
  const handlers = new Map<string, Set<(event: NavEvent) => void>>();
  const captured: number[] = [];
  const released: number[] = [];
  let prevented = 0;
  return {
    clientWidth: 800,
    clientHeight: 400,
    style: { touchAction: 'pan-y' },
    captured,
    released,
    prevented: () => prevented,
    getBoundingClientRect: () => ({ left: 10, top: 20 }),
    setPointerCapture: (id) => captured.push(id),
    releasePointerCapture: (id) => released.push(id),
    addEventListener: (type, handler) => {
      const set = handlers.get(type) ?? new Set();
      set.add(handler);
      handlers.set(type, set);
    },
    removeEventListener: (type, handler) => {
      handlers.get(type)?.delete(handler);
    },
    listenerCount: () => [...handlers.values()].reduce((total, set) => total + set.size, 0),
    dispatch: (type, event) => {
      const counted: NavEvent = { ...event, preventDefault: () => { prevented += 1; } };
      for (const handler of [...(handlers.get(type) ?? [])]) handler(counted);
    },
  };
};

// A clock a test winds by hand, standing in for animation frames.
const fakeClock = () => {
  let pending: ((timeMs: number) => void) | undefined;
  let now = 0;
  const schedule: FrameScheduler = (run) => {
    pending = run;
    return () => {
      pending = undefined;
    };
  };
  return {
    schedule,
    isPending: () => pending !== undefined,
    advance: (ms: number) => {
      now += ms;
      const run = pending;
      pending = undefined;
      run?.(now);
    },
  };
};

const setup = (session: NavSession = navSession(navState(startView))) => {
  const element = fakeElement();
  const clock = fakeClock();
  const changes: NavSession[] = [];
  const controller = attachNavigation(element, {
    session,
    schedule: clock.schedule,
    onChange: (next) => changes.push(next),
  });
  return { element, clock, changes, controller };
};

// Coordinates the adapter sees are relative to the element, which sits at (10, 20) on the page.
const at = (x: number, y: number): { readonly clientX: number; readonly clientY: number } => ({
  clientX: x + 10,
  clientY: y + 20,
});

describe('attaching and letting go', () => {
  it('listens while attached and leaves nothing behind', () => {
    const { element, controller } = setup();
    expect(element.listenerCount()).toBeGreaterThan(0);
    controller.dispose();
    expect(element.listenerCount()).toBe(0);
  });

  it('takes over touch gestures and gives them back', () => {
    const { element, controller } = setup();
    expect(element.style.touchAction).toBe('none');
    controller.dispose();
    expect(element.style.touchAction).toBe('pan-y');
  });

  it('lets go of any pointer it still holds', () => {
    const { element, controller } = setup();
    element.dispatch('pointerdown', { pointerId: 7, pointerType: 'touch', buttons: 0, ...at(0, 0) });
    controller.dispose();
    expect(element.released).toContain(7);
  });

  it('can be disposed twice and ignores events afterwards', () => {
    const { element, clock, changes, controller } = setup();
    controller.dispose();
    controller.dispose();
    element.dispatch('pointerdown', { pointerId: 1, buttons: 1, ...at(0, 0) });
    clock.advance(16);
    expect(changes).toEqual([]);
  });

  it('asks for no frames while the view sits still', () => {
    const { clock } = setup();
    expect(clock.isPending()).toBe(false);
  });
});

describe('pointer input', () => {
  it('turns a drag into navigation and reports the change once', () => {
    const { element, clock, changes, controller } = setup();
    element.dispatch('pointerdown', { pointerId: 1, buttons: 1, ...at(100, 100) });
    element.dispatch('pointermove', { pointerId: 1, buttons: 1, ...at(200, 100) });
    clock.advance(16);
    expect(changes).toHaveLength(1);
    expect(controller.session().nav.view.camera.position[1]).toBeLessThan(0);
    expect(element.captured).toEqual([1]);
  });

  it('measures the drag from the element, not from the page', () => {
    const { element, clock, controller } = setup();
    element.dispatch('pointerdown', { pointerId: 1, buttons: 1, clientX: 10, clientY: 20 });
    element.dispatch('pointermove', { pointerId: 1, buttons: 1, clientX: 110, clientY: 20 });
    clock.advance(16);
    const moved = controller.session().nav.view.camera.position;
    element.dispatch('pointerup', { pointerId: 1, buttons: 0, clientX: 110, clientY: 20 });
    expect(Math.hypot(moved[0] - 20, moved[1])).toBeGreaterThan(0);
  });

  it('stops asking for frames once the drag ends', () => {
    const { element, clock } = setup();
    element.dispatch('pointerdown', { pointerId: 1, buttons: 1, ...at(0, 0) });
    element.dispatch('pointermove', { pointerId: 1, buttons: 1, ...at(50, 0) });
    clock.advance(16);
    expect(clock.isPending()).toBe(true);
    element.dispatch('pointerup', { pointerId: 1, buttons: 0, ...at(50, 0) });
    clock.advance(16);
    expect(clock.isPending()).toBe(false);
    expect(element.released).toEqual([1]);
  });

  it('ignores a mouse that is only hovering', () => {
    const { element, clock, changes } = setup();
    element.dispatch('pointermove', { pointerId: 1, buttons: 0, ...at(0, 0) });
    element.dispatch('pointermove', { pointerId: 1, buttons: 0, ...at(300, 300) });
    clock.advance(16);
    expect(changes).toEqual([]);
  });

  it('gives up the drag on cancellation and on losing capture', () => {
    for (const ending of ['pointercancel', 'lostpointercapture']) {
      const { element, clock, controller } = setup();
      element.dispatch('pointerdown', { pointerId: 1, buttons: 1, ...at(0, 0) });
      element.dispatch(ending, { pointerId: 1, buttons: 1, ...at(0, 0) });
      element.dispatch('pointermove', { pointerId: 1, buttons: 1, ...at(200, 0) });
      clock.advance(16);
      clock.advance(16);
      expect(controller.session().nav.view.camera.position).toEqual([20, 0, 0]);
    }
  });

  it('orbits with one finger and moves closer when two spread apart', () => {
    const { element, clock, controller } = setup();
    element.dispatch('pointerdown', { pointerId: 1, pointerType: 'touch', buttons: 0, ...at(100, 100) });
    element.dispatch('pointerdown', { pointerId: 2, pointerType: 'touch', buttons: 0, ...at(200, 100) });
    element.dispatch('pointermove', { pointerId: 1, pointerType: 'touch', buttons: 0, ...at(50, 100) });
    element.dispatch('pointermove', { pointerId: 2, pointerType: 'touch', buttons: 0, ...at(250, 100) });
    clock.advance(16);
    expect(viewDistance(controller.session().nav.view.camera)).toBeCloseTo(10);
  });

  it('keeps the page from acting on a touch or a right click', () => {
    const { element } = setup();
    element.dispatch('pointerdown', { pointerId: 1, pointerType: 'touch', buttons: 0, ...at(0, 0) });
    expect(element.prevented()).toBe(1);
    element.dispatch('contextmenu', {});
    expect(element.prevented()).toBe(2);
  });
});

describe('wheel input', () => {
  it('dollies once and then settles', () => {
    const { element, clock, controller } = setup();
    element.dispatch('wheel', { deltaY: 100, deltaMode: 0 });
    clock.advance(16);
    expect(viewDistance(controller.session().nav.view.camera)).toBeCloseTo(20 * Math.exp(0.1));
    clock.advance(16);
    expect(clock.isPending()).toBe(false);
  });

  it('reads a wheel that reports lines or pages rather than pixels', () => {
    const inPixels = (deltaY: number, deltaMode: number): number => {
      const { element, clock, controller } = setup();
      element.dispatch('wheel', { deltaY, deltaMode });
      clock.advance(16);
      return viewDistance(controller.session().nav.view.camera);
    };
    expect(inPixels(1, 1)).toBeCloseTo(inPixels(16, 0));
    expect(inPixels(1, 2)).toBeCloseTo(inPixels(400, 0));
  });

  it('keeps the wheel from scrolling the page', () => {
    const { element } = setup();
    element.dispatch('wheel', { deltaY: 100 });
    expect(element.prevented()).toBe(1);
  });
});

describe('keyboard input', () => {
  const walking = (): NavSession => navSession(navState(startView, 'first-person'));

  it('walks while a key is held and stops when it is let go', () => {
    const { element, clock, controller } = setup(walking());
    element.dispatch('keydown', { key: 'w' });
    clock.advance(0);
    clock.advance(1000);
    expect(controller.session().nav.view.camera.position[0]).toBeCloseTo(15);
    element.dispatch('keyup', { key: 'w' });
    clock.advance(1000);
    clock.advance(1000);
    expect(controller.session().nav.view.camera.position[0]).toBeCloseTo(15);
    expect(clock.isPending()).toBe(false);
  });

  it('stops walking when the element loses focus', () => {
    const { element, clock, controller } = setup(walking());
    element.dispatch('keydown', { key: 'w' });
    clock.advance(0);
    element.dispatch('blur', {});
    clock.advance(1000);
    clock.advance(1000);
    expect(controller.session().nav.view.camera.position[0]).toBeCloseTo(20);
  });

  it('keeps only the keys it uses from reaching the page', () => {
    const { element } = setup(walking());
    element.dispatch('keydown', { key: 'w' });
    expect(element.prevented()).toBe(1);
    element.dispatch('keydown', { key: 'Tab' });
    expect(element.prevented()).toBe(1);
  });

  it('does not take another viewer keys, because it listens on its own element', () => {
    const first = setup(walking());
    const second = setup(walking());
    first.element.dispatch('keydown', { key: 'w' });
    first.clock.advance(0);
    first.clock.advance(1000);
    second.clock.advance(1000);
    expect(first.controller.session().nav.view.camera.position[0]).toBeCloseTo(15);
    expect(second.controller.session().nav.view.camera.position[0]).toBe(20);
    expect(second.clock.isPending()).toBe(false);
  });

  it('reads the modifiers a key event reports', () => {
    const { element, clock, controller } = setup();
    element.dispatch('pointerdown', { pointerId: 1, buttons: 1, shiftKey: true, ...at(0, 0) });
    element.dispatch('pointermove', { pointerId: 1, buttons: 1, shiftKey: true, ...at(100, 0) });
    clock.advance(16);
    // Shift and left pans in the default orbit table, which moves the target; orbiting would not.
    expect(controller.session().nav.view.camera.target[1]).toBeLessThan(0);
  });
});

describe('driving the view from outside', () => {
  it('runs a flight to its end and then settles', () => {
    const destination = viewState(cameraPose([0, 60, 30], [0, 0, 0], [0, 0, 1]), perspective(50), metresZUpLocal);
    const { clock, changes, controller } = setup();
    controller.setSession(startFlight(controller.session(), destination, 500));
    expect(clock.isPending()).toBe(true);
    for (let i = 0; i < 8; i++) clock.advance(100);
    expect(controller.session().nav.view).toEqual(destination);
    expect(clock.isPending()).toBe(false);
    expect(changes.length).toBeGreaterThan(1);
  });

  it('replaces the session without reporting a change the caller already made', () => {
    const { changes, controller } = setup();
    const replaced = navSession(navState(startView, 'overhead'));
    controller.setSession(replaced);
    expect(controller.session()).toBe(replaced);
    expect(changes).toEqual([]);
  });
});

describe('the element contract', () => {
  it('is satisfied by a real element', () => {
    const acceptsRealElements = (element: HTMLElement): NavElement => element;
    expect(typeof acceptsRealElements).toBe('function');
  });
});
