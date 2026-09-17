import { describe, expect, it } from 'vitest';
import { defaultAppearance, identityMatrix, translation, type Matrix4 } from '@bim-open-toolkit/model';
import {
  boxMesh,
  boxRepresentation,
  changedReplacements,
  drawnReplacements,
  isReplaced,
  meshBounds,
  noReplacements,
  replaceObject,
  replacedKeys,
  replacementBounds,
  replacementOf,
  replacementSource,
  replacementSourceId,
  representation,
  representationRegistry,
  restoreAll,
  restoreObject,
  type ReplacementState,
  type RepresentationRegistry,
} from '../src/representations.js';
import type { Ray } from '../src/picking.js';
import { cube, fixtureKey } from './fixture.js';

const unwrap = <T>(result: { ok: true; value: T } | { ok: false }): T => {
  if (!result.ok) throw new Error('expected a value');
  return result.value;
};

const registry = (): RepresentationRegistry =>
  unwrap(
    representationRegistry([
      unwrap(boxRepresentation('box', { min: [-1, -1, -1], max: [1, 1, 1] })),
      representation('cube', cube(2)),
    ]),
  );

describe('boxMesh', () => {
  it('builds a closed box on the given bounds', () => {
    const box = unwrap(boxMesh({ min: [0, 0, 0], max: [2, 4, 6] }));
    expect(box.positions.length / 3).toBe(8);
    expect(box.indices.length / 3).toBe(12);
    expect(box.bounds.min).toEqual([0, 0, 0]);
    expect(box.bounds.max).toEqual([2, 4, 6]);
  });

  it('refuses corners that are the wrong way round or not finite', () => {
    expect(boxMesh({ min: [1, 0, 0], max: [0, 1, 1] }).ok).toBe(false);
    expect(boxMesh({ min: [Number.NaN, 0, 0], max: [1, 1, 1] }).ok).toBe(false);
  });
});

describe('representationRegistry', () => {
  it('holds representations by id and shares their meshes', () => {
    const source = cube(1);
    const held = unwrap(representationRegistry([representation('a', source)]));
    expect(held.get('a')?.mesh).toBe(source);
  });

  it('refuses a repeated id rather than letting the last one win', () => {
    const result = representationRegistry([representation('a', cube(1)), representation('a', cube(2))]);
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe('repeated-representation');
  });
});

describe('replacement state', () => {
  it('records and removes a replacement without touching anything else', () => {
    const first = replaceObject(noReplacements, fixtureKey(0), 'box');
    const second = replaceObject(first, fixtureKey(1), 'cube');
    expect(isReplaced(second, fixtureKey(0))).toBe(true);
    expect(replacedKeys(second)).toHaveLength(2);
    expect(isReplaced(noReplacements, fixtureKey(0))).toBe(false);
    const back = restoreObject(second, fixtureKey(0));
    expect(isReplaced(back, fixtureKey(0))).toBe(false);
    expect(isReplaced(back, fixtureKey(1))).toBe(true);
    expect(replacedKeys(restoreAll())).toHaveLength(0);
  });

  it('replaces the substitute, not the original, when an object is replaced twice', () => {
    const once = replaceObject(noReplacements, fixtureKey(0), 'box', translation([1, 0, 0]));
    const twice = replaceObject(once, fixtureKey(0), 'cube');
    expect(replacementOf(twice, fixtureKey(0))?.representationId).toBe('cube');
    expect(replacedKeys(twice)).toHaveLength(1);
    expect(replacementOf(once, fixtureKey(0))?.representationId).toBe('box');
  });

  it('returns the same state when restoring an object that was not replaced', () => {
    expect(restoreObject(noReplacements, fixtureKey(0))).toBe(noReplacements);
  });

  it('sits at the origin unless a transform is given', () => {
    expect(replacementOf(replaceObject(noReplacements, fixtureKey(0), 'box'), fixtureKey(0))?.transform).toEqual(
      identityMatrix,
    );
  });
});

