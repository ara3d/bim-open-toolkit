// What the demo says about Snowdon Towers, checked against the file itself.
//
// The model is a hundred megabytes and is never committed, so this file holds only what the real
// file can answer and nothing else: everything the demo does with a model it did not generate is
// checked on generated data in `demo.test.ts`. The one test here skips itself, by name, when the
// file is not on this machine.

import { loadModel } from '@bim-open-toolkit/formats';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { readingOf, snowdonFile } from '../../../src/demos/portfolio/snowdon.js';
import { openedModel } from '../../../src/gallery/model-source.js';

const snowdonPath = fileURLToPath(
  new URL(`../../../../visualization/artifacts/bfast/${snowdonFile}`, import.meta.url),
);

// Every field an object record can carry. The point of listing it is that none of them is a
// quantity, a unit or the document an object came from, which is the whole reason the drill-through
// is not run over this model.
const recordFields: readonly string[] = [
  'ref',
  'name',
  'category',
  'sourceId',
  'parentId',
  'transform',
  'appearance',
  'representation',
];

describe.skipIf(!existsSync(snowdonPath))('the real model', () => {
  it('carries named, categorised objects and no figure a drill-through could attribute', async () => {
    const loaded = await loadModel(new Uint8Array(readFileSync(snowdonPath)), { format: 'bfast' });
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    const reading = readingOf(openedModel('snowdon', loaded.value.data, loaded.value.geometry));

    // What the sheet says the file carries.
    expect(reading.objects).toBeGreaterThan(1000);
    expect(reading.named).toBeGreaterThan(1000);
    expect(reading.categorised).toBeGreaterThan(1000);
    expect(reading.categories.length).toBeGreaterThan(10);
    expect(reading.categories.reduce((total, item) => total + item.count, 0)).toBe(reading.objects);

    // And what it says the file does not carry: no record holds anything a figure could be read
    // from, so nothing here reports one.
    const fields = new Set(loaded.value.data.objects.flatMap((record) => Object.keys(record)));
    expect([...fields].filter((field) => !recordFields.includes(field))).toEqual([]);
  }, 300000);
});
