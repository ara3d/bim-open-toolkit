/**
 * Question: what does a bulk colour change cost, and what does the cost
 * actually consist of — the per-instance call, the memory layout, or the
 * bookkeeping that tells the renderer something changed?
 *
 * Everything here is CPU-side. No WebGL context is created, so nothing below
 * includes GPU upload or draw time.
 */
import { describe, expect, it } from 'vitest';
import { ViewerScene } from '@ara3d/viewer-core';
import { DirtyRanges, createInstanceColumns, createSharedColumns, writeRows } from '../../src/perf/columns.js';
import { measureCase, reportSamples, sampleFor, type Sample } from '../../src/perf/measure.js';
import { distinctIntegers } from '../../src/perf/prng.js';
import { COLOR_FLOATS, contiguousRows, createSyntheticScene, referenceShape, sortRows } from '../../src/perf/scene.js';

const scene = createSyntheticScene(referenceShape);
const perGroup = createInstanceColumns(scene.groups);
const shared = createSharedColumns(scene.groups);
const scattered = distinctIntegers(10_000, scene.rowCount, 5);
const sorted = sortRows(scattered);
const contiguous = contiguousRows(10_000);
const allRows = contiguousRows(scene.rowCount);

/** A different colour each repetition, so no write is skipped as unchanged. */
let tint = 0;
const nextColor = (): Float32Array => {
  tint = (tint + 0.013) % 0.5;
  return Float32Array.of(tint, 0.4, 0.9, 1);
};

const perRowTable = (rows: Int32Array): Float32Array => {
  const values = new Float32Array(rows.length * COLOR_FLOATS);
  for (let k = 0; k < rows.length; k++) {
    values[k * COLOR_FLOATS] = (k % 97) / 97;
    values[k * COLOR_FLOATS + 1] = 0.4;
    values[k * COLOR_FLOATS + 2] = 0.9;
    values[k * COLOR_FLOATS + 3] = 1;
  }
  return values;
};

/** The alpha path: one method call per instance, which bumps a version and notifies listeners. */
function setColorPerInstance(rows: Int32Array, color: Float32Array): number {
  for (let k = 0; k < rows.length; k++) {
    const row = rows[k] ?? 0;
    const group = scene.groups[scene.groupOf[row] ?? 0];
    if (!group) throw new Error('missing group');
    group.setColor(scene.indexInGroup[row] ?? 0, color[0] ?? 0, color[1] ?? 0, color[2] ?? 0, 1);
  }
  return rows.length;
}

const columnCase = (
  label: string,
  columns: typeof perGroup,
  rows: Int32Array,
  values: (rows: Int32Array) => Float32Array,
): Sample =>
  measureCase({ label, setup: () => values(rows), body: (color) => writeRows(columns, 'color', rows, color, null, false) });

