import { describe, expect, it } from 'vitest';
import { defaultView, orthographic, viewState, cameraPose } from '@bim-open-toolkit/model';
import { defaultEnvironment } from '@bim-open-toolkit/render';
import { InstancedGroup } from '@ara3d/viewer-core';
import { createView } from '../src/view.js';
import { fakeRenderer, testFrames } from './support/fake-renderer.js';

const aGroup = (): InstancedGroup =>
  new InstancedGroup({ positions: Float32Array.of(0, 0, 0, 1, 0, 0, 0, 1, 0), indices: Uint32Array.of(0, 1, 2) });

const started = (): {
  readonly view: ReturnType<typeof createView>;
  readonly renderer: ReturnType<typeof fakeRenderer>;
  readonly clock: ReturnType<typeof testFrames>;
} => {
  const renderer = fakeRenderer();
  const clock = testFrames();
  const view = createView({ id: 'main', renderer, schedule: clock.schedule });
  view.resize(800, 400);
  return { view, renderer, clock };
};

describe('createView', () => {
  it('draws once the loop runs, and not again until something asks', () => {
    const { renderer, clock } = started();
    clock.tick(16);
    expect(renderer.log.frames()).toBe(1);
    clock.tick(32);
    clock.tick(48);
    expect(renderer.log.frames()).toBe(1);
  });

  it('draws again when the picture was asked for', () => {
    const { view, renderer, clock } = started();
    clock.tick(16);
    view.requestRender();
    clock.tick(32);
    expect(renderer.log.frames()).toBe(2);
  });

  it('reports the interval between drawn frames', () => {
    const { view, renderer, clock } = started();
    const seen: number[] = [];
    const timed = createView({
      id: 'timed',
      renderer,
      schedule: clock.schedule,
      onFrame: (_id, ms) => seen.push(ms),
    });
    timed.resize(100, 100);
    clock.tick(0);
    timed.requestRender();
    clock.tick(16);
    expect(seen).toEqual([16]);
    view.dispose();
    timed.dispose();
  });

  it('sizes the drawing buffer only when the size actually changed', () => {
    const { view, renderer } = started();
    view.resize(800, 400);
    view.resize(800, 400);
    expect(renderer.log.sizes()).toHaveLength(1);
    view.resize(801, 400);
    expect(renderer.log.sizes()).toHaveLength(2);
    expect(view.aspect()).toBeCloseTo(801 / 400);
  });

  it('moves the camera at once when no flight is asked for', () => {
    const { view, clock } = started();
    const moved = { ...defaultView, camera: cameraPose([5, 5, 5], [0, 0, 0], [0, 0, 1]) };
    view.setCamera(moved);
    expect(view.camera().camera.position).toEqual([5, 5, 5]);
    clock.tick(16);
  });

  it('flies the camera over the milliseconds asked for', () => {
    const { view, clock } = started();
    const target = { ...defaultView, camera: cameraPose([10, 0, 0], [0, 0, 0], [0, 0, 1]) };
    clock.tick(0);
    view.setCamera(target, 100);
    clock.tick(50);
    const halfway = view.camera().camera.position;
    expect(halfway).not.toEqual([10, 0, 0]);
    expect(halfway).not.toEqual(defaultView.camera.position);
    clock.tick(200);
    expect(view.camera().camera.position[0]).toBeCloseTo(10, 3);
  });

  it('hands the renderer whichever projection the state asks for', () => {
    const { view, renderer, clock } = started();
    view.setCamera(viewState(cameraPose([0, 0, 10], [0, 0, 0], [0, 1, 0]), orthographic(20)));
    clock.tick(16);
    const last = renderer.log.views().at(-1);
    expect(last?.projection.kind).toBe('orthographic');
  });

  it('puts a group in the scene once, however many times it is added', () => {
    const { view, renderer } = started();
    const group = aGroup();
    view.addGroups([group, group]);
    view.addGroups([group]);
    expect(renderer.scene.groupCount).toBe(1);
    view.removeGroups([group]);
    expect(renderer.scene.groupCount).toBe(0);
  });

  it('applies an environment and takes it away again', () => {
    const { view, renderer } = started();
    view.setEnvironment(defaultEnvironment, { min: [0, 0, 0], max: [10, 10, 10] });
    expect(renderer.log.environments()).toBe(1);
    // Clearing disposes what was applied, which is the target being told there is nothing to draw.
    view.setEnvironment(undefined, { min: [0, 0, 0], max: [10, 10, 10] });
    expect(renderer.log.environments()).toBe(2);
  });

  it('applies a clipping region and lifts it', () => {
    const { view, renderer } = started();
    view.setClipping({ kind: 'box', min: [0, 0, 0], max: [1, 1, 1] });
    expect(renderer.log.planes().at(-1)).toBe(6);
    view.setClipping({ kind: 'planes', planes: [] });
    expect(renderer.log.planes().at(-1)).toBe(0);
  });

  it('leaves nothing behind when disposed', () => {
    const { view, renderer, clock } = started();
    const group = aGroup();
    view.addGroups([group]);
    clock.tick(16);
    view.dispose();
    expect(view.disposed()).toBe(true);
    expect(renderer.scene.groupCount).toBe(0);
    expect(renderer.log.disposals()).toBe(1);
    expect(clock.pending()).toBe(0);
    const drawn = renderer.log.frames();
    clock.tick(32);
    expect(renderer.log.frames()).toBe(drawn);
  });

  it('is safe to dispose twice', () => {
    const { view, renderer } = started();
    view.dispose();
    view.dispose();
    expect(renderer.log.disposals()).toBe(1);
  });
});
