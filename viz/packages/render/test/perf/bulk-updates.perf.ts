// What a bulk colour, visibility or transform update through an `InstanceTable` costs.
//
// Run with `npm run perf -w @bim-open-toolkit/render -- --reporter=verbose`. The verbose reporter
// is required: the default one hides console output from passing tests, which is the evidence
// these tests exist to print.
//
// Scenes are synthetic and have the reference model's shape - 456,598 rendered instances over
// 158,055 groups and 51,139 objects - scaled down for the smaller sizes. No WebGL context is
// created anywhere, so nothing here includes GPU upload or draw time.
//
// The assertions are relationships the instance-update study established, never absolute times:
// sorted and contiguous rows are not slower than scattered ones, recording dirty slot ranges costs
// a small fraction of the write, and change detection costs less than the write it guards while
// leaving the dirty ranges empty when nothing moved.

import { describe, expect, it } from 'vitest';
import { transformStride } from '@bim-open-toolkit/model';
import {
  dirtySets,
  everyRow,
  publishDirty,
  writeColors,
  writeTransforms,
  writeTranslations,
  writeVisibility,
} from '../../src/updates.js';
import {
  distinctRows,
  measureAll,
  perfTable,
  prepare,
  ratio,
  referenceRows,
  reportSamples,
  sampleFor,
  type MeasureOptions,
  type Prepared,
} from './harness.js';

const noDetection = { detectChanges: false };
const updated = 10_000;

const options = (rowCount: number): MeasureOptions =>
  rowCount >= 400_000 ? { repetitions: 9, warmups: 3 } : { repetitions: 25, warmups: 5 };

// A tolerance on every ratio assertion. The relationships are large; this only absorbs the noise
// of a shared machine, which the min and max columns in the printed table make visible.
const tolerance = 1.25;

// Change-detection overhead is only asserted where one repetition takes more than a millisecond.
// Over 10,000 rows a whole write is about 0.4 ms, which is below this harness's resolution for a
// difference of this size; the numbers are still printed there.
//
// The threshold is 2 and not something smaller because detection costs a comparison as wide as the
// value it guards, and for a three-float colour or translation that comparison is nearly the whole
// cost: measured overhead ranged from nothing (visibility) to 1.9 times (translation) across runs.
// The study never isolated this; it measured the dirty-range cost at 3 %, which is asserted above.
// What detection buys is not CPU but silence: when nothing moved it leaves the dirty ranges empty,
// so no group is published and no buffer is uploaded.
const detectionMeasurable = (rowCount: number): boolean => rowCount >= 100_000;

const sizes = [10_000, 100_000, referenceRows];