describe('changedReplacements', () => {
  it('names the objects whose rows have to be shown or hidden again', () => {
    const before: ReplacementState = replaceObject(noReplacements, fixtureKey(0), 'box');
    const after = replaceObject(restoreObject(before, fixtureKey(0)), fixtureKey(1), 'cube');
    expect([...changedReplacements(before, after)].sort()).toEqual([fixtureKey(0), fixtureKey(1)].sort());
  });

  it('names an object whose representation changed', () => {
    const before = replaceObject(noReplacements, fixtureKey(0), 'box');
    const after = replaceObject(before, fixtureKey(0), 'cube');
    expect(changedReplacements(before, after)).toEqual([fixtureKey(0)]);
  });

  it('names nothing when nothing moved', () => {
    const state = replaceObject(noReplacements, fixtureKey(0), 'box');
    expect(changedReplacements(state, state)).toHaveLength(0);
  });
});

describe('drawnReplacements', () => {
  it('lists what to draw, with the appearance the caller resolved', () => {
    const state = replaceObject(noReplacements, fixtureKey(0), 'box', translation([3, 0, 0]));
    const result = drawnReplacements(registry(), state, () => ({ ...defaultAppearance, opacity: 0.4 }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(1);
    expect(result.value[0]?.key).toBe(fixtureKey(0));
    expect(result.value[0]?.appearance.opacity).toBe(0.4);
    expect(result.value[0]?.transform[12]).toBe(3);
  });

  it('reports a representation the registry does not hold and draws nothing for it', () => {
    const state = replaceObject(noReplacements, fixtureKey(0), 'missing');
    const result = drawnReplacements(registry(), state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toHaveLength(0);
    expect(result.diagnostics[0]?.code).toBe('unknown-representation');
  });
});

describe('replacementBounds', () => {
  it('reports the world bounds of a placed substitute', () => {
    const state = replaceObject(noReplacements, fixtureKey(0), 'box', translation([10, 0, 0]));
    const replacement = replacementOf(state, fixtureKey(0));
    if (replacement === undefined) throw new Error('bad fixture');
    expect(replacementBounds(registry(), replacement)?.min).toEqual([9, -1, -1]);
    expect(replacementBounds(registry(), { ...replacement, representationId: 'gone' })).toBeUndefined();
  });

  it('recomputes the bounds of a mesh a host built', () => {
    expect(meshBounds(cube(2)).max).toEqual([1, 1, 1]);
  });
});

describe('replacementSource', () => {
  const ray: Ray = { origin: [0, 0, -10], direction: [0, 0, 1] };

  it('picks the substitute, reporting the object it stands for', () => {
    const state = replaceObject(noReplacements, fixtureKey(0), 'box');
    const drawn = drawnReplacements(registry(), state);
    if (!drawn.ok) throw new Error('bad fixture');
    const hits = replacementSource(drawn.value).hits(ray);
    expect(hits).toHaveLength(1);
    expect(hits[0]?.key).toBe(fixtureKey(0));
    expect(hits[0]?.source).toBe(replacementSourceId);
    expect(hits[0]?.distance).toBeCloseTo(9, 6);
    expect(hits[0]?.row).toBe(-1);
  });

  it('reports the nearest substitute first', () => {
    const near: Matrix4 = translation([0, 0, -3]);
    const state = replaceObject(replaceObject(noReplacements, fixtureKey(0), 'box'), fixtureKey(1), 'box', near);
    const drawn = drawnReplacements(registry(), state);
    if (!drawn.ok) throw new Error('bad fixture');
    const hits = replacementSource(drawn.value).hits(ray);
    expect(hits.map((item) => item.key)).toEqual([fixtureKey(1), fixtureKey(0)]);
  });

  it('does not pick a hidden substitute', () => {
    const state = replaceObject(noReplacements, fixtureKey(0), 'box');
    const drawn = drawnReplacements(registry(), state, () => ({ ...defaultAppearance, visible: false }));
    if (!drawn.ok) throw new Error('bad fixture');
    expect(replacementSource(drawn.value).hits(ray)).toHaveLength(0);
  });
});
