import { describe, expect, it } from 'vitest';
import { v, type Vec } from 'gratify';
import {
  bindSurfaceInput,
  localPoint,
  modifiersOf,
  renderLoop,
  type FrameScheduler,
  type InputModifiers,
  type SurfaceEvent,
  type SurfaceInput,
} from '../src/index.js';

// A stand-in for the canvas the host listens on: the same shape, none of the DOM.
class FakeSurface {
  readonly added: [string, (event: SurfaceEvent) => void][] = [];
  readonly removed: [string, (event: SurfaceEvent) => void][] = [];
  readonly live: [string, (event: SurfaceEvent) => void][] = [];
  readonly captured = new Set<number>();
  focused = 0;

  addEventListener(type: string, listener: (event: SurfaceEvent) => void): void {
    this.added.push([type, listener]);
    this.live.push([type, listener]);
  }

  removeEventListener(type: string, listener: (event: SurfaceEvent) => void): void {
    this.removed.push([type, listener]);
    const index = this.live.findIndex(([name, held]) => name === type && held === listener);
    if (index >= 0) this.live.splice(index, 1);
  }

  focus(): void {
    this.focused += 1;
  }

  setPointerCapture(pointerId: number): void {
    this.captured.add(pointerId);
  }

  releasePointerCapture(pointerId: number): void {
    this.captured.delete(pointerId);
  }

  hasPointerCapture(pointerId: number): boolean {
    return this.captured.has(pointerId);
  }

  getBoundingClientRect(): { left: number; top: number; width: number; height: number } {
    return { left: 10, top: 20, width: 200, height: 100 };
  }

  emit(type: string, event: SurfaceEvent): void {
    for (const [name, listener] of [...this.live]) if (name === type) listener(event);
  }
}

// A runtime stand-in that records the input pipeline calls the binding made.
class FakeInput implements SurfaceInput {
  readonly calls: string[] = [];
  consumes = true;

  pointerDown(point: Vec, mods?: Partial<InputModifiers>): void {
    this.calls.push(`down ${point.x},${point.y} shift=${mods?.shift === true}`);
  }

  pointerMove(point: Vec): void {
    this.calls.push(`move ${point.x},${point.y}`);
  }

  pointerUp(point: Vec): void {
    this.calls.push(`up ${point.x},${point.y}`);
  }

  key(key: string): boolean {
    this.calls.push(`key ${key}`);
    return this.consumes;
  }
}

// A scheduler a test drives by hand: `frames.run()` is one animation frame.
const manualFrames = (): { readonly schedule: FrameScheduler; readonly run: () => void; readonly cancels: () => number; readonly pending: () => boolean } => {
  let queued: ((timeMs: number) => void) | undefined;
  let time = 0;
  let cancels = 0;
  return {
    schedule: (run) => {
      queued = run;
      return () => {
        queued = undefined;
        cancels += 1;
      };
    },
    run: () => {
      const next = queued;
      queued = undefined;
      time += 16;
      next?.(time);
    },
    cancels: () => cancels,
    pending: () => queued !== undefined,
  };
};

describe('render loop', () => {
  it('keeps asking for frames while the scene moves and sleeps when it settles', () => {
    const frames = manualFrames();
    let moving = true;
    let steps = 0;
    const loop = renderLoop((dt) => {
      steps += 1;
      expect(dt).toBeGreaterThan(0);
      return moving;
    }, frames.schedule);

    frames.run();
    frames.run();
    expect(steps).toBe(2);
    moving = false;
    frames.run();
    expect([steps, frames.pending()]).toEqual([3, false]);

    loop.wake();
    expect(frames.pending()).toBe(true);
    loop.dispose();
    expect(frames.cancels()).toBe(1);
    frames.run();
    expect(steps).toBe(3);
  });

  it('cancels nothing more once disposed, however often it is asked', () => {
    const frames = manualFrames();
    const loop = renderLoop(() => false, frames.schedule);
    loop.dispose();
    loop.dispose();
    loop.wake();
    expect([frames.cancels(), frames.pending()]).toEqual([1, false]);
  });
});

describe('surface input', () => {
  it('reads a client point in the runtime’s own coordinates', () => {
    const surface = new FakeSurface();
    expect(localPoint(surface, { clientX: 110, clientY: 70 }, v(100, 50))).toEqual({ x: 50, y: 25 });
    expect(modifiersOf({ metaKey: true })).toEqual({ shift: false, alt: false, ctrl: true });
  });

  it('drives the runtime from pointer and key events and takes the pointer capture with it', () => {
    const surface = new FakeSurface();
    const input = new FakeInput();
    let woken = 0;
    const bound = bindSurfaceInput(surface, input, {
      toLocal: (event) => v(event.clientX ?? 0, event.clientY ?? 0),
      wake: () => {
        woken += 1;
      },
    });

    surface.emit('pointerdown', { clientX: 1, clientY: 2, pointerId: 7, isPrimary: true, button: 0, shiftKey: true });
    surface.emit('pointermove', { clientX: 3, clientY: 4, pointerId: 7 });
    // A second pointer while one is down is not a second gesture.
    surface.emit('pointerdown', { clientX: 9, clientY: 9, pointerId: 8, isPrimary: true, button: 0 });
    surface.emit('pointerup', { clientX: 3, clientY: 4, pointerId: 7 });
    expect(input.calls).toEqual(['down 1,2 shift=true', 'move 3,4', 'up 3,4']);
    expect([surface.focused, surface.captured.size]).toEqual([1, 0]);
    expect(woken).toBe(3);

    // Tab belongs to the browser so focus can always leave the canvas for the DOM mirror.
    surface.emit('keydown', { key: 'Tab' });
    surface.emit('keydown', { key: 'ArrowDown' });
    expect(input.calls.at(-1)).toBe('key ArrowDown');

    bound.dispose();
    bound.dispose();
    expect(surface.removed).toEqual(surface.added);
    surface.emit('pointerdown', { clientX: 5, clientY: 5, pointerId: 1, isPrimary: true, button: 0 });
    expect(input.calls.filter((call) => call.startsWith('down'))).toHaveLength(1);
  });

  it('leaves the wheel to the viewport unless the surface asked for it', () => {
    const quiet = new FakeSurface();
    bindSurfaceInput(quiet, new FakeInput(), { toLocal: () => v(0, 0), wake: () => undefined });
    expect(quiet.added.map(([type]) => type)).not.toContain('wheel');

    const scroller = new FakeSurface();
    const deltas: number[] = [];
    let prevented = 0;
    bindSurfaceInput(scroller, new FakeInput(), {
      toLocal: () => v(0, 0),
      wake: () => undefined,
      onWheel: (delta) => {
        deltas.push(delta);
        return delta > 0;
      },
    });
    scroller.emit('wheel', { deltaY: 3, deltaMode: 1, preventDefault: () => { prevented += 1; } });
    scroller.emit('wheel', { deltaY: -2, deltaMode: 0, preventDefault: () => { prevented += 1; } });
    expect(deltas).toEqual([48, -2]);
    expect(prevented).toBe(1);
  });
});
