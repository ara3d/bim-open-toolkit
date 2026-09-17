/**
 * What the alpha loader's normalized binding step costs on the reference model,
 * and what the columnar layout costs instead.
 *
 * Loading is three steps: parse the file, convert the geometry into render
 * groups, then bind. Only the third is measured against a replacement here; the
 * first two are measured so it is clear what is left once binding is gone.
 *
 * The model is private and is never committed. Without it this file skips and
 * says why. Run with `NODE_OPTIONS=--expose-gc` for exact heap readings.
 */
import {
  bfastToGroups,
  bimEntityLocalIds,
  parseBfastModel,
  type BfastModel,
  type BosConvertResult,
} from '@ara3d/viewer-loaders';
import { loadBosModel } from '@bim-open-toolkit/visualization/loading';
import { describe, expect, it } from 'vitest';
import { buildAlphaBindings } from '../../../src/bindings/alpha-reference.js';
import {
  buildColumnarBinding,
  buildRepresentationTable,
  validateTransforms,
  withOpaqueMaterials,
} from '../../../src/bindings/build.js';
import { buildObjectTable, objectAt } from '../../../src/bindings/object-table.js';
import { instanceAt, representationIdAt, tableBytes } from '../../../src/bindings/representation-table.js';
import { bfastBindingSource } from '../../../src/bindings/source.js';
import { measureAll, median, prepare, reportSamples, sampleFor } from '../../../src/perf/measure.js';
import { canCollectGarbage, measureHeapGrowth, megabytes } from '../../../src/perf/memory.js';
import { modelPath, readBenchmarkModel } from './model-file.js';

const file = readBenchmarkModel();
const available = 'buffer' in file;
if (!available) console.log(`\nskipping the reference model benchmark: ${file.reason}`);

const modelId = 'reference';
const repetitions = 5;
const warmups = 1;
const alphaLabel = 'alpha bindings (one object per instance)';
const columnarLabel = 'columnar table (three integer columns)';

/** Times `body` `count` times after one untimed run, and returns the median milliseconds. */
async function medianOf(body: () => Promise<number> | number, count: number): Promise<number> {
  await body();
  const times: number[] = [];
  for (let i = 0; i < count; i += 1) {
    const start = performance.now();
    await body();
    times.push(performance.now() - start);
  }
  return median(times);
}