describe('bulk colour updates', () => {
  it('is limited by memory layout more than by the per-instance call', () => {
    const samples: Sample[] = [
      measureCase({
        label: 'setColor per instance, 10k scattered rows',
        setup: nextColor,
        body: (color) => setColorPerInstance(scattered, color),
      }),
      columnCase('column write, per-group buffers, 10k scattered rows', perGroup, scattered, nextColor),
      columnCase('column write, per-group buffers, 10k sorted rows', perGroup, sorted, nextColor),
      columnCase('column write, per-group buffers, 10k contiguous rows', perGroup, contiguous, nextColor),
      columnCase('column write, one shared buffer, 10k scattered rows', shared, scattered, nextColor),
      columnCase('column write, one shared buffer, 10k sorted rows', shared, sorted, nextColor),
      columnCase('column write, one shared buffer, 10k rows, value per row', shared, sorted, perRowTable),
      measureCase({
        label: 'setColor per instance, all 456,598 rows',
        setup: nextColor,
        body: (color) => setColorPerInstance(allRows, color),
      }),
      columnCase('column write, per-group buffers, all rows', perGroup, allRows, nextColor),
      columnCase('column write, one shared buffer, all rows', shared, allRows, nextColor),
      measureCase({
        label: 'one pass over the shared colour store, no row indirection',
        setup: nextColor,
        body: (color) => {
          const store = shared.colorStore;
          const red = color[0] ?? 0, green = color[1] ?? 0, blue = color[2] ?? 0;
          for (let offset = 0; offset < store.length; offset += COLOR_FLOATS) {
            store[offset] = red;
            store[offset + 1] = green;
            store[offset + 2] = blue;
            store[offset + 3] = 1;
          }
          return store.length / COLOR_FLOATS;
        },
      }),
      measureCase({
        label: 'setColors, one call per group, all rows',
        setup: () => {
          const color = nextColor();
          const largest = scene.groups.reduce((max, group) => Math.max(max, group.instanceCount), 0);
          const buffer = new Float32Array(largest * COLOR_FLOATS);
          for (let i = 0; i < largest; i++) buffer.set(color, i * COLOR_FLOATS);
          return buffer;
        },
        body: (buffer) => {
          for (const group of scene.groups)
            group.setColors(0, buffer.subarray(0, group.instanceCount * COLOR_FLOATS));
          return scene.groups.length;
        },
      }),
    ];
    reportSamples(`colour updates over ${scene.rowCount} instances in ${scene.groups.length} groups`, samples);

    const perInstance = sampleFor(samples, 'setColor per instance, 10k scattered rows');
    const columnScattered = sampleFor(samples, 'column write, per-group buffers, 10k scattered rows');
    const columnSorted = sampleFor(samples, 'column write, per-group buffers, 10k sorted rows');
    const columnContiguous = sampleFor(samples, 'column write, per-group buffers, 10k contiguous rows');
    const sharedScattered = sampleFor(samples, 'column write, one shared buffer, 10k scattered rows');
    const perInstanceAll = sampleFor(samples, 'setColor per instance, all 456,598 rows');
    const columnAll = sampleFor(samples, 'column write, per-group buffers, all rows');

    const wholeStore = sampleFor(samples, 'one pass over the shared colour store, no row indirection');

    // For a subset the bulk path is never slower than the per-instance path.
    expect(columnScattered.medianMs).toBeLessThanOrEqual(perInstance.medianMs);
    // For the whole model the row indirection, not the method call, is the cost:
    // a straight pass over one array wins, a row-indexed pass does not.
    expect(wholeStore.medianMs).toBeLessThan(perInstanceAll.medianMs);
    expect(wholeStore.medianMs).toBeLessThan(columnAll.medianMs);
    // Visiting rows in buffer order is not slower than visiting them at random.
    expect(columnSorted.medianMs).toBeLessThanOrEqual(columnScattered.medianMs * 1.2);
    expect(columnContiguous.medianMs).toBeLessThanOrEqual(columnScattered.medianMs * 1.2);
    // One allocation for the whole model beats thousands of small ones.
    expect(sharedScattered.medianMs).toBeLessThanOrEqual(columnScattered.medianMs * 1.2);
    // Every case did the work it claims to.
    expect(columnScattered.result).toBe(10_000);
    expect(columnAll.result).toBe(scene.rowCount);
  });

  it('pays for publishing the change once per group, which the model shape makes expensive', () => {
    const dirty = new DirtyRanges(perGroup.groupCount);
    const touched = new Set<number>();
    for (const row of scattered) touched.add(perGroup.groupOf[row] ?? -1);

    const samples: Sample[] = [
      measureCase({
        label: 'column write only, 10k sorted rows',
        setup: nextColor,
        body: (color) => writeRows(perGroup, 'color', sorted, color, null, false),
      }),
      measureCase({
        label: 'column write and collect dirty ranges, 10k sorted rows',
        setup: () => { dirty.reset(); return nextColor(); },
        body: (color) => writeRows(perGroup, 'color', sorted, color, dirty, false),
      }),
      measureCase({
        label: 'column write then one setColor per touched group, 10k sorted rows',
        setup: nextColor,
        body: (color) => {
          const written = writeRows(perGroup, 'color', sorted, color, null, false);
          for (const group of touched) {
            const instance = scene.groups[group];
            if (!instance) throw new Error('missing group');
            instance.setColor(0, color[0] ?? 0, color[1] ?? 0, color[2] ?? 0, 1);
          }
          return written;
        },
      }),
    ];
    reportSamples(
      `publishing the change: ${touched.size} groups hold the 10,000 changed instances`, samples);

    const write = sampleFor(samples, 'column write only, 10k sorted rows');
    const withRanges = sampleFor(samples, 'column write and collect dirty ranges, 10k sorted rows');
    const withVersions = sampleFor(samples, 'column write then one setColor per touched group, 10k sorted rows');

    // Under three instances per group, "one publish per touched group" is nearly
    // "one publish per instance", so it costs more than the write it publishes.
    expect(touched.size).toBeGreaterThan(scattered.length / 2);
    expect(withVersions.medianMs).toBeGreaterThan(write.medianMs);
    // Recording ranges instead is cheap enough to leave on.
    expect(withRanges.medianMs).toBeLessThan(withVersions.medianMs);
    expect(dirty.touchedGroups).toBe(touched.size);
  });

  it('advances the scene revision once per instance on the per-instance path, never on the bulk path', () => {
    const viewerScene = new ViewerScene();
    for (const group of scene.groups) viewerScene.addGroup(group);
    const start = viewerScene.version;
    setColorPerInstance(scattered, Float32Array.of(0.11, 0.22, 0.33, 1));
    const afterPerInstance = viewerScene.version;
    writeRows(perGroup, 'color', scattered, Float32Array.of(0.44, 0.55, 0.66, 1), null, false);
    expect(afterPerInstance - start).toBe(10_000);
    expect(viewerScene.version).toBe(afterPerInstance);
  });
});
