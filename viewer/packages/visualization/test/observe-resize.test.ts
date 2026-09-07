import { afterEach, expect, it, vi } from 'vitest';
import { observeResize } from '../examples/observe-resize.js';

afterEach(() => vi.unstubAllGlobals());

it('defers and coalesces resize writes, then cancels pending work on disposal', () => {
  let notify!: () => void;
  let flush!: () => void;
  const disconnect = vi.fn();
  vi.stubGlobal('ResizeObserver', class {
    constructor(callback: () => void) { notify = callback; }
    observe = vi.fn();
    disconnect = disconnect;
  });
  const schedule = vi.fn((callback: () => void) => { flush = callback; return 1; });
  const cancel = vi.fn();
  vi.stubGlobal('requestAnimationFrame', schedule);
  vi.stubGlobal('cancelAnimationFrame', cancel);
  const resize = vi.fn();
  const dispose = observeResize({} as Element, resize);
  notify(); notify();
  expect(resize).not.toHaveBeenCalled();
  expect(schedule).toHaveBeenCalledOnce();
  flush();
  expect(resize).toHaveBeenCalledOnce();
  notify();
  expect(schedule).toHaveBeenCalledTimes(2);
  dispose();
  expect(cancel).toHaveBeenCalledWith(1);
  expect(disconnect).toHaveBeenCalledOnce();
  flush(); notify();
  expect(resize).toHaveBeenCalledOnce();
  expect(schedule).toHaveBeenCalledTimes(2);
});
