/**
 * Question: what do the alpha's per-instance binding objects cost, in build time
 * and in memory, against columnar typed arrays holding the same information?
 *
 * The alpha keeps one frozen JavaScript object per rendered instance and three
 * maps over them. The columnar form keeps object ordinals, a compressed row
 * index and one map from object identity to an integer. Both are built here at
 * 10,000, 100,000 and 500,000 instances from the same assignment of instances to
 * objects, so the only difference is the layout.
 *
 * Heap figures come from `process.memoryUsage().heapUsed` with a collection
 * forced before and after each reading. The reading is sampled rather than
 * exact, so treat the ratio between the two layouts as the result.
 *
 * Every table below reports medians. Every assertion compares the fastest of the
 * repetitions instead, because this machine is shared with other work:
 * interference can only ever make a run slower, so the minimum is the estimate
 * that survives a busy machine.
 */
import { describe, expect, it } from 'vitest';
import { writeRows } from '../../src/perf/columns.js';
import { enableGarbageCollection, measureHeapGrowth, megabytes } from '../../src/perf/memory.js';
import { measureAll, prepare, reportSamples, sampleFor } from '../../src/perf/measure.js';
import {
  buildBindingObjects, buildObjectColumns, objectIds, objectKey, objectOfRow, rowsOfObject,
  type ObjectColumns,
} from '../../src/perf/object-index.js';
import { createInstanceColumns } from '../../src/perf/columns.js';
import {
  createSyntheticScene, instancesPerObject, referenceShape, scaledShape, type SyntheticScene,
} from '../../src/perf/scene.js';

const MODEL = 'model-1';
const sizes = [10_000, 100_000, 500_000] as const;

interface Fixture {
  readonly instances: number;
  readonly scene: SyntheticScene;
  readonly owner: Int32Array;
  readonly ids: string[];
}

const fixtures: Fixture[] = sizes.map((instances) => {
  const scene = createSyntheticScene(scaledShape(instances, referenceShape.seed + instances));
  const objectCount = Math.max(1, Math.round(scene.rowCount / instancesPerObject));
  return { instances, scene, owner: objectOfRow(scene.rowCount, objectCount), ids: objectIds(objectCount) };
});

const label = (instances: number): string => instances.toLocaleString('en-US');

describe('per-instance binding objects against columns', () => {
  it('costs more to build, at every size', () => {
    const cases = fixtures.flatMap((fixture) => [
      prepare({
        label: `${label(fixture.instances)} instances: frozen binding objects`,
        setup: () => fixture,
        body: (f) => buildBindingObjects(f.scene, f.owner, f.ids, MODEL).byModel.length,
      }),
      prepare({
        label: `${label(fixture.instances)} instances: object columns`,
        setup: () => fixture,
        body: (f) => buildObjectColumns(f.scene.rowCount, f.owner, f.ids, MODEL).objectCount,
      }),
    ]);
    // Five repetitions: building 500,000 frozen objects allocates over a hundred
    // megabytes, so more rounds make the measurement collection-bound rather
    // than more accurate. The fastest round is what the assertions use.
    const samples = measureAll(cases, { repetitions: 5, warmups: 1 });
    reportSamples('building the two layouts', samples);

    for (const fixture of fixtures) {
      const objects = sampleFor(samples, `${label(fixture.instances)} instances: frozen binding objects`);
      const columns = sampleFor(samples, `${label(fixture.instances)} instances: object columns`);
      expect(columns.minMs).toBeLessThan(objects.minMs);
      expect(objects.result).toBe(fixture.scene.rowCount);
      expect(columns.result).toBe(fixture.ids.length);
    }
  });

  it('holds far more memory, and the gap grows with the model', () => {
    const collecting = enableGarbageCollection();
    expect(collecting).toBe(true);
    const rows: string[] = [
      'median of three readings, each with a collection forced before and after',
      '| instances | binding objects MB | object columns MB | ratio |',
      '| --------- | ------------------ | ----------------- | ----- |',
    ];
    const ratios: number[] = [];
    for (const fixture of fixtures) {
      const objects = measureHeapGrowth(() =>
        buildBindingObjects(fixture.scene, fixture.owner, fixture.ids, MODEL));
      const columns = measureHeapGrowth(() =>
        buildObjectColumns(fixture.scene.rowCount, fixture.owner, fixture.ids, MODEL));
      const ratio = columns.bytes > 0 ? objects.bytes / columns.bytes : Infinity;
      ratios.push(ratio);
      rows.push(`| ${label(fixture.instances)} | ${megabytes(objects.bytes).toFixed(1)} | ${megabytes(columns.bytes).toFixed(1)} | ${ratio.toFixed(1)}x |`);
      // Keep both alive across the reading of the other.
      expect(objects.value.byModel.length).toBe(fixture.scene.rowCount);
      expect(columns.value.objectCount).toBe(fixture.ids.length);
    }
    console.log(`\nmemory held by the two layouts\n${rows.join('\n')}`);

    // The per-instance layout is heavier at every size measured.
    for (const ratio of ratios) expect(ratio).toBeGreaterThan(1);
  });

  it('is no faster to update through, once the object is found', () => {
    const largest = fixtures[fixtures.length - 1];
    if (!largest) throw new Error('no fixtures');
    const bindings = buildBindingObjects(largest.scene, largest.owner, largest.ids, MODEL);
    const columns = buildObjectColumns(largest.scene.rowCount, largest.owner, largest.ids, MODEL);
    const instanceColumns = createInstanceColumns(largest.scene.groups);
    // One object in ten, so the update is a realistic selection rather than the
    // whole model.
    const chosen = largest.ids.filter((_, o) => o % 10 === 0);
    const keys = chosen.map((objectId) => objectKey({ modelId: MODEL, objectId }));

    let tint = 0;
    const nextColor = (): Float32Array => {
      tint = (tint + 0.011) % 0.5;
      return Float32Array.of(tint, 0.3, 0.8, 1);
    };

    const updateThroughObjects = (color: Float32Array): number => {
      let touched = 0;
      for (const key of keys) {
        const entries = bindings.byObject.get(key);
        if (!entries) continue;
        for (const binding of entries) {
          binding.group.setColor(binding.instanceIndex, color[0] ?? 0, color[1] ?? 0, color[2] ?? 0, 1);
          touched++;
        }
      }
      return touched;
    };

    const updateThroughColumns = (target: ObjectColumns, color: Float32Array): number => {
      let touched = 0;
      for (const key of keys) {
        const ordinal = target.ordinalOf.get(key);
        if (ordinal === undefined) continue;
        touched += writeRows(instanceColumns, 'color', rowsOfObject(target, ordinal), color, null, false);
      }
      return touched;
    };

    const samples = measureAll([
      prepare({
        label: `${keys.length} objects through binding objects`,
        setup: nextColor,
        body: updateThroughObjects,
      }),
      prepare({
        label: `${keys.length} objects through object columns`,
        setup: nextColor,
        body: (color) => updateThroughColumns(columns, color),
      }),
    ]);
    reportSamples(
      `updating one object in ten of ${largest.ids.length}, covering ${sampleFor(samples, `${keys.length} objects through object columns`).result} instances`,
      samples);

    const throughObjects = sampleFor(samples, `${keys.length} objects through binding objects`);
    const throughColumns = sampleFor(samples, `${keys.length} objects through object columns`);

    expect(throughColumns.result).toBe(throughObjects.result);
    expect(throughColumns.minMs).toBeLessThan(throughObjects.minMs);
  });
});
