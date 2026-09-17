import { describe, expect, it } from 'vitest';
import { metresZUpLocal, unknownCoordinates } from '../src/coordinates.js';
import {
  crossVec3, dotVec3, emptyBounds, normalizeVec3, subVec3, vec3Length, type Bounds, type Vec2, type Vec3,
} from '../src/math.js';
import { styleRule } from '../src/style.js';
import {
  atDistance, boundsRadius, cameraPose, defaultView, findSavedView, fitDistance, fitOrthographicHeight,
  frameBounds, frameBoundsInViewport, orthographic, panBy, perspective, putSavedView, removeSavedView,
  savedView, viewDirection, viewDistance, viewState, type ViewState,
} from '../src/view.js';

const box: Bounds = { min: [-1, -1, -1], max: [1, 1, 1] };
const pose = cameraPose([0, 0, 10], [0, 0, 0], [0, 1, 0]);

describe('camera', () => {
  it('reports where it looks and how far', () => {
    expect(viewDirection(pose)).toEqual([0, 0, -10]);
    expect(viewDistance(pose)).toBe(10);
  });

  it('moves along its own direction to a new distance', () => {
    expect(atDistance(pose, 5).position).toEqual([0, 0, 5]);
    expect(atDistance(pose, 5).target).toEqual([0, 0, 0]);
  });

  it('stands still when it has no direction to move along', () => {
    const degenerate = cameraPose([1, 1, 1], [1, 1, 1], [0, 0, 1]);
    expect(atDistance(degenerate, 5)).toBe(degenerate);
  });

  it('pans camera and target together', () => {
    expect(panBy(pose, [1, 2, 3])).toEqual(cameraPose([1, 2, 13], [1, 2, 3], [0, 1, 0]));
  });
});

describe('framing', () => {
  it('measures the sphere around a box, and reports none for an empty box', () => {
    expect(boundsRadius(box)).toBeCloseTo(Math.sqrt(3));
    expect(boundsRadius(emptyBounds)).toBeUndefined();
  });

  it('puts a perspective camera far enough away that the sphere fits', () => {
    const distance = fitDistance(1, perspective(90), 1);
    expect(distance).toBeCloseTo(Math.SQRT2);
  });

  it('backs off further for a narrow viewport, so nothing is cut off sideways', () => {
    expect(fitDistance(1, perspective(60), 0.5)).toBeGreaterThan(fitDistance(1, perspective(60), 1));
  });

  it('frames a box from a direction', () => {
    const framed = frameBounds(box, [0, 0, -1], perspective(60), 1);
    expect(framed?.camera.target).toEqual([0, 0, 0]);
    expect(framed?.camera.position[2]).toBeGreaterThan(0);
    expect(vec3Length(viewDirection(framed?.camera ?? pose))).toBeCloseTo(fitDistance(Math.sqrt(3), perspective(60), 1));
  });

  it('sizes an orthographic projection to the box instead of moving it closer', () => {
    const framed = frameBounds(box, [0, 0, -1], orthographic(1), 1);
    expect(framed?.projection).toEqual(orthographic(Math.sqrt(3) * 2));
  });

  it('frames nothing when the box is empty or the direction has no length', () => {
    expect(frameBounds(emptyBounds, [0, 0, -1])).toBeUndefined();
    expect(frameBounds(box, [0, 0, 0])).toBeUndefined();
  });
});

