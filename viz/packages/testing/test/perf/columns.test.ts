// Correctness contract of the columnar bulk-write helper used by the performance tests.
import { describe, expect, it } from 'vitest';
import { DirtyRanges, createInstanceColumns, writeChannel, writeRows } from '../../src/perf/columns.js';
import { COLOR_FLOATS, createSyntheticScene, scaledShape } from '../../src/perf/scene.js';

const scene = createSyntheticScene(scaledShape(200, 3));
const columns = createInstanceColumns(scene.groups);

const colorOf = (row: number): number[] => {
  const buffer = columns.colors[columns.groupOf[row] ?? 0];
  if (!buffer) throw new Error('no buffer');
  const start = (columns.indexInGroup[row] ?? 0) * COLOR_FLOATS;
  return [...buffer.subarray(start, start + COLOR_FLOATS)];
};

describe('columnar bulk writes', () => {
  it('indexes every instance exactly once', () => {
    expect(columns.rowCount).toBe(200);
    const seen = new Set(
      Array.from({ length: columns.rowCount }, (_, row) => `${columns.groupOf[row]}:${columns.indexInGroup[row]}`));
    expect(seen.size).toBe(200);
  });

  it('broadcasts one value to the listed rows and leaves the others alone', () => {
    const untouched = colorOf(5);
    const red = Float32Array.of(1, 0, 0, 1);
    const written = writeRows(columns, 'color', Int32Array.of(1, 3), red, null, false);
    expect(written).toBe(2);
    expect(colorOf(1)).toEqual([1, 0, 0, 1]);
    expect(colorOf(3)).toEqual([1, 0, 0, 1]);
    expect(colorOf(5)).toEqual(untouched);
  });

  it('writes one value per row when the table is per-row', () => {
    const values = Float32Array.of(0.25, 0, 0, 1, 0, 0.5, 0, 1);
    const written = writeRows(columns, 'color', Int32Array.of(10, 11), values, null, false);
    expect(written).toBe(2);
    expect(colorOf(10)).toEqual([0.25, 0, 0, 1]);
    expect(colorOf(11)).toEqual([0, 0.5, 0, 1]);
  });

  it('counts only the rows that actually changed when detecting changes', () => {
    const green = Float32Array.of(0, 1, 0, 1);
    const rows = Int32Array.of(20, 21, 22);
    expect(writeRows(columns, 'color', rows, green, null, true)).toBe(3);
    expect(writeRows(columns, 'color', rows, green, null, true)).toBe(0);
    expect(writeRows(columns, 'color', rows, green, null, false)).toBe(3);
  });

  it('records the touched slot range per group, and nothing when nothing changed', () => {
    const blue = Float32Array.of(0, 0, 1, 1);
    const rows = Int32Array.of(30, 31, 32);
    const dirty = new DirtyRanges(columns.groupCount);
    writeRows(columns, 'color', rows, blue, dirty, true);
    expect(dirty.touchedGroups).toBeGreaterThan(0);
    for (let row = 30; row <= 32; row++) {
      const group = columns.groupOf[row] ?? -1;
      const slot = columns.indexInGroup[row] ?? -1;
      expect(dirty.first[group] ?? 0).toBeLessThanOrEqual(slot);
      expect(dirty.last[group] ?? 0).toBeGreaterThanOrEqual(slot);
    }
    const again = new DirtyRanges(columns.groupCount);
    writeRows(columns, 'color', rows, blue, again, true);
    expect(again.touchedGroups).toBe(0);
  });

  it('rejects a values array that matches neither shape', () => {
    expect(() => writeRows(columns, 'color', Int32Array.of(0, 1), Float32Array.of(1, 2, 3), null, false))
      .toThrow(/neither/);
  });

  it('detects a change against the stored 32-bit value, not the unrounded input', () => {
    const rows = Int32Array.of(40);
    const value = Float32Array.of(0.1, 0.1, 0.1, 1);
    expect(writeRows(columns, 'color', rows, value, null, true)).toBe(1);
    expect(writeRows(columns, 'color', rows, value, null, true)).toBe(0);
  });

  it('writes a single channel and skips rows that already hold the value', () => {
    const rows = Int32Array.of(50, 51);
    const dirty = new DirtyRanges(columns.groupCount);
    expect(writeChannel(columns, 'color', 3, 0, rows, dirty, true)).toBe(2);
    expect(colorOf(50)[3]).toBe(0);
    expect(writeChannel(columns, 'color', 3, 0, rows, null, true)).toBe(0);
    expect(writeChannel(columns, 'color', 3, 0, rows, null, false)).toBe(2);
  });

  it('rejects a channel outside the attribute', () => {
    expect(() => writeChannel(columns, 'color', 4, 0, Int32Array.of(0), null, true)).toThrow(/channel/);
  });
});
