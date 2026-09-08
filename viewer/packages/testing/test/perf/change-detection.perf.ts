/**
 * Question: what does it cost to work out which rows a bulk update actually
 * changes, and when is that cheaper than writing every row unconditionally?
 *
 * CPU-side only: no WebGL context, so the saving measured here is the saving in
 * JavaScript work, not in GPU uploads. The reason to detect change at all is
 * mostly the uploads it avoids, which are not measured.
 *
 * Every table below reports medians. Every assertion compares the fastest of the
 * repetitions instead, because this machine is shared with other work:
 * interference can only ever make a run slower, so the minimum is the estimate
 * that survives a busy machine. Medians of two close cases swapped places under
 * load; minimums did not.
 */
import { describe, expect, it } from 'vitest';
import { createSharedColumns, diffColumn, writeRows } from '../../src/perf/columns.js';
import { measureAll, prepare, reportSamples, sampleFor } from '../../src/perf/measure.js';
import { distinctIntegers } from '../../src/perf/prng.js';
import { COLOR_FLOATS, contiguousRows, createSyntheticScene, referenceShape, sortRows } from '../../src/perf/scene.js';

const scene = createSyntheticScene(referenceShape);
const columns = createSharedColumns(scene.groups);
const sorted = sortRows(distinctIntegers(10_000, scene.rowCount, 13));
const tenth = sorted.subarray(0, 1_000);
const allRows = contiguousRows(scene.rowCount);

const settled = Float32Array.of(0.2, 0.4, 0.6, 1);
const other = Float32Array.of(0.9, 0.1, 0.1, 1);

/** A colour no repetition has written before, so every row genuinely changes. */
let tint = 0;
const nextColor = (): Float32Array => {
  tint = (tint + 0.007) % 0.5;
  return Float32Array.of(tint, 0.4, 0.9, 1);
};

/** Puts `rows` at the settled colour. Untimed setup. */
const settle = (rows: Int32Array): Int32Array => {
  writeRows(columns, 'color', rows, settled, null, false);
  return rows;
};

/** Settles `rows`, then makes `changed` differ. Untimed setup. */
const settleExcept = (rows: Int32Array, changed: Int32Array): Int32Array => {
  writeRows(columns, 'color', rows, settled, null, false);
  writeRows(columns, 'color', changed, other, null, false);
  return rows;
};

describe('detecting which rows changed', () => {
  it('costs little to check and saves the write only when most rows are unchanged', () => {
    const samples = measureAll([
      prepare({
        label: '10k rows, write unconditionally',
        setup: nextColor,
        body: (color) => writeRows(columns, 'color', sorted, color, null, false),
      }),
      prepare({
        label: '10k rows, detect, every row changes',
        setup: nextColor,
        body: (color) => writeRows(columns, 'color', sorted, color, null, true),
      }),
      prepare({
        label: '10k rows, detect, no row changes',
        setup: () => settle(sorted),
        body: (rows) => writeRows(columns, 'color', rows, settled, null, true),
      }),
      prepare({
        label: '10k rows, detect, one row in ten changes',
        setup: () => settleExcept(sorted, tenth),
        body: (rows) => writeRows(columns, 'color', rows, settled, null, true),
      }),
      prepare({
        label: 'all rows, write unconditionally',
        setup: nextColor,
        body: (color) => writeRows(columns, 'color', allRows, color, null, false),
      }),
      prepare({
        label: 'all rows, detect, every row changes',
        setup: nextColor,
        body: (color) => writeRows(columns, 'color', allRows, color, null, true),
      }),
      prepare({
        label: 'all rows, detect, no row changes',
        setup: () => settle(allRows),
        body: (rows) => writeRows(columns, 'color', rows, settled, null, true),
      }),
    ]);
    reportSamples(`change detection over ${scene.rowCount} instances`, samples);

    const write = sampleFor(samples, '10k rows, write unconditionally');
    const allChange = sampleFor(samples, '10k rows, detect, every row changes');
    const noChange = sampleFor(samples, '10k rows, detect, no row changes');
    const tenthChange = sampleFor(samples, '10k rows, detect, one row in ten changes');
    const writeAll = sampleFor(samples, 'all rows, write unconditionally');
    const allChangeAll = sampleFor(samples, 'all rows, detect, every row changes');
    const noChangeAll = sampleFor(samples, 'all rows, detect, no row changes');

    // Detection is close to free, and it saves little. Reading four floats and
    // comparing them costs about what writing them costs, so every variant stays
    // within a factor of two of the unconditional write whatever fraction of
    // rows actually changes — including the case where none do and every write
    // is skipped. Only that upper bound is asserted: how far below the write the
    // skipping cases fall varies from run to run, and the medians in the table
    // show it is not much.
    for (const sample of [allChange, noChange, tenthChange])
      expect(sample.minMs).toBeLessThan(write.minMs * 2);
    for (const sample of [allChangeAll, noChangeAll])
      expect(sample.minMs).toBeLessThan(writeAll.minMs * 2);
    // The counts prove each case detected what it claims.
    expect(write.result).toBe(sorted.length);
    expect(allChange.result).toBe(sorted.length);
    expect(noChange.result).toBe(0);
    expect(tenthChange.result).toBe(tenth.length);
    expect(noChangeAll.result).toBe(0);
  });

  it('is far cheaper than diffing whole columns to find the changed rows', () => {
    // A private pair of columns: the other cases in this list write to the live
    // store, so diffing against it would find a different number of rows each
    // round.
    const base = new Float32Array(columns.colorStore);
    const candidate = new Float32Array(base);
    const changedOut = new Int32Array(scene.rowCount);
    for (const row of sorted) candidate[row * COLOR_FLOATS] = base[row * COLOR_FLOATS] === 0.123 ? 0.456 : 0.123;

    const samples = measureAll([
      prepare({
        label: 'diff two whole colour columns to derive the changed rows',
        setup: () => candidate,
        body: (values) => diffColumn(base, values, COLOR_FLOATS, changedOut),
      }),
      prepare({
        label: 'write the 10k known rows unconditionally',
        setup: nextColor,
        body: (color) => writeRows(columns, 'color', sorted, color, null, false),
      }),
      prepare({
        label: 'write all rows unconditionally',
        setup: nextColor,
        body: (color) => writeRows(columns, 'color', allRows, color, null, false),
      }),
    ]);
    reportSamples('deriving a changed-row list against being told one', samples);

    const diff = sampleFor(samples, 'diff two whole colour columns to derive the changed rows');
    const known = sampleFor(samples, 'write the 10k known rows unconditionally');
    const writeAll = sampleFor(samples, 'write all rows unconditionally');

    // Deriving the row list costs a full pass, so it can never beat being told.
    expect(diff.minMs).toBeGreaterThan(known.minMs);
    // It is in the same class as writing the whole model, for no writes at all.
    expect(diff.minMs).toBeGreaterThan(writeAll.minMs * 0.2);
    expect(diff.result).toBe(sorted.length);
  });
});
