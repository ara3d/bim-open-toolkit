/**
 * How the two binding layouts scale, on a model built in memory.
 *
 * This runs everywhere, with no private data, so the relationship between the
 * two layouts can be rechecked on any machine. The generated model has the
 * shape that makes binding expensive: many groups holding few instances each,
 * several instances per object, plus hidden and geometry-free rows.
 */
import { bfastToGroups } from '@ara3d/viewer-loaders';
import { describe, expect, it } from 'vitest';
import { buildAlphaBindings } from '../../../src/bindings/alpha-reference.js';
import { buildColumnarBinding } from '../../../src/bindings/build.js';
import { tableBytes } from '../../../src/bindings/representation-table.js';
import { bfastBindingSource, type BindingSource } from '../../../src/bindings/source.js';
import { buildingShape, syntheticRenderModel } from '../../../src/bindings/synthetic-model.js';
import { measureAll, prepare, reportSamples, sampleFor } from '../../../src/perf/measure.js';
import { canCollectGarbage, measureHeapGrowth, megabytes } from '../../../src/perf/memory.js';

const modelId = 'synthetic';

/**
 * Repetitions fall as the model grows, so every scale takes a similar time and
 * the small ones get enough rounds to be stable. Ten thousand instances is only
 * a few milliseconds either way, and on a machine running several agents at once
 * five rounds were not enough to keep the two medians in order.
 */
const scales = [
  { instances: 10_000, repetitions: 25 },
  { instances: 100_000, repetitions: 10 },
  { instances: 500_000, repetitions: 5 },
] as const;

const alphaLabel = 'alpha bindings';
const columnarLabel = 'columnar table';

const sourceOf = (instances: number): BindingSource => {
  const { model, entityLocalIds } = syntheticRenderModel(buildingShape(instances));
  return bfastBindingSource(model, bfastToGroups(model), entityLocalIds);
};

describe('binding layouts at scale', () => {
  it(`compares both layouts at ${scales.map((s) => s.instances).join(', ')} instances`, () => {
    console.log(`\nforced collection available: ${canCollectGarbage() ? 'yes' : 'no (heap figures include garbage)'}`);
    for (const { instances, repetitions } of scales) {
      const source = sourceOf(instances);
      const samples = measureAll([
        prepare({ label: alphaLabel, setup: () => source, body: (s) => buildAlphaBindings(s, modelId).bindings.length }),
        prepare({ label: columnarLabel, setup: () => source, body: (s) => buildColumnarBinding(s).table.count }),
      ], { repetitions, warmups: 1 });

      const alpha = sampleFor(samples, alphaLabel);
      const columnar = sampleFor(samples, columnarLabel);
      const alphaHeap = measureHeapGrowth(() => buildAlphaBindings(source, modelId));
      const columnarHeap = measureHeapGrowth(() => buildColumnarBinding(source));

      reportSamples(
        `${instances.toLocaleString()} instance records`
        + ` -> ${columnarHeap.value.table.count.toLocaleString()} rendered,`
        + ` ${source.groups.length.toLocaleString()} groups,`
        + ` ${columnarHeap.value.objects.count.toLocaleString()} objects`,
        samples,
      );
      console.log(
        canCollectGarbage()
          ? `alpha heap ${megabytes(alphaHeap.bytes).toFixed(1)} MB,`
            + ` columnar heap ${megabytes(columnarHeap.bytes).toFixed(1)} MB,`
            + ` columnar columns ${megabytes(tableBytes(columnarHeap.value.table)).toFixed(2)} MB`
          : `columnar columns ${megabytes(tableBytes(columnarHeap.value.table)).toFixed(2)} MB`
            + ' (heap growth not compared: rerun with NODE_OPTIONS=--expose-gc)',
      );

      expect(columnarHeap.value.table.count).toBe(alphaHeap.value.bindings.length);
      expect(columnar.medianMs).toBeLessThanOrEqual(alpha.medianMs);
      // Structural and machine independent: three 32-bit columns per row against
      // one object per row that holds two frozen arrays of its own.
      expect(tableBytes(columnarHeap.value.table)).toBe(columnarHeap.value.table.count * 12);
      // Heap sampling only means anything when a collection can be forced first.
      if (canCollectGarbage()) expect(columnarHeap.bytes).toBeLessThan(alphaHeap.bytes);
    }
  });
});
