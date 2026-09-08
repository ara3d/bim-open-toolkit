import { describe, expect, it } from 'vitest';
import {
  cellOf, colorColumnNames, emptyInstances, identityMatrix, instanceColor, instanceOpacity,
  instanceRecords, instanceTable, instanceTransform, numberOf, rowsInSet, setOf, setOfRows, table,
  transformColumnNames, type InstanceRecord, type InstanceRecords, type Table,
} from '../src/index.js';
import { colorStride, transformStride } from '../src/mesh.js';

// Records whose every component is a distinct number, so a mixed-up column shows up as a wrong value.
const numberedInstances = (count: number): InstanceRecords => {
  const records = emptyInstances(count);
  for (let row = 0; row < count; row += 1) {
    records.meshIndex[row] = row % 7;
    records.objectIndex[row] = row;
    for (let offset = 0; offset < transformStride; offset += 1)
      records.transform[row * transformStride + offset] = row + offset / 100;
    for (let offset = 0; offset < colorStride; offset += 1)
      records.color[row * colorStride + offset] = (row % 5) / 4 + offset / 1000;
  }
  return records;
};

// The per-row build the composition probe had to write: one Matrix4 and one Color allocated per row.
const naiveInstanceTable = (records: InstanceRecords): Table => {
  const transforms = transformColumnNames.map(() => new Float32Array(records.count));
  const colors = colorColumnNames.map(() => new Float32Array(records.count));
  for (let row = 0; row < records.count; row += 1) {
    const transform = instanceTransform(records, row);
    const color = instanceColor(records, row);
    const opacity = instanceOpacity(records, row);
    transforms.forEach((values, offset) => {
      values[row] = transform[offset] ?? 0;
    });
    colors.forEach((values, offset) => {
      values[row] = offset === 3 ? opacity : color[offset] ?? 0;
    });
  }
  return table([
    ['meshIndex', { type: 'i32', values: records.meshIndex }],
    ['objectIndex', { type: 'i32', values: records.objectIndex }],
    ...transformColumnNames.map((name, offset) => [name, { type: 'f32', values: transforms[offset] ?? new Float32Array() }] as const),
    ...colorColumnNames.map((name, offset) => [name, { type: 'f32', values: colors[offset] ?? new Float32Array() }] as const),
  ]);
};

// Milliseconds the work takes, best of three runs, so one pause does not decide the comparison.
const bestOfThree = (work: () => unknown): number => {
  const times = [0, 1, 2].map(() => {
    const started = performance.now();
    work();
    return performance.now() - started;
  });
  return Math.min(...times);
};

describe('instanceTable', () => {
  const records = numberedInstances(20);
  const rows = instanceTable(records);

  it('has one row per instance and one column per component', () => {
    expect(rows.rowCount).toBe(20);
    expect(rows.columns.size).toBe(2 + transformStride + colorStride);
    expect(transformColumnNames[12]).toBe('m12');
    expect(colorColumnNames).toEqual(['red', 'green', 'blue', 'alpha']);
  });

  it('views the records own index arrays rather than copying them', () => {
    expect(rows.columns.get('meshIndex')?.values).toBe(records.meshIndex);
    expect(rows.columns.get('objectIndex')?.values).toBe(records.objectIndex);
  });

  it('reads back exactly what instanceTransform, instanceColor and instanceOpacity read', () => {
    for (const row of [0, 1, 7, 19]) {
      const transform = instanceTransform(records, row);
      transformColumnNames.forEach((name, offset) => {
        expect(numberOf(rows, name, row)).toBe(transform[offset]);
      });
      const color = instanceColor(records, row);
      expect(numberOf(rows, 'red', row)).toBe(color[0]);
      expect(numberOf(rows, 'green', row)).toBe(color[1]);
      expect(numberOf(rows, 'blue', row)).toBe(color[2]);
      expect(numberOf(rows, 'alpha', row)).toBe(instanceOpacity(records, row));
    }
  });

  it('has no rows when the records have none', () => {
    expect(instanceTable(emptyInstances(0)).rowCount).toBe(0);
  });

  it('has no visibility column when the records have none', () => {
    expect(rows.columns.has('visible')).toBe(false);
  });
});

describe('instanceTable visibility', () => {
  const keys = ['a', 'b', 'c'];
  const placed = instanceRecords(keys.map((_unused, index): InstanceRecord => ({
    meshIndex: 0, transform: identityMatrix, color: [1, 1, 1], opacity: 1, objectIndex: index,
    visible: index !== 1,
  })));

  it('exposes the records own visibility bytes as a bool column', () => {
    const rows = instanceTable(placed);
    expect(rows.columns.get('visible')?.values).toBe(placed.visible);
    expect([0, 1, 2].map((row) => cellOf(rows, 'visible', row))).toEqual([true, false, true]);
  });

  it('exposes material columns only when the records carry them', () => {
    expect(instanceTable(placed).columns.has('roughness')).toBe(false);
    const shiny = instanceRecords([{
      meshIndex: 0, transform: identityMatrix, color: [1, 1, 1], opacity: 1, objectIndex: 0,
      roughness: 0.25, metallic: 1,
    }]);
    const rows = instanceTable(shiny);
    expect(rows.columns.get('roughness')?.values).toBe(shiny.roughness);
    expect(rows.columns.get('metallic')?.values).toBe(shiny.metallic);
    expect(numberOf(rows, 'roughness', 0)).toBeCloseTo(0.25);
  });

  it('keeps a hidden row hidden through a set selection', () => {
    const kept = rowsInSet(instanceTable(placed), 'objectIndex', setOf(['b', 'c']), keys);
    expect(kept.rowCount).toBe(2);
    expect([0, 1].map((row) => cellOf(kept, 'visible', row))).toEqual([false, true]);
    expect(setOfRows(kept, 'objectIndex', keys)).toEqual(setOf(['b', 'c']));
  });
});

describe('instanceTable at 100k rows', () => {
  const records = numberedInstances(100_000);

  it('matches the per-row build on sampled rows', () => {
    const columnar = instanceTable(records);
    const naive = naiveInstanceTable(records);
    for (const row of [0, 1, 12_345, 99_999]) {
      transformColumnNames.forEach((name) => {
        expect(numberOf(columnar, name, row)).toBe(numberOf(naive, name, row));
      });
      colorColumnNames.forEach((name) => {
        expect(numberOf(columnar, name, row)).toBe(numberOf(naive, name, row));
      });
    }
  });

  // The check is the relationship, not a wall time: the per-row build allocates a Matrix4 and a
  // Color per row and calls three functions per row, and the columnar build does neither. Both move
  // the same bytes, so that difference is all there is to win; measured 3.8 times on this machine,
  // asserted at twice so a loaded machine does not fail the suite.
  it('is at least twice as fast as the per-row build', () => {
    const naive = bestOfThree(() => naiveInstanceTable(records));
    const columnar = bestOfThree(() => instanceTable(records));
    expect(columnar * 2).toBeLessThan(naive);
  });
});
