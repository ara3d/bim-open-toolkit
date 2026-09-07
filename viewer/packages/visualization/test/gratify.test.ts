import { afterEach, describe, expect, it, vi } from 'vitest';
import { Runtime } from 'gratify';
import { createReviewControlsApp, mountReviewControls } from '../src/gratify.js';

const commands = () => ({ fit: vi.fn(), clearSelection: vi.fn(), toggleGhost: vi.fn() });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('Gratify review command adapter', () => {
  it('uses real MVU commits to invoke commands once, never on animation frames', () => {
    const host = commands(), app = createReviewControlsApp(host);
    const runtime = new Runtime(null, app, { headless: true, width: 288, height: 196 });
    runtime.dispatch('fit'); runtime.dispatch('clearSelection'); runtime.dispatch('toggleGhost');
    expect(runtime.doc.ghost).toBe(true);
    runtime.step(120);
    expect(host.fit).toHaveBeenCalledOnce(); expect(host.clearSelection).toHaveBeenCalledOnce(); expect(host.toggleGhost).toHaveBeenCalledOnce();
    runtime.dispatch('toggleGhost'); expect(runtime.doc.ghost).toBe(false);
    expect(app.init).toEqual({ revision: 0, last: null, ghost: false });
    runtime.stop();
  });
  it('renders real parts headlessly and routes keyboard activation through Gratify', () => {
    const host = commands(), runtime = new Runtime(null, createReviewControlsApp(host), { headless: true, width: 288, height: 196 });
    runtime.step(60);
    expect(runtime.key('Tab')).toBe(true);
    expect(runtime.key('Enter')).toBe(true);
    expect(host.fit).toHaveBeenCalledOnce();
    runtime.key('Tab'); runtime.key(' ');
    expect(host.clearSelection).toHaveBeenCalledOnce();
    runtime.stop();
  });
  it('detaches owned inputs, cancels pending RAF, restores canvas and ignores dispatch after disposal', () => {
    class Canvas extends EventTarget {
      width = 640; height = 480; tabIndex = -1; style = { touchAction: 'pan-y' };
      getContext() { return {}; }
      hasPointerCapture() { return false; }
    }
    const canvas = new Canvas(), host = commands();
    const add = vi.spyOn(canvas, 'addEventListener'), remove = vi.spyOn(canvas, 'removeEventListener');
    const cancel = vi.fn(); vi.stubGlobal('requestAnimationFrame', vi.fn(() => 17)); vi.stubGlobal('cancelAnimationFrame', cancel);
    const stop = vi.spyOn(Runtime.prototype, 'stop');
    const mounted = mountReviewControls(canvas as unknown as HTMLCanvasElement, host);
    mounted.dispatch('fit'); expect(host.fit).toHaveBeenCalledOnce();
    mounted.dispose(); mounted.dispose(); mounted.dispatch('fit');
    expect(host.fit).toHaveBeenCalledOnce(); expect(cancel).toHaveBeenCalledExactlyOnceWith(17); expect(stop).toHaveBeenCalledOnce();
    expect(remove.mock.calls.map(([type]) => type)).toEqual(add.mock.calls.map(([type]) => type));
    for (const [type, listener] of add.mock.calls) expect(remove).toHaveBeenCalledWith(type, listener);
    expect(canvas).toMatchObject({ width: 640, height: 480, tabIndex: -1, style: { touchAction: 'pan-y' } });
  });
});
