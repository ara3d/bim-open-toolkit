import { describe, expect, it } from 'vitest';
import { metresZUpLocal, unknownCoordinates } from '../src/coordinates.js';
import { emptyBounds, vec3Length, type Bounds } from '../src/math.js';
import { styleRule } from '../src/style.js';
import {
  atDistance, boundsRadius, cameraPose, defaultView, findSavedView, fitDistance, frameBounds,
  orthographic, panBy, perspective, putSavedView, removeSavedView, savedView, viewDirection,
  viewDistance, viewState,
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
