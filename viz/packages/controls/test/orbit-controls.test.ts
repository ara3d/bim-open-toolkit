import { describe, expect, it } from 'vitest';
import { PerspectiveCamera } from 'three';
import { OrbitControls } from '../src/orbit-controls.js';
import { FakeElement } from './helpers.js';

const makeView = () => {
  const camera = new PerspectiveCamera();
  let renders = 0;
  return {
    camera,
    requestRender: () => renders++,
    renderCount: () => renders,
  };
};

describe('OrbitControls', () => {
  it('applies the pose and requests a render on attach', () => {
    const view = makeView();
    const controls = new OrbitControls(view);
    controls.attach(new FakeElement());
    expect(view.renderCount()).toBe(1);
    expect(view.camera.position.length()).toBeGreaterThan(0);
  });

  it('left-drag rotates the camera and requests renders', () => {
    const view = makeView();
    const controls = new OrbitControls(view);
    const el = new FakeElement();
    controls.attach(el);
    const theta0 = controls.model.theta;
    el.dispatch('pointerdown', { pointerId: 1, button: 0, clientX: 0, clientY: 0, shiftKey: false });
    el.dispatch('pointermove', { pointerId: 1, button: 0, clientX: 50, clientY: 0, shiftKey: false });
    expect(controls.model.theta).not.toBeCloseTo(theta0);
    expect(view.renderCount()).toBe(2);
    expect(el.captured).toEqual([1]);
  });

  it('right-drag and shift+left-drag pan the target', () => {
    const view = makeView();
    const controls = new OrbitControls(view);
    const el = new FakeElement();
    controls.attach(el);
    el.dispatch('pointerdown', { pointerId: 1, button: 2, clientX: 0, clientY: 0, shiftKey: false });
    el.dispatch('pointermove', { pointerId: 1, button: 2, clientX: 20, clientY: 0, shiftKey: false });
    el.dispatch('pointerup', { pointerId: 1, button: 2, clientX: 20, clientY: 0, shiftKey: false });
    const afterRight = controls.model.target;
    expect(afterRight.length()).toBeGreaterThan(0);

    el.dispatch('pointerdown', { pointerId: 2, button: 0, clientX: 0, clientY: 0, shiftKey: true });
    el.dispatch('pointermove', { pointerId: 2, button: 0, clientX: 0, clientY: 20, shiftKey: true });
    expect(controls.model.target.distanceTo(afterRight)).toBeGreaterThan(0);
  });

  it('wheel dollies with clamping', () => {
    const view = makeView();
    const controls = new OrbitControls(view);
    const el = new FakeElement();
    controls.attach(el);
    const d0 = controls.model.distance;
    el.dispatch('wheel', { deltaY: -100 });
    expect(controls.model.distance).toBeLessThan(d0);
    el.dispatch('wheel', { deltaY: 1e9 });
    expect(controls.model.distance).toBe(controls.model.params.maxDistance);
  });

  it('ignores moves when no drag is active and cleans up on dispose', () => {
    const view = makeView();
    const controls = new OrbitControls(view);
    const el = new FakeElement();
    controls.attach(el);
    const theta0 = controls.model.theta;
    el.dispatch('pointermove', { pointerId: 1, button: 0, clientX: 50, clientY: 0, shiftKey: false });
    expect(controls.model.theta).toBe(theta0);
    controls.dispose();
    expect(el.listenerCount()).toBe(0);
  });

  it('ignores foreign pointers and recovers after cancellation and lost capture', () => {
    const view = makeView();
    const controls = new OrbitControls(view);
    const el = new FakeElement();
    controls.attach(el);
    const pointer = { pointerId: 1, button: 0, clientX: 0, clientY: 0, shiftKey: false };
    el.dispatch('pointerdown', pointer);
    const before = controls.model.theta;
    el.dispatch('pointermove', { ...pointer, pointerId: 2, clientX: 50 });
    el.dispatch('pointerup', { ...pointer, pointerId: 2 });
    expect(controls.model.theta).toBe(before);
    el.dispatch('pointermove', { ...pointer, clientX: 20 });
    expect(controls.model.theta).not.toBe(before);
    for (const type of ['pointercancel', 'lostpointercapture']) {
      el.dispatch(type, pointer);
      const stopped = controls.model.theta;
      el.dispatch('pointermove', { ...pointer, clientX: 80 });
      expect(controls.model.theta).toBe(stopped);
      el.dispatch('pointerdown', pointer);
    }
    controls.dispose();
    controls.attach(el);
    const reattached = controls.model.theta;
    el.dispatch('pointermove', { ...pointer, clientX: 100 });
    expect(controls.model.theta).toBe(reattached);
  });

  it('orbits with one touch and pans/pinches with two, preserving gesture transitions', () => {
    const view = makeView();
    const controls = new OrbitControls(view);
    const el = new FakeElement();
    controls.attach(el);
    const first = { pointerId: 1, pointerType: 'touch', button: 0, clientX: 0, clientY: 0, shiftKey: false };
    const second = { ...first, pointerId: 2, clientX: 100 };
    el.dispatch('pointerdown', first);
    const theta = controls.model.theta;
    el.dispatch('pointermove', { ...first, clientX: 10 });
    expect(controls.model.theta).not.toBe(theta);
    el.dispatch('pointerdown', second);
    const distance = controls.model.distance;
    const target = controls.model.target;
    const twoTouchTheta = controls.model.theta;
    el.dispatch('pointermove', { ...second, clientX: 190 });
    expect(controls.model.distance).toBeCloseTo(distance / 2);
    expect(controls.model.target.distanceTo(target)).toBeGreaterThan(0);
    expect(controls.model.theta).toBe(twoTouchTheta);
    el.dispatch('pointerdown', { ...first, pointerId: 3 });
    expect(el.captured).toEqual([1, 2]);
    el.dispatch('pointercancel', second);
    el.dispatch('pointermove', { ...first, clientX: 10 });
    expect(controls.model.theta).toBe(twoTouchTheta);
    el.dispatch('pointermove', { ...first, clientX: 20 });
    expect(controls.model.theta).not.toBe(twoTouchTheta);
  });

  it('restores touch-action and releases captures on dispose', () => {
    const el = Object.assign(new FakeElement(), { style: { touchAction: 'pan-y' }, released: [] as number[] });
    el.releasePointerCapture = (id?: number) => { if (id !== undefined) el.released.push(id); };
    const controls = new OrbitControls(makeView());
    controls.attach(el);
    expect(el.style.touchAction).toBe('none');
    el.dispatch('pointerdown', { pointerId: 5, pointerType: 'touch', button: 0, clientX: 0, clientY: 0, shiftKey: false });
    controls.dispose();
    expect(el.style.touchAction).toBe('pan-y');
    expect(el.released).toEqual([5]);
    expect(el.listenerCount()).toBe(0);
  });
});
