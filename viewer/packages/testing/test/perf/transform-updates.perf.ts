/**
 * Question: what does moving a large number of instances cost, and what does
 * keeping the model's bounds correct add to it?
 *
 * CPU-side only: no WebGL context, so no upload or draw cost is included.
 *
 * Every table below reports medians. Every assertion compares the fastest of the
 * repetitions instead, because this machine is shared with other work:
 * interference can only ever make a run slower, so the minimum is the estimate
 * that survives a busy machine. Medians of two close cases swapped places under
 * load; minimums did not.
 */
import { describe, expect, it } from 'vitest';
import { ViewerScene, sceneBounds } from '@ara3d/viewer-core';
import {
  BOX_NUMBERS, allGroups, emptyBoxes, groupsOfRows, localBoxes, recomputeGroupBoxes, unionBoxes,
} from '../../src/perf/bounds.js';
import {
  copyRows, createInstanceColumns, createSharedColumns, writeRows, writeTranslations,
} from '../../src/perf/columns.js';
import { measureAll, prepare, reportSamples, sampleFor } from '../../src/perf/measure.js';
import { distinctIntegers } from '../../src/perf/prng.js';
import { TRANSFORM_FLOATS, contiguousRows, createSyntheticScene, referenceShape, sortRows } from '../../src/perf/scene.js';

const scene = createSyntheticScene(referenceShape);
const perGroup = createInstanceColumns(scene.groups);
const shared = createSharedColumns(scene.groups);
const scattered = distinctIntegers(10_000, scene.rowCount, 9);
const sorted = sortRows(scattered);
const allRows = contiguousRows(scene.rowCount);
const changedGroups = groupsOfRows(perGroup.groupOf, scattered);

/** A different position each repetition, so no write is skipped as unchanged. */
let step = 0;
const nextOffset = (): number => {
  step = (step + 1) % 64;
  return step * 0.25;
};

const nextMatrix = (): Float32Array => {
  const offset = nextOffset();
  const matrix = new Float32Array(TRANSFORM_FLOATS);
  matrix[0] = 1; matrix[5] = 1; matrix[10] = 1; matrix[15] = 1;
  matrix[12] = offset; matrix[13] = offset + 1; matrix[14] = offset + 2;
  return matrix;
};

const nextTranslation = (): Float32Array => {
  const offset = nextOffset();
  return Float32Array.of(offset, offset + 1, offset + 2);
};

const matrixPerRow = (rows: Int32Array): Float32Array => {
  const values = new Float32Array(rows.length * TRANSFORM_FLOATS);
  for (let k = 0; k < rows.length; k++) {
    const at = k * TRANSFORM_FLOATS;
    values[at] = 1; values[at + 5] = 1; values[at + 10] = 1; values[at + 15] = 1;
    values[at + 12] = k % 251;
  }
  return values;
};

/** The alpha path: one method call per instance, each bumping the group's version. */
function setTransformPerInstance(rows: Int32Array, matrix: Float32Array): number {
  for (let k = 0; k < rows.length; k++) {
    const row = rows[k] ?? 0;
    const group = scene.groups[scene.groupOf[row] ?? 0];
    if (!group) throw new Error('missing group');
    group.setTransform(scene.indexInGroup[row] ?? 0, matrix);
  }
  return rows.length;
}

