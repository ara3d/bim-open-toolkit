import { describe, it, expect } from 'vitest';
import { Viewer } from '../src/viewer.js';
import { InstancedGroup } from '../src/instanced-group.js';
import { triangle, identity, rgba } from './helpers.js';

// The WebGLRenderer needs a GL context, so attach() is not unit-tested;
// everything up to the draw call runs headless.
describe('Viewer', () => {
  it('constructs with float camera parameters', () => {
    const v = new Viewer({ fov: 62.5, near: 0.25, far: 1234.5 });
    expect(v.camera.fov).toBe(62.5);
    expect(v.camera.near).toBe(0.25);
    expect(v.camera.far).toBe(1234.5);
    v.dispose();
  });

  it('renderFrame syncs the scene model without a renderer', () => {
    const v = new Viewer();
    const g = new InstancedGroup(triangle());
    g.append(identity(), rgba(1, 0, 0, 1));
    v.scene.addGroup(g);
    v.renderFrame();
    expect(v.isAttached).toBe(false);
    v.dispose();
  });

  it('resize updates the camera aspect', () => {
    const v = new Viewer();
    v.resize(200.0, 100.0);
    expect(v.camera.aspect).toBe(2.0);
    v.dispose();
  });

  it('start/stop toggle the running state', () => {
    const v = new Viewer();
    expect(v.isRunning).toBe(false);
    v.start();
    expect(v.isRunning).toBe(true);
    v.stop();
    expect(v.isRunning).toBe(false);
    v.dispose();
  });

  it('dispose is idempotent and forbids restart', () => {
    const v = new Viewer();
    v.dispose();
    v.dispose();
    expect(() => v.start()).toThrow(/disposed/);
    expect(() => v.attach({} as HTMLCanvasElement)).toThrow(/disposed/);
  });
});
