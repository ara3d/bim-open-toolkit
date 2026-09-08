import { describe, expect, it } from 'vitest';
import { emptyDocument, getSlice, putSlice } from '@bim-open-toolkit/model';
import { isClipped, planesOf, type ClipPlane } from '@bim-open-toolkit/render';
import {
  clippingCommands,
  clippingFeature,
  clippingHook,
  clippingSlice,
  defaultClipping,
  sectionForLevel,
  sectionRegion,
} from '../src/clipping.js';
import { levelsOf } from '../src/navigation-aids.js';
import { building } from './navigation-aids-fixture.js';
import { fakeSession } from './support/fake-session.js';

const session = () => fakeSession(clippingCommands);

// The planes the slice holds, or an empty list when it holds a region that cannot be resolved.
const planesInForce = (region: ReturnType<typeof sectionRegion>): readonly ClipPlane[] => {
  if (!region.ok) return [];
  const planes = planesOf(region.value);
  return planes.ok ? planes.value : [];
};

describe('sections', () => {
  it('keeps the slab a thickness describes and nothing outside it', () => {
    const planes = planesInForce(sectionRegion(3, 3));
    expect(planes).toEqual([
      { normal: [0, 0, 1], constant: -3 },
      { normal: [0, 0, -1], constant: 6 },
    ]);
    expect(isClipped(planes, [0, 0, 4])).toBe(false);
    expect(isClipped(planes, [0, 0, 2])).toBe(true);
    expect(isClipped(planes, [0, 0, 7])).toBe(true);
  });

  it('keeps one side when there is no thickness', () => {
    const below = planesInForce(sectionRegion(3, undefined));
    expect(isClipped(below, [0, 0, 1])).toBe(false);
    expect(isClipped(below, [0, 0, 5])).toBe(true);
    const above = planesInForce(sectionRegion(3, undefined, 'z', 'above'));
    expect(isClipped(above, [0, 0, 5])).toBe(false);
    expect(isClipped(above, [0, 0, 1])).toBe(true);
  });

  it('cuts along whichever axis it is given', () => {
    const planes = planesInForce(sectionRegion(2, 1, 'x'));
    expect(isClipped(planes, [2.5, 0, 0])).toBe(false);
    expect(isClipped(planes, [0, 2.5, 0])).toBe(true);
  });

  it('refuses a slab with no thickness to it', () => {
    expect(sectionRegion(3, 0).diagnostics.map((item) => item.code)).toEqual(['clipping/thickness']);
    expect(sectionRegion(Number.NaN, 1).diagnostics.map((item) => item.code)).toEqual(['clipping/elevation']);
  });

  it('shows one storey, and everything above the topmost one', () => {
    const levels = levelsOf(building());
    const ground = planesInForce(sectionForLevel(levels[0] ?? { id: '', name: '', elevation: 0 }));
    expect(isClipped(ground, [0, 0, 1])).toBe(false);
    expect(isClipped(ground, [0, 0, 4])).toBe(true);
    const top = planesInForce(sectionForLevel(levels[1] ?? { id: '', name: '', elevation: 0 }));
    expect(top).toHaveLength(1);
    expect(isClipped(top, [0, 0, 4])).toBe(false);
    expect(isClipped(top, [0, 0, 1])).toBe(true);
  });
});

describe('the clipping slice', () => {
  it('round-trips a section through a document', () => {
    const saved = { enabled: true, region: { kind: 'box', min: [0, 0, 0], max: [1, 2, 3] } } as const;
    const document = putSlice(emptyDocument(), clippingSlice, saved);
    const read = getSlice(document, clippingSlice);
    expect(read.ok && read.value).toEqual(saved);
  });

  it('reads its default out of a document that has no section', () => {
    const read = getSlice(emptyDocument(), clippingSlice);
    expect(read.ok && read.value).toEqual(defaultClipping);
  });

  it('refuses a value written at a version it does not know', () => {
    const read = getSlice(
      { ...emptyDocument(), slices: { clipping: { version: 2, value: defaultClipping } } },
      clippingSlice,
    );
    expect(read.diagnostics.map((item) => item.code)).toEqual(['slice/version']);
  });
});

