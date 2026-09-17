import { describe, expect, it } from 'vitest';
import {
  boolColumn,
  f32Column,
  instanceTable,
  stringColumn,
  table as makeTable,
  transformColumnNames,
  transformStride,
  u32Column,
} from '@bim-open-toolkit/model';
import { buildInstanceTable, colorOfRow, transformOfRow } from '../src/instance-table.js';
import {
  DirtyRanges,
  applyUpdates,
  dirtySets,
  everyRow,
  publishDirty,
  updateColumns,
  writeColors,
  writeOpacity,
  writeTransforms,
  writeTranslations,
  writeVisibility,
} from '../src/updates.js';
import { fixtureKey, standardKeys, standardScene } from './fixture.js';

const built = () => {
  const result = buildInstanceTable(standardScene(), standardKeys);
  if (!result.ok) throw new Error('fixture did not build');
  return result.value;
};

const rows = (...values: readonly number[]) => Int32Array.from(values);
const alphaOf = (table: ReturnType<typeof built>, row: number) => colorOfRow(table, row)[3];

describe('writeColors', () => {
  it('broadcasts one colour to the listed rows and leaves the rest alone', () => {
    const table = built();
    expect(writeColors(table, rows(1, 4), Float32Array.of(0.25, 0.5, 0.75))).toBe(2);
    expect(colorOfRow(table, 1)).toEqual([0.25, 0.5, 0.75, 1]);
    expect(colorOfRow(table, 4)).toEqual([0.25, 0.5, 0.75, 1]);
    expect(colorOfRow(table, 0)).toEqual([1, 0, 0, 1]);
  });

  it('takes one colour per row when given one', () => {
    const table = built();
    const written = writeColors(table, rows(0, 2), Float32Array.of(0, 0, 1, 1, 0, 0));
    expect(written).toBe(2);
    expect(colorOfRow(table, 0)).toEqual([0, 0, 1, 1]);
    expect(colorOfRow(table, 2)).toEqual([1, 0, 0, 0.5]);
  });

  it('leaves alpha to opacity and visibility', () => {
    const table = built();
    writeColors(table, rows(2), Float32Array.of(1, 1, 1));
    expect(alphaOf(table, 2)).toBe(0.5);
  });

  it('writes nothing when the colour is already stored', () => {
    const table = built();
    expect(writeColors(table, rows(0), Float32Array.of(1, 0, 0))).toBe(0);
    expect(writeColors(table, rows(0), Float32Array.of(1, 0, 0), undefined, { detectChanges: false })).toBe(1);
  });

  it('covers every row without a row list', () => {
    const table = built();
    expect(writeColors(table, everyRow, Float32Array.of(0, 0, 0))).toBe(5);
    for (let row = 0; row < table.rowCount; row++) expect(colorOfRow(table, row).slice(0, 3)).toEqual([0, 0, 0]);
  });

  it('gives every row its own colour without a row list', () => {
    const table = built();
    const values = new Float32Array(table.rowCount * 3);
    for (let row = 0; row < table.rowCount; row++) values[row * 3] = row / 10;
    expect(writeColors(table, everyRow, values)).toBe(5);
    expect(colorOfRow(table, 3)[0]).toBeCloseTo(0.3, 6);
  });

  it('refuses a value count that is neither one value nor one per row', () => {
    const table = built();
    expect(() => writeColors(table, rows(0, 1), Float32Array.of(1, 1))).toThrow(/expected 3 or 6/);
  });

  it('skips a row that is out of range instead of corrupting a buffer', () => {
    const table = built();
    expect(writeColors(table, rows(99), Float32Array.of(1, 1, 1))).toBe(0);
  });
});

describe('writeOpacity and writeVisibility', () => {
  it('composes the stored alpha from visibility and opacity', () => {
    const table = built();
    expect(writeOpacity(table, rows(0), Float32Array.of(0.25))).toBe(1);
    expect(alphaOf(table, 0)).toBe(0.25);
    expect(writeVisibility(table, rows(0), Uint8Array.of(0))).toBe(1);
    expect(alphaOf(table, 0)).toBe(0);
    expect(table.opacity[0]).toBe(0.25);
    expect(writeVisibility(table, rows(0), Uint8Array.of(1))).toBe(1);
    expect(alphaOf(table, 0)).toBe(0.25);
  });

  it('keeps a hidden row hidden when its opacity changes', () => {
    const table = built();
    writeVisibility(table, rows(2), Uint8Array.of(0));
    expect(writeOpacity(table, rows(2), Float32Array.of(1))).toBe(1);
    expect(alphaOf(table, 2)).toBe(0);
    expect(table.opacity[2]).toBe(1);
  });

  it('hides and restores every row without a row list', () => {
    const table = built();
    expect(writeVisibility(table, everyRow, Uint8Array.of(0))).toBe(5);
    for (let row = 0; row < table.rowCount; row++) expect(alphaOf(table, row)).toBe(0);
    expect(writeVisibility(table, everyRow, Uint8Array.of(1))).toBe(5);
    expect(alphaOf(table, 2)).toBe(0.5);
  });

  it('writes nothing when the visibility already holds', () => {
    const table = built();
    expect(writeVisibility(table, everyRow, Uint8Array.of(1))).toBe(0);
  });
});