describe('bulk transform updates', () => {
  it('costs what the touched floats cost, so a translation beats a whole matrix', () => {
    const samples = measureAll([
      prepare({
        label: 'setTransform per instance, 10k scattered rows',
        setup: nextMatrix,
        body: (matrix) => setTransformPerInstance(scattered, matrix),
      }),
      prepare({
        label: 'column write, per-group buffers, 10k scattered rows',
        setup: nextMatrix,
        body: (matrix) => writeRows(perGroup, 'transform', scattered, matrix, null, false),
      }),
      prepare({
        label: 'column write, one shared buffer, 10k scattered rows',
        setup: nextMatrix,
        body: (matrix) => writeRows(shared, 'transform', scattered, matrix, null, false),
      }),
      prepare({
        label: 'column write, one shared buffer, 10k sorted rows',
        setup: nextMatrix,
        body: (matrix) => writeRows(shared, 'transform', sorted, matrix, null, false),
      }),
      prepare({
        label: 'column copy with set(), one shared buffer, 10k sorted rows',
        setup: nextMatrix,
        body: (matrix) => copyRows(shared, 'transform', sorted, matrix, null),
      }),
      prepare({
        label: 'column write, one shared buffer, 10k rows, matrix per row',
        setup: () => matrixPerRow(sorted),
        body: (values) => writeRows(shared, 'transform', sorted, values, null, false),
      }),
      prepare({
        label: 'column copy with set(), one shared buffer, 10k rows, matrix per row',
        setup: () => matrixPerRow(sorted),
        body: (values) => copyRows(shared, 'transform', sorted, values, null),
      }),
      prepare({
        label: 'translation only, one shared buffer, 10k sorted rows',
        setup: nextTranslation,
        body: (values) => writeTranslations(shared, sorted, values, null, false),
      }),
      prepare({
        label: 'setTransform per instance, all 456,598 rows',
        setup: nextMatrix,
        body: (matrix) => setTransformPerInstance(allRows, matrix),
      }),
      prepare({
        label: 'column write, one shared buffer, all rows',
        setup: nextMatrix,
        body: (matrix) => writeRows(shared, 'transform', allRows, matrix, null, false),
      }),
      prepare({
        label: 'column copy with set(), one shared buffer, all rows',
        setup: nextMatrix,
        body: (matrix) => copyRows(shared, 'transform', allRows, matrix, null),
      }),
      prepare({
        label: 'translation only, one shared buffer, all rows',
        setup: nextTranslation,
        body: (values) => writeTranslations(shared, allRows, values, null, false),
      }),
      prepare({
        label: 'one pass over the shared transform store, no row indirection',
        setup: nextMatrix,
        body: (matrix) => {
          const store = shared.transformStore;
          for (let offset = 0; offset < store.length; offset += TRANSFORM_FLOATS) store.set(matrix, offset);
          return store.length / TRANSFORM_FLOATS;
        },
      }),
    ]);
    reportSamples(`transform writes over ${scene.rowCount} instances in ${scene.groups.length} groups`, samples);

    const perInstance = sampleFor(samples, 'setTransform per instance, 10k scattered rows');
    const column = sampleFor(samples, 'column write, per-group buffers, 10k scattered rows');
    const sharedScattered = sampleFor(samples, 'column write, one shared buffer, 10k scattered rows');
    const sharedSorted = sampleFor(samples, 'column write, one shared buffer, 10k sorted rows');
    const translation = sampleFor(samples, 'translation only, one shared buffer, 10k sorted rows');
    const perRow = sampleFor(samples, 'column write, one shared buffer, 10k rows, matrix per row');
    const copySorted = sampleFor(samples, 'column copy with set(), one shared buffer, 10k sorted rows');
    const copyPerRow = sampleFor(samples, 'column copy with set(), one shared buffer, 10k rows, matrix per row');
    const perInstanceAll = sampleFor(samples, 'setTransform per instance, all 456,598 rows');
    const columnAll = sampleFor(samples, 'column write, one shared buffer, all rows');
    const copyAll = sampleFor(samples, 'column copy with set(), one shared buffer, all rows');
    const translationAll = sampleFor(samples, 'translation only, one shared buffer, all rows');
    const wholeStore = sampleFor(samples, 'one pass over the shared transform store, no row indirection');

    // Only relationships with a stable margin are asserted. Among the 10,000-row
    // cases the differences between the column variants are smaller than the
    // run-to-run spread, because at that size the cost is finding each row's
    // buffer among 158,055 of them rather than the floats written into it. Those
    // rows are reported and compared in the findings document, not asserted.
    expect(copySorted.minMs).toBeLessThan(perInstance.minMs);
    expect(perRow.minMs).toBeLessThan(perInstance.minMs);
    expect(sharedSorted.minMs).toBeLessThanOrEqual(sharedScattered.minMs * 1.2);

    // Over the whole model the floats dominate and the relationships hold.
    // Copying each row beats assigning it float by float, and both beat the
    // per-instance calls; writing 3 floats beats writing 16; and dropping the row
    // index altogether beats every indexed path.
    expect(copyAll.minMs).toBeLessThan(perInstanceAll.minMs);
    expect(copyAll.minMs).toBeLessThan(columnAll.minMs);
    expect(translationAll.minMs).toBeLessThan(columnAll.minMs);
    expect(wholeStore.minMs).toBeLessThan(perInstanceAll.minMs);

    // Every case did the work it claims to.
    expect(column.result).toBe(scattered.length);
    expect(copyPerRow.result).toBe(sorted.length);
    expect(translation.result).toBe(sorted.length);
    expect(columnAll.result).toBe(scene.rowCount);
    expect(copyAll.result).toBe(scene.rowCount);
    expect(translationAll.result).toBe(scene.rowCount);
  });

  it('costs more to keep the bounds correct than to move the instances', () => {
    const viewerScene = new ViewerScene();
    for (const group of scene.groups) viewerScene.addGroup(group);
    const local = localBoxes(scene.groups);
    const every = allGroups(scene.groups.length);
    const world = emptyBoxes(scene.groups.length);
    recomputeGroupBoxes(world, local, scene.groups, every);
    const union = new Float64Array(BOX_NUMBERS);

    const samples = measureAll([
      prepare({
        label: 'alpha sceneBounds, whole model',
        setup: () => viewerScene,
        body: (model) => {
          const bounds = sceneBounds(model);
          if (!bounds) throw new Error('the scene is not empty');
          return bounds.max[0] - bounds.min[0];
        },
      }),
      prepare({
        label: 'columnar recompute of every group, local mesh boxes included',
        setup: () => every,
        body: (groups) => {
          const boxes = localBoxes(scene.groups);
          recomputeGroupBoxes(world, boxes, scene.groups, groups);
          return unionBoxes(world, union);
        },
      }),
      prepare({
        label: 'columnar recompute of every group, local mesh boxes cached',
        setup: () => every,
        body: (groups) => {
          recomputeGroupBoxes(world, local, scene.groups, groups);
          return unionBoxes(world, union);
        },
      }),
      prepare({
        label: `columnar recompute of the ${changedGroups.length} changed groups, then union all`,
        setup: () => changedGroups,
        body: (groups) => {
          recomputeGroupBoxes(world, local, scene.groups, groups);
          return unionBoxes(world, union);
        },
      }),
      prepare({
        label: 'union of the cached group boxes only',
        setup: () => world,
        body: (boxes) => unionBoxes(boxes, union),
      }),
      prepare({
        label: 'the 10k-row transform write the bounds work follows',
        setup: nextMatrix,
        body: (matrix) => writeRows(shared, 'transform', sorted, matrix, null, false),
      }),
      // Fifteen repetitions, not the default twenty-five: the slowest case here
      // takes about 80 ms. Nine was tried; on a machine running other work it
      // was not enough for the fastest run of each case to land in a quiet slot.
    ], { repetitions: 15, warmups: 2 });
    reportSamples(`bounds over ${scene.rowCount} instances in ${scene.groups.length} groups`, samples);

    const alpha = sampleFor(samples, 'alpha sceneBounds, whole model');
    const withLocal = sampleFor(samples, 'columnar recompute of every group, local mesh boxes included');
    const cached = sampleFor(samples, 'columnar recompute of every group, local mesh boxes cached');
    const partial = sampleFor(samples, `columnar recompute of the ${changedGroups.length} changed groups, then union all`);
    const unionOnly = sampleFor(samples, 'union of the cached group boxes only');
    const write = sampleFor(samples, 'the 10k-row transform write the bounds work follows');

    // The columnar recompute beats the alpha's. The two columnar variants differ
    // by about a fifth, which is too little to assert on a shared machine; the
    // table shows which part of the saving is the allocations and which is the
    // cached local boxes.
    expect(cached.minMs).toBeLessThan(alpha.minMs);
    expect(withLocal.result).toBe(scene.groups.length);
    // Recomputing only what changed beats recomputing everything, but cannot go
    // below the union of every group's cached box.
    expect(partial.minMs).toBeLessThan(cached.minMs);
    expect(unionOnly.minMs).toBeLessThan(partial.minMs);
    // Even the cheapest correct bounds update costs more than the write itself.
    expect(partial.minMs).toBeGreaterThan(write.minMs);
    expect(unionOnly.result).toBe(scene.groups.length);
  });
});
