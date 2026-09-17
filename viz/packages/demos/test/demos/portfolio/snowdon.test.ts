// What the demo says about Snowdon Towers, checked against the file itself.
//
// The model is a hundred megabytes and is never committed, so this file holds only what the real
// file can answer and nothing else: everything the demo does with a model it did not generate is
// checked on generated data in `demo.test.ts` and on hand-built parameter tables in
// `recorded.test.ts`. The tests here skip themselves, by name, when the file is not on this machine.

import { findProperty, loadModel } from '@bim-open-toolkit/formats';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it } from 'vitest';
import { metricOf, rollupOf, type RecordedRollup } from '../../../src/demos/portfolio/recorded.js';
import { readingOf, snowdonFile } from '../../../src/demos/portfolio/snowdon.js';
import { openedModel } from '../../../src/gallery/model-source.js';
import type { OpenedModel } from '../../../src/gallery/contracts.js';

const snowdonPath = fileURLToPath(
  new URL(`../../../../visualization/artifacts/bfast/${snowdonFile}`, import.meta.url),
);

// The seven source files federated into the model, and how many objects each is attributed.
const documentObjects: readonly (readonly [string, number])[] = [
  ['Snowdon Towers Sample Architectural', 21652],
  ['Snowdon Towers Sample Plumbing', 9183],
  ['Snowdon Towers Sample Electrical', 7244],
  ['Snowdon Towers Sample Structural', 4425],
  ['Snowdon Towers Sample HVAC', 4354],
  ['Snowdon Towers Sample Facades', 2267],
  ['Snowdon Towers Sample Site', 2014],
];

// One object of the file, read whole: a wall of the architectural model with an area in square
// feet. It is here so a reader can check one number in the file by hand against one number here.
const knownWall = { row: 1165, category: 'Walls', area: 465.61871337890625, unit: 'SQUARE_FEET' } as const;

describe.skipIf(!existsSync(snowdonPath))('the real model', () => {
  let model: OpenedModel;
  let rollup: RecordedRollup;

  beforeAll(async () => {
    const loaded = await loadModel(new Uint8Array(readFileSync(snowdonPath)), {
      format: 'bfast',
      properties: true,
    });
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) throw new Error(loaded.diagnostics.map((one) => one.message).join('; '));
    model = openedModel('snowdon', loaded.value.data, loaded.value.geometry, loaded.value);
    const made = rollupOf(model);
    expect(made).toBeDefined();
    if (made === undefined) throw new Error('the BIM export carries parameter tables and a document table');
    rollup = made;
  }, 300000);

  it('carries named, categorised objects the demo counts off the records alone', () => {
    const reading = readingOf(model);
    expect(reading.objects).toBe(51139);
    expect(reading.named).toBe(48844);
    // Fewer records carry a category than carry a name, which is a fact about the file and the
    // reason the sheet counts the two separately rather than reporting one for both.
    expect(reading.categorised).toBe(31679);
    expect(reading.categories.length).toBeGreaterThan(10);
    expect(reading.categories.reduce((total, item) => total + item.count, 0)).toBe(reading.objects);
  });

  it('attributes every object to one of the seven source files, so nothing is unattributed', () => {
    expect(rollup.documentCount).toBe(documentObjects.length);
    expect(rollup.unattributed).toBe(0);
    for (const [title, objects] of documentObjects)
      expect(rollup.documents.find((item) => item.title === title)?.objects).toBe(objects);
    expect(rollup.documents.reduce((total, item) => total + item.objects, 0)).toBe(rollup.objects);
  });

  it('reads one wall of the file exactly as the file records it, unit and all', () => {
    const properties = model.properties;
    expect(properties).toBeDefined();
    if (properties === undefined) return;
    expect(model.data.objects[knownWall.row]?.category).toBe(knownWall.category);
    const area = findProperty(properties, knownWall.row, 'Area');
    expect(area?.value).toBe(knownWall.area);
    expect(area?.units).toBe(knownWall.unit);
  });

  it('adds the recorded floor area up per source document, in square feet and converting nothing', () => {
    expect(rollup.requestedMetricName).toBe('Area');
    expect(rollup.requested.unit).toBe('SQUARE_FEET');
    expect(rollup.requested.objects).toBe(23773);
    expect(rollup.requested.total ?? 0).toBeCloseTo(1634316.98, 1);
    // Largest first, and the architectural model is the largest by a long way.
    expect(rollup.documents[0]?.title).toBe('Snowdon Towers Sample Architectural');
    expect(rollup.documents[0]?.requested.total ?? 0).toBeCloseTo(784962.07, 1);
    expect(
      rollup.documents.reduce((total, item) => total + (item.requested.total ?? 0), 0),
    ).toBeCloseTo(rollup.requested.total ?? 0, 1);
    for (const document of rollup.documents) expect(document.requested.unit).toBe('SQUARE_FEET');
  });

  it('counts the objects recording no area as recording none, and the recorded zeros apart', () => {
    expect(rollup.requested.without).toBe(51139 - 23773);
    expect(rollup.requested.objects + rollup.requested.without).toBe(rollup.objects);
    // A recorded zero is inside the objects that record an area, not inside the ones that do not.
    expect(rollup.requested.zeros).toBe(4615);
    expect((rollup.byOutcome.get('resolved') ?? []).length).toBe(23773);
    expect((rollup.byOutcome.get('missing') ?? []).length).toBe(51139 - 23773);
    expect(rollup.byOutcome.get('excluded')).toBeUndefined();
  });

  it('gives no volume total, because the file records volume in two different units', () => {
    const volume = metricOf(rollup.metrics, 'Volume');
    expect(volume?.total).toBeUndefined();
    expect(volume?.byUnit.map((item) => item.unit)).toEqual(['CUBIC_FEET', 'US_GALLONS']);
    expect(volume?.byUnit.find((item) => item.unit === 'US_GALLONS')?.objects).toBe(40);
  });

  it('reads every parameter row the file holds and drops none of them', () => {
    expect(rollup.propertyRows).toBe(1620524);
    expect(rollup.droppedRows).toBe(0);
  });
});
