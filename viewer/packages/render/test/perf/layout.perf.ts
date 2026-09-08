// What the number of groups costs, and what one allocation per attribute would be worth.
//
// The instance-update study's fourth recommendation is to hold each attribute in one allocation
// for the whole model, with each group's buffer a view into it. `InstancedGroup` allocates its own
// buffers in its constructor and offers no way to supply one, so `InstanceTable` cannot do that
// today. This file measures the size of the gap so the request against viewer-core carries a
// number rather than an opinion, and measures how much of the gap disappears simply by grouping
// instances by mesh, which is what `InstanceTable` does.
//
// Run with `npm run perf -w @bim-open-toolkit/render -- --reporter=verbose`.

import { describe, expect, it } from 'vitest';
import { colorStride } from '@bim-open-toolkit/model';
import { everyRow, writeColors } from '../../src/updates.js';
import {
  measureAll,
  perfTable,
  prepare,
  ratio,
  referenceRows,
  reportSamples,
  sampleFor,
} from './harness.js';

// The alpha's group count for the reference model: one group per element, 2.9 instances each.
const perElementGroups = 158_055;
// A group per distinct mesh, which is what a prepared format actually carries.
const perMeshGroups = 2_048;

describe('the cost of the group count', () => {
  // Built once: each of these tables holds 456,598 rows and its own group buffers.
  const many = perfTable(referenceRows, perElementGroups);
  const few = perfTable(referenceRows, perMeshGroups);

  it('writes every colour faster with fewer, larger groups', () => {
    const rgb = Float32Array.of(0.2, 0.4, 0.6);
    // The layout viewer-core does not allow: every colour in one allocation, walked straight
    // through with no group loop and no row index.
    const store = new Float32Array(referenceRows * colorStride);
    const samples = measureAll(
      [
        prepare({
          label: `${perElementGroups.toLocaleString('en-US')} groups, one per element`,
          setup: () => many.restoreColors(),
          body: () => writeColors(many.table, everyRow, rgb),
        }),
        prepare({
          label: `${perMeshGroups.toLocaleString('en-US')} groups, one per mesh`,
          setup: () => few.restoreColors(),
          body: () => writeColors(few.table, everyRow, rgb),
        }),
        prepare({
          label: 'one allocation, straight pass (not reachable through viewer-core)',
          setup: () => {
            store.fill(0);
          },
          body: () => {
            let written = 0;
            for (let at = 0; at < store.length; at += colorStride) {
              store[at] = 0.2;
              store[at + 1] = 0.4;
              store[at + 2] = 0.6;
              written++;
            }
            return written;
          },
        }),
      ],
      { repetitions: 9, warmups: 3 },
    );
    reportSamples(
      `whole-model colour write over ${referenceRows.toLocaleString('en-US')} rows`,
      samples,
    );

    const perElement = sampleFor(samples, `${perElementGroups.toLocaleString('en-US')} groups, one per element`);
    const perMesh = sampleFor(samples, `${perMeshGroups.toLocaleString('en-US')} groups, one per mesh`);
    expect(perMesh.medianMs).toBeLessThan(perElement.medianMs);
    expect(ratio(perElement, perMesh)).toBeGreaterThan(1.2);
  });

  it('writes a scattered selection faster with fewer, larger groups', () => {
    const rgb = Float32Array.of(0.9, 0.1, 0.5);
    const rows = Int32Array.from({ length: 10_000 }, (_unused, i) => (i * 45) % referenceRows);
    const samples = measureAll(
      [
        prepare({
          label: 'one group per element',
          setup: () => many.restoreColors(),
          body: () => writeColors(many.table, rows, rgb),
        }),
        prepare({
          label: 'one group per mesh',
          setup: () => few.restoreColors(),
          body: () => writeColors(few.table, rows, rgb),
        }),
      ],
      { repetitions: 9, warmups: 3 },
    );
    reportSamples('scattered colour write over 10,000 of 456,598 rows', samples);
    expect(sampleFor(samples, 'one group per mesh').medianMs).toBeLessThanOrEqual(
      sampleFor(samples, 'one group per element').medianMs * 1.25,
    );
  });
});