describe('framing for a viewport', () => {
  const direction: Vec3 = [0, -1, 0];
  const radius = Math.sqrt(3);

  // The eight corners of a box.
  const corners = (source: Bounds): readonly Vec3[] =>
    [0, 1, 2, 3, 4, 5, 6, 7].map((corner): Vec3 => [
      (corner & 1) === 0 ? source.min[0] : source.max[0],
      (corner & 2) === 0 ? source.min[1] : source.max[1],
      (corner & 4) === 0 ? source.min[2] : source.max[2],
    ]);

  // Where each corner lands across and up the picture, measured from the middle of it.
  const pictureOffsets = (view: ViewState, source: Bounds): readonly Vec2[] => {
    const forward = normalizeVec3(viewDirection(view.camera)) ?? [0, 0, -1];
    const across = normalizeVec3(crossVec3(forward, view.camera.up)) ?? [1, 0, 0];
    const above = crossVec3(across, forward);
    return corners(source).map((point): Vec2 => {
      const offset = subVec3(point, view.camera.position);
      return [dotVec3(offset, across), dotVec3(offset, above)];
    });
  };

  // Half the width and half the height an orthographic view shows, or nothing for a perspective one.
  const halfExtent = (view: ViewState, aspect: number): Vec2 | undefined =>
    view.projection.kind === 'orthographic'
      ? [(view.projection.height * aspect) / 2, view.projection.height / 2]
      : undefined;

  it('shows the whole sphere however the viewport is shaped', () => {
    expect(fitOrthographicHeight(1, 1)).toBe(2);
    expect(fitOrthographicHeight(1, 2)).toBe(2);
    expect(fitOrthographicHeight(1, 0.5)).toBe(4);
  });

  it('fits every corner of the box at a portrait and at a landscape aspect', () => {
    for (const aspect of [0.5, 1, 2]) {
      const framed = frameBoundsInViewport(box, direction, orthographic(1), aspect) ?? defaultView;
      const half = halfExtent(framed, aspect) ?? [0, 0];
      for (const [across, above] of pictureOffsets(framed, box)) {
        expect(Math.abs(across)).toBeLessThanOrEqual(half[0]);
        expect(Math.abs(above)).toBeLessThanOrEqual(half[1]);
      }
    }
  });

  it('is what a portrait viewport needs and `frameBounds` does not give it', () => {
    const cut = frameBounds(box, direction, orthographic(1), 0.5) ?? defaultView;
    const widest = pictureOffsets(cut, box).map(([across]) => Math.abs(across));
    expect(Math.max(...widest)).toBeGreaterThan((halfExtent(cut, 0.5) ?? [0, 0])[0]);
    expect(frameBoundsInViewport(box, direction, orthographic(1), 0.5)?.projection)
      .toEqual(orthographic(radius * 4));
  });

  it('frames exactly as `frameBounds` does for a square viewport or a perspective camera', () => {
    expect(frameBoundsInViewport(box, direction, orthographic(1), 1))
      .toEqual(frameBounds(box, direction, orthographic(1), 1));
    expect(frameBoundsInViewport(box, direction, perspective(60), 0.5))
      .toEqual(frameBounds(box, direction, perspective(60), 0.5));
    expect(frameBoundsInViewport(emptyBounds, direction, orthographic(1), 0.5)).toBeUndefined();
    expect(frameBoundsInViewport(box, [0, 0, 0], orthographic(1), 0.5)).toBeUndefined();
  });
});

describe('view state', () => {
  it('declares the frame it reports in', () => {
    expect(viewState(pose).coordinates).toEqual(metresZUpLocal);
    expect(viewState(pose, perspective(), unknownCoordinates).coordinates).toEqual(unknownCoordinates);
    expect(defaultView.projection.kind).toBe('perspective');
  });
});

describe('saved views', () => {
  const one = savedView('v1', 'Entrance', viewState(pose), ['a'], [styleRule('r1', 'red', ['a'], {})]);
  const two = savedView('v2', 'Roof', defaultView);

  it('saves the camera and the appearance state with it', () => {
    expect(one.selection).toEqual(['a']);
    expect(one.rules.map((rule) => rule.id)).toEqual(['r1']);
    expect(one.view.camera).toEqual(pose);
  });

  it('adds, finds, replaces and removes by id', () => {
    const views = putSavedView(putSavedView([], one), two);
    expect(views.map((view) => view.id)).toEqual(['v1', 'v2']);
    expect(findSavedView(views, 'v2')).toBe(two);
    expect(findSavedView(views, 'missing')).toBeUndefined();
    const renamed = putSavedView(views, { ...one, name: 'Front door' });
    expect(renamed.map((view) => view.name)).toEqual(['Front door', 'Roof']);
    expect(removeSavedView(views, 'v1').map((view) => view.id)).toEqual(['v2']);
  });
});
