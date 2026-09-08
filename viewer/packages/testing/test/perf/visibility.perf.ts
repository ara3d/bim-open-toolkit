/**
 * Question: what is the cheapest way to hide and restore a large set of
 * instances — writing an alpha of zero, collapsing the transform, compacting
 * the drawn range, or rebuilding the renderer's batches?
 *
 * CPU-side only: no WebGL context, so no upload or draw cost is included.
 */
import { describe, expect, it } from 'vitest';
import { SceneObject, ViewerScene } from '@ara3d/viewer-core';
import { createSharedColumns, writeChannel } from '../../src/perf/columns.js';
import { measureCase, reportSamples, sampleFor, type Sample } from '../../src/perf/measure.js';
import { COLOR_FLOATS, TRANSFORM_FLOATS, createSyntheticScene, referenceShape, selectRows, sortRows } from '../../src/perf/scene.js';

const scene = createSyntheticScene(referenceShape);
const columns = createSharedColumns(scene.groups);
const fractions: readonly number[] = [0.01, 0.1, 0.5];
const hiddenRows = new Map<number, Int32Array>(fractions.map((fraction) =>
  [fraction, sortRows(selectRows(scene.rowCount, fraction, 21))]));

const rowsFor = (fraction: number): Int32Array => {
  const rows = hiddenRows.get(fraction);
  if (!rows) throw new Error(`no rows for ${fraction}`);
  return rows;
};

const percent = (fraction: number): string => `${(fraction * 100).toFixed(0)}%`;

/** Hides by zeroing the diagonal of the instance transform. */
function collapseTransforms(rows: Int32Array, scale: number): number {
  const store = columns.transformStore;
  for (let k = 0; k < rows.length; k++) {
    const offset = (rows[k] ?? 0) * TRANSFORM_FLOATS;
    store[offset] = scale;
    store[offset + 5] = scale;
    store[offset + 10] = scale;
  }
  return rows.length;
}

/** Rebuilds the list of rows that are still drawn, in row order. */
function compactDrawOrder(hidden: Uint8Array, order: Int32Array): number {
  let head = 0;
  for (let row = 0; row < hidden.length; row++) if (hidden[row] === 0) order[head++] = row;
  return head;
}

/** Moves the surviving rows' colours and transforms to the front of new stores. */
function compactStores(hidden: Uint8Array, colors: Float32Array, transforms: Float32Array): number {
  let head = 0;
  for (let row = 0; row < hidden.length; row++) {
    if (hidden[row] !== 0) continue;
    colors.set(columns.colorStore.subarray(row * COLOR_FLOATS, (row + 1) * COLOR_FLOATS), head * COLOR_FLOATS);
    transforms.set(
      columns.transformStore.subarray(row * TRANSFORM_FLOATS, (row + 1) * TRANSFORM_FLOATS),
      head * TRANSFORM_FLOATS);
    head++;
  }
  return head;
}

const hiddenFlags = (rows: Int32Array): Uint8Array => {
  const flags = new Uint8Array(scene.rowCount);
  for (const row of rows) flags[row] = 1;
  return flags;
};