describe.skipIf(!available)('normalized bindings on the reference model', () => {
  const buffer = 'buffer' in file ? file.buffer : new ArrayBuffer(0);

  it('reports where loading time goes and shows the columnar step is not slower', async () => {
    console.log(`\nmodel: ${modelPath()} (${buffer.byteLength.toLocaleString()} bytes)`);
    console.log(`forced collection available: ${canCollectGarbage() ? 'yes' : 'no (heap figures include garbage)'}`);

    let parsed: BfastModel = parseBfastModel(buffer);
    const parseMs = await medianOf(() => {
      parsed = parseBfastModel(buffer);
      return parsed.instanceInts.length;
    }, repetitions);

    let entityLocalIds: Int32Array | null = await bimEntityLocalIds(parsed.bimData);
    const entityMs = await medianOf(async () => {
      entityLocalIds = await bimEntityLocalIds(parsed.bimData);
      return entityLocalIds?.length ?? 0;
    }, repetitions);

    let converted: BosConvertResult = bfastToGroups(parsed);
    const convertMs = await medianOf(() => {
      converted = bfastToGroups(parsed);
      return converted.instanceCount;
    }, repetitions);

    const source = bfastBindingSource(parsed, converted, entityLocalIds);
    const objectTable = buildObjectTable(entityLocalIds, source.instanceEntities);
    const opaque = withOpaqueMaterials(source.groups);
    const groups = opaque.map((entry) => entry.group);
    const samples = measureAll([
      prepare({
        label: alphaLabel,
        setup: () => source,
        body: (input) => buildAlphaBindings(input, modelId).bindings.length,
      }),
      prepare({
        label: columnarLabel,
        setup: () => source,
        body: (input) => buildColumnarBinding(input).table.count,
      }),
      prepare({
        label: '  of which: object table',
        setup: () => source,
        body: (input) => buildObjectTable(input.entityLocalIds, input.instanceEntities).count,
      }),
      prepare({
        label: '  of which: opaque material rebuild',
        setup: () => source,
        body: (input) => withOpaqueMaterials(input.groups).length,
      }),
      prepare({
        label: '  of which: transform validation',
        setup: () => groups,
        body: (input) => { validateTransforms(input); return input.length; },
      }),
      prepare({
        label: '  of which: representation columns',
        setup: () => opaque,
        body: (input) => buildRepresentationTable(input, objectTable.rowOfEntity).count,
      }),
    ], { repetitions, warmups });

    const alpha = sampleFor(samples, alphaLabel);
    const columnar = sampleFor(samples, columnarLabel);

    const alphaHeap = measureHeapGrowth(() => buildAlphaBindings(source, modelId));
    const columnarHeap = measureHeapGrowth(() => buildColumnarBinding(source));

    console.log([
      '',
      `groups ${converted.groupEntities.length.toLocaleString()}`,
      `rendered instances ${converted.instanceCount.toLocaleString()}`,
      `objects ${columnarHeap.value.objects.count.toLocaleString()}`,
      '',
      `parse                     ${parseMs.toFixed(1)} ms`,
      `entity table decode       ${entityMs.toFixed(1)} ms`,
      `group conversion          ${convertMs.toFixed(1)} ms`,
      `alpha binding             ${alpha.medianMs.toFixed(1)} ms`,
      `columnar binding          ${columnar.medianMs.toFixed(1)} ms`,
      '',
      canCollectGarbage()
        ? `alpha binding heap        ${megabytes(alphaHeap.bytes).toFixed(1)} MB\n`
          + `columnar binding heap     ${megabytes(columnarHeap.bytes).toFixed(1)} MB`
        : 'heap growth not compared; rerun with NODE_OPTIONS=--expose-gc',
      `columnar columns retained ${megabytes(tableBytes(columnarHeap.value.table)).toFixed(2)} MB`,
    ].join('\n'));
    reportSamples('binding step, interleaved repetitions', samples);

    expect(columnar.medianMs).toBeLessThanOrEqual(alpha.medianMs);
    expect(columnarHeap.value.table.count).toBe(alphaHeap.value.bindings.length);
    expect(tableBytes(columnarHeap.value.table)).toBe(columnarHeap.value.table.count * 12);
    if (canCollectGarbage()) expect(columnarHeap.bytes).toBeLessThan(alphaHeap.bytes / 4);
  });

  it('loads end to end faster than the shipped loader, which binds as it goes', async () => {
    const shippedMs = await medianOf(async () => {
      const loaded = await loadBosModel(buffer, { id: modelId, revision: '1' });
      if (!loaded.ok) throw new Error('the shipped loader failed');
      return loaded.value.bindings.length;
    }, repetitions);
    const columnarMs = await medianOf(async () => {
      const parsed = parseBfastModel(buffer);
      const entityLocalIds = await bimEntityLocalIds(parsed.bimData);
      const converted = bfastToGroups(parsed);
      return buildColumnarBinding(bfastBindingSource(parsed, converted, entityLocalIds)).table.count;
    }, repetitions);
    console.log([
      '',
      `shipped loadBosModel      ${shippedMs.toFixed(1)} ms`,
      `parse + convert + columns ${columnarMs.toFixed(1)} ms`,
    ].join('\n'));
    expect(columnarMs).toBeLessThan(shippedMs);
  });

  it('says the same thing about every instance as the shipped loader does', async () => {
    const loaded = await loadBosModel(buffer, { id: modelId, revision: '1' });
    if (!loaded.ok) throw new Error(loaded.diagnostics.map((d) => d.message).join('; '));
    const parsed = parseBfastModel(buffer);
    const entityLocalIds = await bimEntityLocalIds(parsed.bimData);
    const columnar = buildColumnarBinding(bfastBindingSource(parsed, bfastToGroups(parsed), entityLocalIds));

    // Half a million rows, so the comparison reports the first disagreement
    // rather than running an assertion per field.
    expect(columnar.objects.count).toBe(loaded.value.model.objects.length);
    expect(columnar.table.count).toBe(loaded.value.bindings.length);

    let mismatch = '';
    for (let row = 0; row < columnar.objects.count && mismatch === ''; row += 1) {
      const expected = loaded.value.model.objects[row];
      const actual = objectAt(columnar.objects, row, modelId);
      if (expected === undefined) mismatch = `object ${row} missing from the loader`;
      else if (actual.ref.objectId !== expected.ref.objectId) mismatch = `object ${row} id ${actual.ref.objectId} != ${expected.ref.objectId}`;
      else if (actual.name !== expected.name) mismatch = `object ${row} name ${actual.name} != ${String(expected.name)}`;
      else if (actual.sourceId !== expected.sourceId) mismatch = `object ${row} source id ${String(actual.sourceId)} != ${String(expected.sourceId)}`;
    }
    expect(mismatch).toBe('');

    for (let row = 0; row < columnar.table.count && mismatch === ''; row += 1) {
      const expected = loaded.value.bindings[row];
      const actual = instanceAt(columnar, row);
      const transform = expected?.localTransform;
      const color = expected?.colorFactor;
      if (expected === undefined || transform === undefined || color === undefined) {
        mismatch = `binding ${row} missing from the loader`;
        break;
      }
      if (objectAt(columnar.objects, actual.objectIndex, modelId).ref.objectId !== expected.ref.objectId)
        mismatch = `binding ${row} names a different object`;
      else if (representationIdAt(columnar.table, row) !== expected.representationId)
        mismatch = `binding ${row} representation id disagrees`;
      else for (let i = 0; i < 16 && mismatch === ''; i += 1)
        if (actual.transform[i] !== Math.fround(transform[i] ?? 0)) mismatch = `binding ${row} transform element ${i} disagrees`;
      if (mismatch === '') for (let i = 0; i < 4; i += 1)
        if (actual.color[i] !== color[i]) mismatch = `binding ${row} colour channel ${i} disagrees`;
    }
    expect(mismatch).toBe('');
  });
});
