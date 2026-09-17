import { describe, expect, it } from 'vitest';
import {
  cameraPose,
  emptyBounds,
  metresZUpLocal,
  orthographic,
  perspective,
  viewDistance,
  viewState,
  type Bounds,
  type Matrix4,
  type Projection,
  type Vec3,
  type ViewState,
} from '@bim-open-toolkit/model';
import { viewMatrix } from '../src/camera.js';
import {
  defaultFieldOfViewDegrees,
  defaultZoomLimits,
  distanceForHeight,
  fitBounds,
  frameHeightAt,
  projectionMatrix,
  setProjectionKind,
  zoomProjection,
  type FitOptions,
} from '../src/projection.js';

const zUp: Vec3 = [0, 0, 1];

// A world point in normalised device coordinates, after the perspective divide.
const toDevice = (matrix: Matrix4, point: Vec3): Vec3 => {
  const [x, y, z] = point;
  const w = matrix[3] * x + matrix[7] * y + matrix[11] * z + matrix[15];
  const divisor = w === 0 ? 1 : w;
  return [
    (matrix[0] * x + matrix[4] * y + matrix[8] * z + matrix[12]) / divisor,
    (matrix[1] * x + matrix[5] * y + matrix[9] * z + matrix[13]) / divisor,
    (matrix[2] * x + matrix[6] * y + matrix[10] * z + matrix[14]) / divisor,
  ];
};

// The eight corners of a box.
const corners = (bounds: Bounds): readonly Vec3[] =>
  [0, 1, 2, 3, 4, 5, 6, 7].map((index): Vec3 => [
    (index & 1) === 0 ? bounds.min[0] : bounds.max[0],
    (index & 2) === 0 ? bounds.min[1] : bounds.max[1],
    (index & 4) === 0 ? bounds.min[2] : bounds.max[2],
  ]);

// The furthest any corner of the box strays outside the picture, in device units.
const overflow = (view: ViewState, bounds: Bounds, aspect: number): number => {
  const projection = projectionMatrix(view.projection, aspect);
  const camera = viewMatrix(view.camera);
  return Math.max(
    ...corners(bounds).map((corner) => {
      const device = toDevice(projection, toDevice(camera, corner));
      return Math.max(Math.abs(device[0]), Math.abs(device[1]), Math.abs(device[2]));
    }),
  );
};

const box: Bounds = { min: [-2, 6, 0], max: [8, 10, 3] };

describe('projectionMatrix, perspective', () => {
  const projection = perspective(90, 1, 100);

  it('maps the near and far planes to the ends of the depth range', () => {
    const matrix = projectionMatrix(projection, 1);
    expect(toDevice(matrix, [0, 0, -1])[2]).toBeCloseTo(-1);
    expect(toDevice(matrix, [0, 0, -100])[2]).toBeCloseTo(1);
  });

  it('maps the edge of the vertical field of view to the edge of the picture', () => {
    const matrix = projectionMatrix(projection, 1);
    expect(toDevice(matrix, [0, 10, -10])[1]).toBeCloseTo(1);
    expect(toDevice(matrix, [0, -10, -10])[1]).toBeCloseTo(-1);
  });

  it('widens the horizontal field of view with the aspect', () => {
    expect(toDevice(projectionMatrix(projection, 2), [20, 0, -10])[0]).toBeCloseTo(1);
    expect(toDevice(projectionMatrix(projection, 1), [10, 0, -10])[0]).toBeCloseTo(1);
  });

  it('is column-major with the perspective divide in the third column', () => {
    const matrix = projectionMatrix(projection, 1);
    expect(matrix[11]).toBe(-1);
    expect(matrix[15]).toBe(0);
  });
});

describe('projectionMatrix, orthographic', () => {
  const projection = orthographic(20, 1, 101);

  it('maps the frame height to the edge of the picture, whatever the depth', () => {
    const matrix = projectionMatrix(projection, 1);
    expect(toDevice(matrix, [0, 10, -5])[1]).toBeCloseTo(1);
    expect(toDevice(matrix, [0, 10, -80])[1]).toBeCloseTo(1);
  });

  it('scales the frame width by the aspect', () => {
    expect(toDevice(projectionMatrix(projection, 2), [20, 0, -5])[0]).toBeCloseTo(1);
  });

  it('maps the near and far planes to the ends of the depth range', () => {
    const matrix = projectionMatrix(projection, 1);
    expect(toDevice(matrix, [0, 0, -1])[2]).toBeCloseTo(-1);
    expect(toDevice(matrix, [0, 0, -101])[2]).toBeCloseTo(1);
  });
});

describe('frameHeightAt and distanceForHeight', () => {
  it('are inverses for a perspective projection', () => {
    const projection = perspective(35);
    expect(distanceForHeight(projection, frameHeightAt(projection, 12))).toBeCloseTo(12);
  });

  it('reports the same height everywhere for an orthographic projection', () => {
    const projection = orthographic(14);
    expect(frameHeightAt(projection, 1)).toBe(14);
    expect(frameHeightAt(projection, 1000)).toBe(14);
    expect(distanceForHeight(projection, 14)).toBeUndefined();
  });
});