describe('writeTransforms and writeTranslations', () => {
  it('writes a whole matrix per row', () => {
    const table = built();
    const values = new Float32Array(transformStride * 2);
    values[0] = 2;
    values[transformStride] = 3;
    expect(writeTransforms(table, rows(0, 1), values)).toBe(2);
    expect(transformOfRow(table, 0)[0]).toBe(2);
    expect(transformOfRow(table, 1)[0]).toBe(3);
  });

  it('moves a row without disturbing its rotation and scale', () => {
    const table = built();
    expect(writeTranslations(table, rows(3), Float32Array.of(9, 8, 7))).toBe(1);
    const stored = transformOfRow(table, 3);
    expect(stored.slice(12, 15)).toEqual([9, 8, 7]);
    expect(stored[0]).toBe(1);
  });

  it('detects an unchanged translation', () => {
    const table = built();
    expect(writeTranslations(table, rows(3), Float32Array.of(3, 0, 0))).toBe(0);
  });

  it('covers every row without a row list', () => {
    const table = built();
    const values = new Float32Array(transformStride * table.rowCount);
    for (let row = 0; row < table.rowCount; row++) values[row * transformStride + 12] = row;
    expect(writeTransforms(table, everyRow, values)).toBe(5);
    expect(transformOfRow(table, 4)[12]).toBe(4);
    expect(transformOfRow(table, 0)[0]).toBe(0);
  });
});

describe('DirtyRanges', () => {
  it('records the touched slot span of each group once', () => {
    const ranges = new DirtyRanges(3);
    ranges.mark(1, 5);
    ranges.mark(1, 2);
    ranges.mark(1, 9);
    ranges.mark(2, 0);
    expect(ranges.touchedGroups).toBe(2);
    expect([...ranges.first]).toEqual([-1, 2, 0]);
    expect([...ranges.last]).toEqual([-1, 9, 0]);
    ranges.reset();
    expect(ranges.touchedGroups).toBe(0);
  });

  it('spans a whole group in one call', () => {
    const ranges = new DirtyRanges(1);
    ranges.markAll(0, 4);
    expect([...ranges.first]).toEqual([0]);
    expect([...ranges.last]).toEqual([3]);
    ranges.markAll(0, 0);
    expect(ranges.touchedGroups).toBe(1);
  });

  it('ignores a group ordinal it does not hold', () => {
    const ranges = new DirtyRanges(1);
    ranges.mark(4, 0);
    expect(ranges.touchedGroups).toBe(0);
  });
});

describe('dirty tracking through a write', () => {
  it('marks only the groups and slots a write touched', () => {
    const table = built();
    const dirty = dirtySets(table);
    writeColors(table, rows(3, 4), Float32Array.of(0, 0, 0), dirty);
    expect(dirty.colors.touchedGroups).toBe(2);
    expect([...dirty.colors.first]).toEqual([-1, 1, 0]);
    expect(dirty.transforms.touchedGroups).toBe(0);
  });

  it('does not mark a row whose value did not change', () => {
    const table = built();
    const dirty = dirtySets(table);
    writeColors(table, rows(0), Float32Array.of(1, 0, 0), dirty);
    expect(dirty.colors.touchedGroups).toBe(0);
  });

  it('tracks colours and transforms apart', () => {
    const table = built();
    const dirty = dirtySets(table);
    writeTranslations(table, rows(0), Float32Array.of(5, 0, 0), dirty);
    expect(dirty.transforms.touchedGroups).toBe(1);
    expect(dirty.colors.touchedGroups).toBe(0);
  });
});

describe('publishDirty', () => {
  it('publishes once per touched group, not once per changed row', () => {
    const table = built();
    const dirty = dirtySets(table);
    writeColors(table, rows(0, 1, 4), Float32Array.of(0.1, 0.2, 0.3), dirty);
    const before = table.groups.map((group) => group.colorsVersion);
    const report = publishDirty(table, dirty);
    expect(report.colorGroups).toBe(2);
    expect(report.transformGroups).toBe(0);
    const after = table.groups.map((group) => group.colorsVersion);
    expect(after[0]).toBe((before[0] ?? 0) + 1);
    expect(after[1]).toBe(before[1]);
    expect(after[2]).toBe((before[2] ?? 0) + 1);
  });

  it('leaves the published values exactly as the write left them', () => {
    const table = built();
    const dirty = dirtySets(table);
    writeColors(table, rows(1), Float32Array.of(0.1, 0.2, 0.3), dirty);
    writeTranslations(table, rows(1), Float32Array.of(4, 5, 6), dirty);
    publishDirty(table, dirty);
    expect(colorOfRow(table, 1).slice(0, 3).map((value) => Math.round(value * 10) / 10)).toEqual([0.1, 0.2, 0.3]);
    expect(transformOfRow(table, 1).slice(12, 15)).toEqual([4, 5, 6]);
  });

  it('bumps the transform version of every touched group once', () => {
    const table = built();
    const dirty = dirtySets(table);
    writeTranslations(table, rows(0, 1, 2, 3), Float32Array.of(7, 7, 7), dirty);
    const before = table.groups.map((group) => group.transformsVersion);
    expect(publishDirty(table, dirty).transformGroups).toBe(2);
    expect(table.groups[0]?.transformsVersion).toBe((before[0] ?? 0) + 1);
  });
});

