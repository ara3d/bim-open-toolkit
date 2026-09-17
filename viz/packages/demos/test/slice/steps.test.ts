import { describe, expect, it } from 'vitest';
import { ViewerScene } from '@ara3d/viewer-core';
import {
  conflicting,
  known,
  missing,
  noStyling,
  objectKey,
  quantity,
  resolveStyles,
  boolColumnOf,
  isVisible,
  stringColumnOf,
  styleOf,
  numericColumnOf,
  text,
  type ObjectKey,
} from '@bim-open-toolkit/model';
import { SceneBinding, updateColumns } from '@bim-open-toolkit/render';
import { styleChanges } from '../../src/slice/changes.js';
import { fireRatingName, sliceData } from '../../src/slice/data.js';
import { describeObservation, readoutOf, statusLine } from '../../src/slice/readout.js';
import { baseStyles, sliceStyles, unratedColor } from '../../src/slice/styles.js';

const data = sliceData();

// A binding over a scene that draws nothing: `ViewerScene` is bookkeeping, so this needs no browser.
const bound = () => {
  const binding = new SceneBinding(new ViewerScene());
  const added = binding.addModel(data.building.model.ref.id, data.building.geometry, data.keys);
  if (!added.ok) throw new Error(added.diagnostics.map((one) => one.message).join('; '));
  return binding;
};

const applied = (binding: SceneBinding, changes: ReturnType<typeof styleChanges>) => {
  const report = binding.applyChanges(data.building.model.ref.id, changes);
  if (!report.ok) throw new Error(report.diagnostics.map((one) => one.message).join('; '));
  return report.value;
};

const keysOf = (changes: ReturnType<typeof styleChanges>): readonly ObjectKey[] =>
  stringColumnOf(changes, updateColumns.key)?.values ?? [];

describe('the doors the slice paints red', () => {
  it('is exactly the doors whose fire rating is missing or conflicting', () => {
    const expected = data.building.facts
      .filter((item) => item.name === fireRatingName && item.observation.kind !== 'known')
      .map((item) => objectKey(item.subject));
    expect([...data.unratedDoors].sort()).toEqual([...expected].sort());
    expect(data.unratedDoors).not.toHaveLength(0);
  });

  it('agrees with the generator’s own coverage count', () => {
    expect(data.coverage.total).toBe(data.fireRatings.size);
    expect(data.unratedDoors).toHaveLength(data.coverage.missing + data.coverage.conflicting);
    expect(data.coverage.known + data.coverage.missing + data.coverage.conflicting).toBe(data.coverage.total);
  });

  it('leaves every door with a known rating alone', () => {
    const unrated = new Set(data.unratedDoors);
    for (const [key, fact] of data.fireRatings)
      expect(unrated.has(key)).toBe(fact.observation.kind !== 'known');
  });
});

describe('the building the page shows', () => {
  it('is the one the 2026-09-08 review measured, so the page can be checked against it', () => {
    expect(data.keys).toHaveLength(150);
    expect(data.coverage).toEqual({ total: 29, known: 11, missing: 16, conflicting: 2 });
    expect(data.unratedDoors).toHaveLength(18);
    expect(bound().statistics()).toEqual({
      sourceObjects: 150,
      groups: 8,
      renderedInstances: 123,
      visibleInstances: 123,
      renderedTriangles: 1476,
    });
  });
});

describe('the change table', () => {
  const changes = styleChanges(baseStyles(data), sliceStyles(data, [], false), data.keys);

  it('has exactly the unrated doors as its rows', () => {
    expect(changes.rowCount).toBe(data.unratedDoors.length);
    expect([...keysOf(changes)].sort()).toEqual([...data.unratedDoors].sort());
  });

  it('paints them red and nothing else', () => {
    const red = numericColumnOf(changes, updateColumns.red);
    const green = numericColumnOf(changes, updateColumns.green);
    const blue = numericColumnOf(changes, updateColumns.blue);
    expect(red).toBeDefined();
    expect([...(red?.values ?? [])]).toEqual(Array.from({ length: changes.rowCount }, () => unratedColor[0]));
    expect([...(green?.values ?? [])]).toEqual(Array.from({ length: changes.rowCount }, () => unratedColor[1]));
    expect([...(blue?.values ?? [])]).toEqual(Array.from({ length: changes.rowCount }, () => unratedColor[2]));
  });

  it('writes rows the first time and none the second', () => {
    const binding = bound();
    const first = applied(binding, changes);
    expect(first.rowsWritten).toBeGreaterThan(0);
    expect(applied(binding, changes).rowsWritten).toBe(0);
  });

  it('is empty when the same resolution is asked for twice', () => {
    const resolved = sliceStyles(data, [], false);
    expect(styleChanges(resolved, resolved, data.keys).rowCount).toBe(0);
  });
});