describe('setProjectionKind', () => {
  const view = viewState(cameraPose([0, 0, 20], [0, 0, 0], zUp), perspective(60), metresZUpLocal);

  it('returns the same view when the kind is unchanged', () => {
    expect(setProjectionKind(view, 'perspective')).toBe(view);
  });

  it('sizes an orthographic frame to what the camera saw at its target', () => {
    const flat = setProjectionKind(view, 'orthographic');
    expect(flat.camera).toEqual(view.camera);
    expect(frameHeightAt(flat.projection, 20)).toBeCloseTo(frameHeightAt(view.projection, 20));
  });

  it('moves the camera back to the matching distance when perspective returns', () => {
    const flat = setProjectionKind(view, 'orthographic');
    const round = setProjectionKind(flat, 'perspective', 60);
    expect(viewDistance(round.camera)).toBeCloseTo(20);
    expect(round.camera.target).toEqual(view.camera.target);
  });

  it('keeps the target and the framed height when the field of view changes', () => {
    const flat = setProjectionKind(view, 'orthographic');
    const narrow = setProjectionKind(flat, 'perspective', 20);
    expect(frameHeightAt(narrow.projection, viewDistance(narrow.camera))).toBeCloseTo(
      frameHeightAt(flat.projection, 1),
    );
    expect(viewDistance(narrow.camera)).toBeGreaterThan(20);
  });

  it('uses a stated default field of view when none is given', () => {
    const flat = setProjectionKind(view, 'orthographic');
    const back: Projection = setProjectionKind(flat, 'perspective').projection;
    expect(back.kind === 'perspective' && back.fieldOfViewDegrees).toBe(defaultFieldOfViewDegrees);
  });
});

describe('zoomProjection', () => {
  it('scales an orthographic frame', () => {
    const zoomed = zoomProjection(orthographic(10), 0.5);
    expect(zoomed.kind === 'orthographic' && zoomed.height).toBeCloseTo(5);
  });

  it('clamps the frame height at both ends', () => {
    const tiny = zoomProjection(orthographic(10), 1e-12);
    expect(tiny.kind === 'orthographic' && tiny.height).toBe(defaultZoomLimits.minHeight);
    const huge = zoomProjection(orthographic(10), 1e12);
    expect(huge.kind === 'orthographic' && huge.height).toBe(defaultZoomLimits.maxHeight);
  });

  it('leaves a perspective projection alone, because it zooms by moving', () => {
    const projection = perspective(45);
    expect(zoomProjection(projection, 0.5)).toBe(projection);
  });
});

describe('fitBounds', () => {
  const view = viewState(cameraPose([100, 0, 0], [0, 0, 0], zUp), perspective(50), metresZUpLocal);

  // The fitted view, insisting that there was something to fit.
  const fitted = (from: ViewState, bounds: Bounds, options?: FitOptions): ViewState => {
    const result = options === undefined ? fitBounds(from, bounds) : fitBounds(from, bounds, options);
    if (result === undefined) throw new Error('expected a view that fits the bounds');
    return result;
  };

  it('shows the whole box in a perspective view, without leaving it small', () => {
    const result = fitted(view, box, { aspect: 1.6, padding: 1.05 });
    expect(overflow(result, box, 1.6)).toBeLessThanOrEqual(1);
    expect(overflow(result, box, 1.6)).toBeGreaterThan(0.5);
  });

  it('shows the whole box in a portrait viewport, where the width is the tight dimension', () => {
    expect(overflow(fitted(view, box, { aspect: 0.5, padding: 1.05 }), box, 0.5)).toBeLessThanOrEqual(1);
  });

  it('shows the whole box in an orthographic view, in every viewport shape', () => {
    const flat = setProjectionKind(view, 'orthographic');
    for (const aspect of [2, 1, 0.4]) {
      expect(overflow(fitted(flat, box, { aspect, padding: 1.05 }), box, aspect)).toBeLessThanOrEqual(1);
    }
  });

  it('targets the middle of the box and keeps the direction the view was looking', () => {
    const result = fitted(view, box, { aspect: 1, padding: 1 });
    expect(result.camera.target).toEqual([3, 8, 1.5]);
    expect(result.camera.position[1]).toBeCloseTo(8);
    expect(result.camera.position[2]).toBeCloseTo(1.5);
    expect(result.camera.position[0]).toBeGreaterThan(3);
  });

  it('accepts an explicit direction to look from', () => {
    const result = fitted(view, box, { aspect: 1, padding: 1, direction: [0, 0, -1] });
    expect(result.camera.position[0]).toBeCloseTo(3);
    expect(result.camera.position[2]).toBeGreaterThan(1.5);
  });

  it('cuts the depth planes around the box', () => {
    const result = fitted(view, box, { aspect: 1, padding: 1 });
    expect(result.projection.near).toBeGreaterThan(0);
    expect(result.projection.near).toBeLessThan(result.projection.far);
    expect(result.projection.far).toBeLessThan(view.projection.far);
  });

  it('keeps the projection kind and the coordinate frame', () => {
    expect(fitted(setProjectionKind(view, 'orthographic'), box).projection.kind).toBe('orthographic');
    expect(fitted(view, box).coordinates).toBe(metresZUpLocal);
  });

  it('has nothing to fit for an empty box', () => {
    expect(fitBounds(view, emptyBounds)).toBeUndefined();
  });

  it('fits a box with no size without dividing by zero', () => {
    const result = fitted(view, { min: [1, 1, 1], max: [1, 1, 1] });
    expect(result.camera.target).toEqual([1, 1, 1]);
    expect(result.camera.position.every(Number.isFinite)).toBe(true);
  });
});