describe('applyUpdates', () => {
  it('applies a colour change addressed by object ordinal to every row of that object', () => {
    const table = built();
    const changes = makeTable([
      [updateColumns.object, u32Column([1])],
      [updateColumns.red, f32Column([0])],
      [updateColumns.green, f32Column([0])],
      [updateColumns.blue, f32Column([1])],
    ]);
    const result = applyUpdates(table, changes);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.rowsAddressed).toBe(2);
    expect(result.value.rowsWritten).toBe(2);
    expect(colorOfRow(table, 2).slice(0, 3)).toEqual([0, 0, 1]);
    expect(colorOfRow(table, 3).slice(0, 3)).toEqual([0, 0, 1]);
  });

  it('addresses objects by key', () => {
    const table = built();
    const changes = makeTable([
      [updateColumns.key, stringColumn([fixtureKey(3)])],
      [updateColumns.alpha, f32Column([0.2])],
    ]);
    const result = applyUpdates(table, changes);
    expect(result.ok).toBe(true);
    expect(alphaOf(table, 4)).toBeCloseTo(0.2, 6);
  });

  it('applies visibility and a transform together', () => {
    const table = built();
    const entries: [string, ReturnType<typeof f32Column>][] = transformColumnNames.map((name, i) => [
      name,
      f32Column([i === 0 || i === 5 || i === 10 || i === 15 ? 1 : i === 12 ? 42 : 0]),
    ]);
    const changes = makeTable([
      [updateColumns.object, u32Column([0])],
      [updateColumns.visible, boolColumn([false])],
      ...entries,
    ]);
    const result = applyUpdates(table, changes);
    expect(result.ok).toBe(true);
    expect(alphaOf(table, 0)).toBe(0);
    expect(transformOfRow(table, 0)[12]).toBe(42);
  });

  it('reports objects the scene does not hold rather than failing', () => {
    const table = built();
    const changes = makeTable([
      [updateColumns.object, u32Column([0, 99])],
      [updateColumns.alpha, f32Column([0.5, 0.5])],
    ]);
    const result = applyUpdates(table, changes);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.objectsMissing).toBe(1);
    expect(result.value.rowsAddressed).toBe(1);
    expect(result.diagnostics.map((item) => item.code)).toContain('unknown-object');
  });

  it('addresses no rows for an object with no geometry', () => {
    const table = built();
    const changes = makeTable([
      [updateColumns.key, stringColumn([fixtureKey(4)])],
      [updateColumns.alpha, f32Column([0.1])],
    ]);
    const result = applyUpdates(table, changes);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.rowsAddressed).toBe(0);
    expect(result.value.objectsMissing).toBe(0);
  });

  it('refuses a table with no addressing column', () => {
    const result = applyUpdates(built(), makeTable([[updateColumns.alpha, f32Column([1])]]));
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe('no-addressing-column');
  });

  it('refuses half a colour', () => {
    const changes = makeTable([
      [updateColumns.object, u32Column([0])],
      [updateColumns.red, f32Column([1])],
    ]);
    const result = applyUpdates(built(), changes);
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe('partial-color');
  });

  it('refuses half a transform', () => {
    const changes = makeTable([
      [updateColumns.object, u32Column([0])],
      ['m0', f32Column([1])],
    ]);
    const result = applyUpdates(built(), changes);
    expect(result.ok).toBe(false);
    expect(result.diagnostics[0]?.code).toBe('partial-transform');
  });

  it('takes a table the model package built from instance records, with no translation', () => {
    const table = built();
    const geometry = standardScene();
    writeColors(table, everyRow, Float32Array.of(0, 0, 0));
    const result = applyUpdates(table, instanceTable(geometry.instances));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The instance table addresses object ordinals, so each of its rows restores every row that
    // object draws; the five drawn rows are addressed by the six records, one of which is
    // geometry-free and addresses none, and one object drawing two rows is named twice.
    expect(result.value.rowsAddressed).toBeGreaterThanOrEqual(table.rowCount);
    expect(colorOfRow(table, 0).slice(0, 3)).toEqual([1, 0, 0]);
    expect(colorOfRow(table, 4).slice(0, 3)).toEqual([1, 1, 0]);
  });

  it('records dirty ranges the caller can publish', () => {
    const table = built();
    const dirty = dirtySets(table);
    const changes = makeTable([
      [updateColumns.object, u32Column([1, 3])],
      [updateColumns.visible, boolColumn([false, false])],
    ]);
    expect(applyUpdates(table, changes, dirty).ok).toBe(true);
    expect(dirty.colors.touchedGroups).toBe(2);
    expect(publishDirty(table, dirty).colorGroups).toBe(2);
  });
});