describe('the clipping commands', () => {
  it('normalises the planes it is given before storing them', () => {
    const live = session();
    const done = live.dispatch('clipping.setPlanes', { planes: [{ normal: [0, 0, 2], constant: -6 }] });
    expect(done.ok).toBe(true);
    expect(live.read(clippingSlice)).toEqual({
      enabled: true,
      region: { kind: 'planes', planes: [{ normal: [0, 0, 1], constant: -3 }] },
    });
    expect(live.events).toEqual(['clipping.setPlanes:clipping']);
  });

  it('refuses a plane with no direction', () => {
    const live = session();
    const done = live.dispatch('clipping.setPlanes', { planes: [{ normal: [0, 0, 0], constant: 1 }] });
    expect(done.diagnostics.map((item) => item.code)).toEqual(['bad-plane']);
    expect(live.read(clippingSlice)).toEqual(defaultClipping);
  });

  it('stores a box and refuses one that is inside out', () => {
    const live = session();
    expect(live.dispatch('clipping.setBox', { min: [0, 0, 0], max: [1, 1, 1] }).ok).toBe(true);
    expect(live.read(clippingSlice).region).toEqual({ kind: 'box', min: [0, 0, 0], max: [1, 1, 1] });
    const wrong = live.dispatch('clipping.setBox', { min: [2, 0, 0], max: [1, 1, 1] });
    expect(wrong.diagnostics.map((item) => item.code)).toEqual(['bad-box']);
  });

  it('sections at a height and clears back to nothing clipped', () => {
    const live = session();
    live.dispatch('clipping.sectionAt', { elevation: 3, thickness: 3 });
    expect(live.read(clippingSlice).enabled).toBe(true);
    live.dispatch('clipping.clear', {});
    expect(live.read(clippingSlice)).toEqual(defaultClipping);
  });

  it('refuses input of the wrong shape rather than guessing', () => {
    const live = session();
    const done = live.dispatch('clipping.setBox', { min: [0, 0], max: [1, 1, 1] });
    expect(done.ok).toBe(false);
    expect(done.diagnostics.map((item) => item.code)).toEqual(['schema/length']);
  });
});

describe('the clipping hook', () => {
  it('puts the slice in force, follows every change, and lifts on disposal', () => {
    const applied: (readonly ClipPlane[])[] = [];
    const live = session();
    const installed = clippingHook({ setPlanes: (planes) => applied.push(planes) })(live);
    expect(applied).toEqual([[]]);
    live.dispatch('clipping.setBox', { min: [0, 0, 0], max: [1, 1, 1] });
    expect(applied[applied.length - 1]).toHaveLength(6);
    live.dispatch('clipping.clear', {});
    expect(applied[applied.length - 1]).toEqual([]);
    expect(applied).toHaveLength(3);
    installed.dispose();
    expect(applied[applied.length - 1]).toEqual([]);
    live.dispatch('clipping.setBox', { min: [0, 0, 0], max: [1, 1, 1] });
    expect(applied).toHaveLength(4);
  });

  it('leaves an object on the visible side pickable, which is what identity depends on', () => {
    const live = session();
    live.dispatch('clipping.sectionAt', { elevation: 3, thickness: 3 });
    const region = live.read(clippingSlice).region;
    const planes = planesOf(region);
    expect(planes.ok).toBe(true);
    const inForce = planes.ok ? planes.value : [];
    expect(isClipped(inForce, [2, 0, 4])).toBe(false);
    expect(isClipped(inForce, [2, 0, 1])).toBe(true);
  });
});

describe('the feature', () => {
  it('owns the clipping slice and its four commands', () => {
    expect(clippingFeature.id).toBe('clipping');
    expect(clippingFeature.slice.id).toBe('clipping');
    expect(clippingFeature.commands.map((item) => item.name)).toEqual([
      'clipping.setPlanes',
      'clipping.setBox',
      'clipping.sectionAt',
      'clipping.clear',
    ]);
  });
});
