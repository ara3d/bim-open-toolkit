import { describe, expect, it } from 'vitest';
import type { Matrix4, Vec3 } from '@bim-open-toolkit/model';
import {
  checkOverlays,
  clickAction,
  defaultOverlayStyle,
  noOverlays,
  objectAnchor,
  overlayAt,
  overlayItem,
  overlayKinds,
  overlayLayer,
  projectOverlays,
  projectToScreen,
  putItem,
  putLayer,
  removeItem,
  removeLayer,
  repeatedItemIds,
  resolveAnchor,
  setLayerVisible,
  visibleItems,
  worldAnchor,
  type OverlayItem,
  type OverlayState,
} from '../src/overlays.js';
import { fixtureKey } from './fixture.js';

const unwrap = <T>(result: { ok: true; value: T } | { ok: false }): T => {
  if (!result.ok) throw new Error('expected a value');
  return result.value;
};

// An orthographic view of the cube from -1 to 1 on every axis, looking down -z.
const view: Matrix4 = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, -1, 0, 0, 0, 0, 1];

const point = (id: string, at: Vec3, action?: { command: string; input: Record<string, string> }): OverlayItem =>
  unwrap(overlayItem(id, 'point', [worldAnchor(at)], defaultOverlayStyle, undefined, action));

describe('overlayItem', () => {
  it('accepts the anchor count each kind draws', () => {
    expect(overlayItem('a', 'point', [worldAnchor([0, 0, 0])]).ok).toBe(true);
    expect(overlayItem('a', 'line', [worldAnchor([0, 0, 0]), worldAnchor([1, 0, 0])]).ok).toBe(true);
    expect(overlayItem('a', 'box', [worldAnchor([0, 0, 0]), worldAnchor([1, 1, 1])]).ok).toBe(true);
    expect(
      overlayItem('a', 'path', [worldAnchor([0, 0, 0]), worldAnchor([1, 0, 0]), worldAnchor([2, 0, 0])]).ok,
    ).toBe(true);
  });

  it('refuses an anchor count a kind cannot draw', () => {
    const result = overlayItem('a', 'line', [worldAnchor([0, 0, 0])]);
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe('bad-anchor-count');
    expect(overlayItem('a', 'point', [worldAnchor([0, 0, 0]), worldAnchor([1, 0, 0])]).ok).toBe(false);
    expect(overlayItem('a', 'path', [worldAnchor([0, 0, 0])]).ok).toBe(false);
  });

  it('refuses a label with no text', () => {
    const result = overlayItem('a', 'label', [worldAnchor([0, 0, 0])]);
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe('missing-text');
    expect(overlayItem('a', 'label', [worldAnchor([0, 0, 0])], defaultOverlayStyle, 'Valve 3').ok).toBe(true);
  });

  it('names six kinds', () => {
    expect([...overlayKinds]).toEqual(['point', 'line', 'arrow', 'label', 'path', 'box']);
  });
});

describe('layers', () => {
  const state = (): OverlayState => putLayer(noOverlays, overlayLayer('findings', 'Findings', [point('p1', [0, 0, 0])]));

  it('adds, replaces and removes a layer', () => {
    const first = state();
    expect(first).toHaveLength(1);
    const replaced = putLayer(first, overlayLayer('findings', 'Renamed'));
    expect(replaced).toHaveLength(1);
    expect(replaced[0]?.name).toBe('Renamed');
    expect(removeLayer(replaced, 'findings')).toHaveLength(0);
  });

  it('adds, replaces and removes a primitive inside a layer', () => {
    const withTwo = putItem(state(), 'findings', point('p2', [1, 0, 0]));
    expect(withTwo[0]?.items).toHaveLength(2);
    const replaced = putItem(withTwo, 'findings', point('p2', [5, 0, 0]));
    expect(replaced[0]?.items).toHaveLength(2);
    expect(removeItem(replaced, 'findings', 'p1')[0]?.items.map((item) => item.id)).toEqual(['p2']);
  });

  it('leaves other layers alone', () => {
    const two = putLayer(state(), overlayLayer('other', 'Other', [point('q', [0, 0, 0])]));
    expect(putItem(two, 'findings', point('p3', [0, 0, 0]))[1]?.items).toHaveLength(1);
    expect(removeItem(two, 'findings', 'q')[1]?.items).toHaveLength(1);
  });

  it('hides a layer, and a hidden layer contributes nothing', () => {
    const hidden = setLayerVisible(state(), 'findings', false);
    expect(hidden[0]?.visible).toBe(false);
    expect(visibleItems(hidden)).toHaveLength(0);
    expect(visibleItems(state())).toHaveLength(1);
  });
});

