// The camera bridge without a canvas: three.js needs no WebGL context to hold a camera, so the
// view written onto it and the point projected back out of it are both checkable in Node.

import { describe, expect, it } from 'vitest';
import { PerspectiveCamera } from 'three';
import { cameraPose, viewState } from '@bim-open-toolkit/model';
import { applyView, matrix4From, projectPointOnto } from '../../src/gallery/camera.js';

// A camera ten metres up the x axis looking at the origin, z up, as a z-up model is viewed.
const looking = (): PerspectiveCamera => {
  const camera = new PerspectiveCamera(50, 2, 0.1, 1000);
  applyView(camera, viewState(cameraPose([10, 0, 0], [0, 0, 0], [0, 0, 1])));
  return camera;
};

describe('the camera bridge', () => {
  it('reads sixteen numbers out of anything that holds them, defaulting what is not there', () => {
    expect(matrix4From([1, 2, 3])).toEqual([1, 2, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(matrix4From(new Float32Array(16).fill(2))[15]).toBe(2);
  });

  it('writes the pose and the projection onto the camera', () => {
    const view = viewState(cameraPose([10, 0, 0], [0, 0, 0], [0, 0, 1]));
    const camera = new PerspectiveCamera(50, 2, 0.1, 1000);
    applyView(camera, view);
    expect(camera.position.toArray()).toEqual([10, 0, 0]);
    expect(camera.up.toArray()).toEqual([0, 0, 1]);
    if (view.projection.kind !== 'perspective') throw new Error('the default view is perspective');
    expect(camera.fov).toBe(view.projection.fieldOfViewDegrees);
    expect(camera.near).toBe(view.projection.near);
  });

  it('projects the point the camera looks at to the middle of the picture', () => {
    const at = projectPointOnto(looking(), { width: 800, height: 400 }, [0, 0, 0]);
    expect(at).toBeDefined();
    expect(at?.[0]).toBeCloseTo(400, 3);
    expect(at?.[1]).toBeCloseTo(200, 3);
  });

  it('answers undefined for a point behind the camera and for an element with no area', () => {
    expect(projectPointOnto(looking(), { width: 800, height: 400 }, [40, 0, 0])).toBeUndefined();
    expect(projectPointOnto(looking(), { width: 0, height: 0 }, [0, 0, 0])).toBeUndefined();
  });

  it('moves the projected point the way the world point moves', () => {
    const camera = looking();
    const size = { width: 800, height: 400 };
    const up = projectPointOnto(camera, size, [0, 0, 1]);
    const middle = projectPointOnto(camera, size, [0, 0, 0]);
    expect(up).toBeDefined();
    expect(middle).toBeDefined();
    if (up === undefined || middle === undefined) return;
    expect(up[1]).toBeLessThan(middle[1]);
  });
});
