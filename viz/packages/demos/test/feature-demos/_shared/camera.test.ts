import { describe, expect, it } from 'vitest';
import { PerspectiveCamera, Matrix4 as ThreeMatrix4 } from 'three';
import { cameraPose, viewState } from '@bim-open-toolkit/model';
import { applyView, matrixOf, projectToCanvas, rayThroughCanvasPoint, type CanvasSize } from '../../../src/feature-demos/_shared/camera.js';

// The helpers read only a client size, so no canvas is needed in Node.
const fakeCanvas = (width: number, height: number): CanvasSize => ({ clientWidth: width, clientHeight: height });

const looking = (): PerspectiveCamera => {
  const camera = new PerspectiveCamera(50, 800 / 600, 0.1, 1000);
  applyView(camera, viewState(cameraPose([0, -10, 0], [0, 0, 0], [0, 0, 1])));
  return camera;
};

describe('the camera helpers', () => {
  it('reads a three matrix column-major, as the model package lays one out', () => {
    const source = new ThreeMatrix4().makeTranslation(1, 2, 3);
    const read = matrixOf(source);
    expect(read[12]).toBe(1);
    expect(read[13]).toBe(2);
    expect(read[14]).toBe(3);
    expect(read[0]).toBe(1);
  });

  it('projects the target to the middle of the canvas and rejects a point behind the camera', () => {
    const camera = looking();
    const canvas = fakeCanvas(800, 600);
    const middle = projectToCanvas(camera, canvas, [0, 0, 0]);
    expect(middle).toBeDefined();
    expect(middle?.x).toBeCloseTo(400, 5);
    expect(middle?.y).toBeCloseTo(300, 5);
    expect(projectToCanvas(camera, canvas, [0, -20, 0])).toBeUndefined();
  });

  it('projects a point above the target higher on the canvas', () => {
    const camera = looking();
    const above = projectToCanvas(camera, fakeCanvas(800, 600), [0, 0, 1]);
    expect(above).toBeDefined();
    expect(above?.y ?? 0).toBeLessThan(300);
    expect(above?.x).toBeCloseTo(400, 5);
  });

  it('casts the ray through the canvas middle along the view direction', () => {
    const camera = looking();
    const ray = rayThroughCanvasPoint(camera, fakeCanvas(800, 600), { x: 400, y: 300 });
    expect(ray).toBeDefined();
    expect(ray?.direction[0]).toBeCloseTo(0, 5);
    expect(ray?.direction[1]).toBeCloseTo(1, 5);
    expect(ray?.direction[2]).toBeCloseTo(0, 5);
    expect(rayThroughCanvasPoint(camera, fakeCanvas(0, 0), { x: 0, y: 0 })).toBeUndefined();
  });
});