describe('resolveAnchor', () => {
  it('takes a world anchor as it is', () => {
    expect(resolveAnchor(worldAnchor([1, 2, 3]), () => undefined)).toEqual([1, 2, 3]);
  });

  it('asks the caller where an object is', () => {
    const key = fixtureKey(0);
    expect(resolveAnchor(objectAnchor(key), (asked) => (asked === key ? [4, 5, 6] : undefined))).toEqual([4, 5, 6]);
  });

  it('leaves an anchor unresolved when its object has gone', () => {
    expect(resolveAnchor(objectAnchor(fixtureKey(0)), () => undefined)).toBeUndefined();
  });
});

describe('projectToScreen', () => {
  it('places a world point in pixels from the top left', () => {
    expect(projectToScreen(view, [0, 0, 0], 800, 600)).toEqual({ x: 400, y: 300 });
    expect(projectToScreen(view, [1, 1, 0], 800, 600)).toEqual({ x: 800, y: 0 });
  });

  it('refuses a point outside the view depth', () => {
    expect(projectToScreen(view, [0, 0, 5], 800, 600)).toBeUndefined();
  });
});

describe('projectOverlays', () => {
  const state = putLayer(
    noOverlays,
    overlayLayer('findings', 'Findings', [
      point('p1', [0, 0, 0]),
      unwrap(overlayItem('l1', 'line', [worldAnchor([-1, 0, 0]), worldAnchor([1, 0, 0])])),
      unwrap(overlayItem('far', 'point', [worldAnchor([0, 0, 9])])),
      unwrap(overlayItem('gone', 'point', [objectAnchor(fixtureKey(7))])),
    ]),
  );

  it('places every anchor of every visible primitive', () => {
    const projected = projectOverlays(state, view, 800, 600);
    expect(projected).toHaveLength(4);
    expect(projected[0]?.points).toEqual([{ x: 400, y: 300 }]);
    expect(projected[1]?.points).toHaveLength(2);
    expect(projected[1]?.visible).toBe(true);
  });

  it('marks a primitive invisible when one anchor falls outside the view', () => {
    const projected = projectOverlays(state, view, 800, 600);
    expect(projected[2]?.visible).toBe(false);
  });

  it('marks a primitive invisible when its object cannot be placed', () => {
    const projected = projectOverlays(state, view, 800, 600);
    expect(projected[3]?.visible).toBe(false);
    expect(projected[3]?.world).toHaveLength(0);
  });

  it('places nothing from a hidden layer', () => {
    expect(projectOverlays(setLayerVisible(state, 'findings', false), view, 800, 600)).toHaveLength(0);
  });
});

describe('overlayAt and clickAction', () => {
  const open = { command: 'open-result', input: { id: 'valve-3' } };
  const state = putLayer(
    noOverlays,
    overlayLayer('poi', 'Points of interest', [point('near', [0, 0, 0], open), point('far', [0.9, 0.9, 0])]),
  );

  it('finds the nearest primitive within the radius and gives its action', () => {
    const projected = projectOverlays(state, view, 800, 600);
    const found = overlayAt(projected, { x: 402, y: 298 }, 10);
    expect(found?.item.id).toBe('near');
    expect(clickAction(found)).toEqual(open);
  });

  it('finds nothing beyond the radius', () => {
    const projected = projectOverlays(state, view, 800, 600);
    expect(overlayAt(projected, { x: 10, y: 10 }, 10)).toBeUndefined();
    expect(clickAction(undefined)).toBeUndefined();
  });

  it('gives no action for a primitive that has none', () => {
    const projected = projectOverlays(state, view, 800, 600);
    expect(clickAction(overlayAt(projected, { x: 760, y: 30 }, 20))).toBeUndefined();
  });

  it('does not answer a click on a hidden layer', () => {
    const projected = projectOverlays(setLayerVisible(state, 'poi', false), view, 800, 600);
    expect(overlayAt(projected, { x: 400, y: 300 }, 10)).toBeUndefined();
  });
});

describe('checkOverlays', () => {
  it('reports repeated layer and primitive ids', () => {
    const state: OverlayState = [
      overlayLayer('a', 'A', [point('shared', [0, 0, 0])]),
      overlayLayer('a', 'Again', [point('shared', [1, 0, 0])]),
    ];
    expect(checkOverlays(state).map((item) => item.code)).toEqual(['repeated-layer', 'repeated-overlay-item']);
    expect(repeatedItemIds(state)).toEqual(['shared']);
  });

  it('reports nothing about a clean state', () => {
    expect(checkOverlays(putLayer(noOverlays, overlayLayer('a', 'A', [point('p', [0, 0, 0])])))).toHaveLength(0);
  });
});