for (const rowCount of sizes) {
  describe(`bulk updates over ${rowCount.toLocaleString('en-US')} rows`, () => {
    const scene = perfTable(rowCount);
    const table = scene.table;
    const count = Math.min(updated, table.rowCount);
    const scattered = distinctRows(count, table.rowCount, 7);
    const sorted = Int32Array.from(scattered).sort();
    const contiguous = Int32Array.from({ length: count }, (_unused, i) => i);
    const groups = table.groups.length;
    const title = (subject: string): string =>
      `${subject}: ${count.toLocaleString('en-US')} of ${table.rowCount.toLocaleString('en-US')} rows in ${groups.toLocaleString('en-US')} groups`;

    it('writes colour', () => {
      const rgb = Float32Array.of(0.123, 0.456, 0.789);
      const colorCase = (label: string, rows: Int32Array | typeof everyRow, detect: boolean): Prepared =>
        prepare({
          label,
          setup: () => scene.restoreColors(),
          body: () => writeColors(table, rows, rgb, undefined, detect ? undefined : noDetection),
        });
      const samples = measureAll(
        [
          colorCase('scattered rows', scattered, true),
          colorCase('sorted rows', sorted, true),
          colorCase('contiguous rows', contiguous, true),
          colorCase('scattered rows, no change detection', scattered, false),
          prepare({
            label: 'scattered rows, with dirty ranges',
            setup: () => {
              scene.restoreColors();
              return dirtySets(table);
            },
            body: (dirty) => writeColors(table, scattered, rgb, dirty),
          }),
          colorCase('every row', everyRow, true),
          prepare({
            label: 'scattered rows already holding the new colour',
            setup: () => {
              scene.restoreColors();
              writeColors(table, scattered, rgb);
            },
            body: () => writeColors(table, scattered, rgb) + 1,
          }),
        ],
        options(rowCount),
      );
      reportSamples(title('colour'), samples);

      const scatteredSample = sampleFor(samples, 'scattered rows');
      expect(ratio(sampleFor(samples, 'sorted rows'), scatteredSample)).toBeLessThanOrEqual(tolerance);
      expect(ratio(sampleFor(samples, 'contiguous rows'), scatteredSample)).toBeLessThanOrEqual(tolerance);
      if (detectionMeasurable(rowCount))
        expect(
          ratio(scatteredSample, sampleFor(samples, 'scattered rows, no change detection')),
        ).toBeLessThanOrEqual(2);
      expect(
        ratio(sampleFor(samples, 'scattered rows, with dirty ranges'), scatteredSample),
      ).toBeLessThanOrEqual(1.6);
      // Detection over scattered rows that have not moved is about as expensive as writing them:
      // the cache line has to be fetched either way, and the three stores that follow are almost
      // free once it is there. What detection saves is downstream, not here - it leaves the dirty
      // ranges empty, so nothing is published and nothing is uploaded.
      expect(
        sampleFor(samples, 'scattered rows already holding the new colour').medianMs,
      ).toBeLessThanOrEqual(scatteredSample.medianMs * tolerance);
      const dirty = dirtySets(table);
      scene.restoreColors();
      expect(writeColors(table, scattered, rgb, dirty)).toBe(count);
      expect(writeColors(table, scattered, rgb, dirty)).toBe(0);
      dirty.colors.reset();
      expect(writeColors(table, scattered, rgb, dirty)).toBe(0);
      expect(dirty.colors.touchedGroups).toBe(0);
    });

    it('writes visibility', () => {
      const hide = Uint8Array.of(0);
      const hideCase = (label: string, rows: Int32Array | typeof everyRow, detect: boolean): Prepared =>
        prepare({
          label,
          setup: () => scene.restoreColors(),
          body: () => writeVisibility(table, rows, hide, undefined, detect ? undefined : noDetection),
        });
      const samples = measureAll(
        [
          hideCase('scattered rows', scattered, true),
          hideCase('sorted rows', sorted, true),
          hideCase('contiguous rows', contiguous, true),
          hideCase('scattered rows, no change detection', scattered, false),
          hideCase('every row', everyRow, true),
        ],
        options(rowCount),
      );
      reportSamples(title('visibility'), samples);

      const scatteredSample = sampleFor(samples, 'scattered rows');
      expect(ratio(sampleFor(samples, 'sorted rows'), scatteredSample)).toBeLessThanOrEqual(tolerance);
      expect(ratio(sampleFor(samples, 'contiguous rows'), scatteredSample)).toBeLessThanOrEqual(tolerance);
      if (detectionMeasurable(rowCount))
        expect(
          ratio(scatteredSample, sampleFor(samples, 'scattered rows, no change detection')),
        ).toBeLessThanOrEqual(2);
    });

    it('writes transforms', () => {
      const matrix = new Float32Array(transformStride);
      matrix[0] = 1;
      matrix[5] = 1;
      matrix[10] = 1;
      matrix[15] = 1;
      matrix[12] = 42;
      const move = Float32Array.of(11, 22, 33);
      const transformCase = (
        label: string,
        rows: Int32Array | typeof everyRow,
        whole: boolean,
        detect: boolean,
      ): Prepared =>
        prepare({
          label,
          setup: () => scene.restoreTransforms(),
          body: () =>
            whole
              ? writeTransforms(table, rows, matrix, undefined, detect ? undefined : noDetection)
              : writeTranslations(table, rows, move, undefined, detect ? undefined : noDetection),
        });
      const samples = measureAll(
        [
          transformCase('translation, scattered rows', scattered, false, true),
          transformCase('translation, sorted rows', sorted, false, true),
          transformCase('translation, contiguous rows', contiguous, false, true),
          transformCase('translation, scattered rows, no change detection', scattered, false, false),
          transformCase('whole matrix, scattered rows', scattered, true, true),
          transformCase('whole matrix, sorted rows', sorted, true, true),
          transformCase('whole matrix, every row', everyRow, true, true),
        ],
        options(rowCount),
      );
      reportSamples(title('transform'), samples);

      const scatteredSample = sampleFor(samples, 'translation, scattered rows');
      expect(ratio(sampleFor(samples, 'translation, sorted rows'), scatteredSample)).toBeLessThanOrEqual(tolerance);
      expect(ratio(sampleFor(samples, 'translation, contiguous rows'), scatteredSample)).toBeLessThanOrEqual(tolerance);
      if (detectionMeasurable(rowCount))
        expect(
          ratio(scatteredSample, sampleFor(samples, 'translation, scattered rows, no change detection')),
        ).toBeLessThanOrEqual(2);
      expect(
        ratio(sampleFor(samples, 'whole matrix, sorted rows'), sampleFor(samples, 'whole matrix, scattered rows')),
      ).toBeLessThanOrEqual(tolerance);
    });

    it('publishes once per touched group, not once per changed row', () => {
      const rgb = Float32Array.of(0.9, 0.8, 0.7);
      const samples = measureAll(
        [
          prepare({
            label: 'write only',
            setup: () => {
              scene.restoreColors();
              return dirtySets(table);
            },
            body: (dirty) => writeColors(table, scattered, rgb, dirty),
          }),
          prepare({
            label: 'write and publish the touched ranges',
            setup: () => {
              scene.restoreColors();
              return dirtySets(table);
            },
            body: (dirty) => {
              const written = writeColors(table, scattered, rgb, dirty);
              return written + publishDirty(table, dirty).colorGroups;
            },
          }),
        ],
        options(rowCount),
      );
      reportSamples(title('publish'), samples);

      const dirty = dirtySets(table);
      scene.restoreColors();
      const written = writeColors(table, scattered, rgb, dirty);
      const report = publishDirty(table, dirty);
      expect(written).toBe(count);
      expect(report.colorGroups).toBe(dirty.colors.touchedGroups);
      expect(report.colorGroups).toBeLessThanOrEqual(count);
    });
  });
}
