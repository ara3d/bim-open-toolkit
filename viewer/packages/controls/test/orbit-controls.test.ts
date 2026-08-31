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
});