describe('hiding and restoring instances', () => {
  it('costs the same order as the number of hidden rows, whichever column carries the flag', () => {
    const samples: Sample[] = [];
    for (const fraction of fractions) {
      const rows = rowsFor(fraction);
      samples.push(measureCase({
        label: `hide ${percent(fraction)} by writing alpha 0 (${rows.length} rows)`,
        setup: () => writeChannel(columns, 'color', 3, 1, rows, null, false),
        body: () => writeChannel(columns, 'color', 3, 0, rows, null, false),
      }));
      samples.push(measureCase({
        label: `restore ${percent(fraction)} by writing alpha 1`,
        setup: () => writeChannel(columns, 'color', 3, 0, rows, null, false),
        body: () => writeChannel(columns, 'color', 3, 1, rows, null, false),
      }));
      samples.push(measureCase({
        label: `hide ${percent(fraction)} by collapsing the transform`,
        setup: () => collapseTransforms(rows, 1),
        body: () => collapseTransforms(rows, 0),
      }));
    }
    reportSamples(`hiding ${scene.rowCount} instances in ${scene.groups.length} groups`, samples);

    const hide1 = sampleFor(samples, `hide 1% by writing alpha 0 (${rowsFor(0.01).length} rows)`);
    const hide10 = sampleFor(samples, `hide 10% by writing alpha 0 (${rowsFor(0.1).length} rows)`);
    const hide50 = sampleFor(samples, `hide 50% by writing alpha 0 (${rowsFor(0.5).length} rows)`);
    const restore10 = sampleFor(samples, 'restore 10% by writing alpha 1');

    expect(hide1.medianMs).toBeLessThan(hide10.medianMs);
    expect(hide10.medianMs).toBeLessThan(hide50.medianMs);
    // Hiding and restoring are the same write, so they cost the same.
    expect(restore10.medianMs).toBeLessThan(hide10.medianMs * 2);
    // Nothing here approaches the size of the model: even hiding half is a
    // sub-model-size pass, unlike the rebuild measured below.
    expect(hide50.result).toBe(rowsFor(0.5).length);
  });

  it('is far cheaper than moving instance data or rebuilding the renderer batches', () => {
    const order = new Int32Array(scene.rowCount);
    const spareColors = new Float32Array(scene.rowCount * COLOR_FLOATS);
    const spareTransforms = new Float32Array(scene.rowCount * TRANSFORM_FLOATS);
    const samples: Sample[] = [];
    for (const fraction of fractions) {
      const flags = hiddenFlags(rowsFor(fraction));
      samples.push(measureCase({
        label: `rebuild the draw order with ${percent(fraction)} hidden`,
        setup: () => flags,
        body: (hidden) => compactDrawOrder(hidden, order),
      }));
    }
    const flags10 = hiddenFlags(rowsFor(0.1));
    samples.push(measureCase({
      label: 'physically compact colours and transforms with 10% hidden',
      setup: () => flags10,
      body: (hidden) => compactStores(hidden, spareColors, spareTransforms),
    }));

    const viewerScene = new ViewerScene();
    for (const group of scene.groups) viewerScene.addGroup(group);
    let mirror: SceneObject | undefined;
    samples.push(measureCase({
      label: 'rebuild the three.js batches for the whole model',
      setup: () => { mirror?.dispose(); mirror = undefined; return viewerScene; },
      body: (model) => {
        const built = new SceneObject(model, 1000, false);
        built.sync();
        mirror = built;
        return built.objectCount;
      },
    }, { repetitions: 5, warmups: 1 }));
    mirror?.dispose();

    reportSamples('hiding strategies that move or rebuild data', samples);

    const drawOrder10 = sampleFor(samples, 'rebuild the draw order with 10% hidden');
    const physical10 = sampleFor(samples, 'physically compact colours and transforms with 10% hidden');
    const rebuild = sampleFor(samples, 'rebuild the three.js batches for the whole model');

    expect(drawOrder10.medianMs).toBeLessThan(physical10.medianMs);
    expect(physical10.medianMs).toBeLessThan(rebuild.medianMs);
    expect(rebuild.result).toBe(scene.groups.length);
  });

  it('keeps the alpha write two orders of magnitude below a batch rebuild', () => {
    const rows = rowsFor(0.5);
    const hide = measureCase({
      label: 'hide 50% by writing alpha 0',
      setup: () => writeChannel(columns, 'color', 3, 1, rows, null, false),
      body: () => writeChannel(columns, 'color', 3, 0, rows, null, false),
    });
    const viewerScene = new ViewerScene();
    for (const group of scene.groups) viewerScene.addGroup(group);
    let mirror: SceneObject | undefined;
    const rebuild = measureCase({
      label: 'rebuild the three.js batches',
      setup: () => { mirror?.dispose(); mirror = undefined; return viewerScene; },
      body: (model) => {
        const built = new SceneObject(model, 1000, false);
        built.sync();
        mirror = built;
        return built.objectCount;
      },
    }, { repetitions: 5, warmups: 1 });
    mirror?.dispose();
    reportSamples('hiding half the model against rebuilding it', [hide, rebuild]);
    expect(hide.medianMs * 100).toBeLessThan(rebuild.medianMs);
  });
});