describe('the appearances objects start with', () => {
  it('are what binding already put in the buffers, so restoring them writes nothing', () => {
    const grey = resolveStyles(noStyling, data.keys);
    const toBase = styleChanges(grey, baseStyles(data), data.keys);
    expect(toBase.rowCount).toBeGreaterThan(0);
    expect(applied(bound(), toBase).rowsWritten).toBe(0);
  });
});

describe('hiding what a door is set into', () => {
  const solid = sliceStyles(data, [], false);
  const opened = sliceStyles(data, [], true);

  it('changes the walls and slabs and nothing else', () => {
    const changed = styleChanges(solid, opened, data.keys);
    expect(data.enclosure.length).toBeGreaterThan(0);
    expect([...keysOf(changed)].sort()).toEqual([...data.enclosure].sort());
    const shown = boolColumnOf(changed, updateColumns.visible);
    expect([...(shown?.values ?? [])]).toEqual(Array.from({ length: changed.rowCount }, () => 0));
  });

  it('leaves every unrated door red and visible', () => {
    for (const door of data.unratedDoors) {
      expect(styleOf(opened, door).color).toEqual(unratedColor);
      expect(isVisible(opened, door)).toBe(true);
    }
  });
});

describe('selecting one object', () => {
  it('changes that object and puts the one before it back', () => {
    const first = data.unratedDoors[0];
    if (first === undefined) throw new Error('the building has no unrated doors');
    const none = sliceStyles(data, [], false);
    const one = sliceStyles(data, [first], false);
    const marked = styleChanges(none, one, data.keys);
    expect([...keysOf(marked)]).toEqual([first]);
    expect([...keysOf(styleChanges(one, none, data.keys))]).toEqual([first]);
  });
});

describe('what the page says', () => {
  it('reports an observation as what it is, never as a blank', () => {
    expect(describeObservation(known(text('EI60')))).toBe('EI60');
    expect(describeObservation(known(quantity(926, 'mm')))).toBe('926 mm');
    expect(describeObservation(missing('not-provided'))).toBe('missing (not-provided)');
    expect(describeObservation(conflicting([text('EI90'), text('EI60')]))).toBe('conflicting (EI90 vs EI60)');
  });

  it('reads out a door with its category, its rating and the coverage behind it', () => {
    const door = data.unratedDoors[0];
    if (door === undefined) throw new Error('the building has no unrated doors');
    const found = readoutOf(data, door);
    expect(found.category).toBe('Door');
    expect(found.fireRating).toMatch(/^(missing|conflicting)/);
    expect(found.coverage).toContain(`${data.coverage.total} doors`);
  });

  it('says so when the object is not a door', () => {
    const slab = data.keys.find((key) => !data.fireRatings.has(key));
    if (slab === undefined) throw new Error('every object is a door');
    expect(readoutOf(data, slab).fireRating).toContain('no fire-rating fact');
  });

  it('puts the counts and the frame interval in the status line', () => {
    const line = statusLine({
      objects: 150,
      instances: 123,
      triangles: 1476,
      doors: 29,
      unratedDoors: 18,
      lastFrameMs: 16.42,
      gpu: 'no timer',
    });
    expect(line).toContain('150 objects');
    expect(line).toContain('123 instances');
    expect(line).toContain('18 of 29 doors unrated');
    expect(line).toContain('last frame 16.4 ms');
  });
});
