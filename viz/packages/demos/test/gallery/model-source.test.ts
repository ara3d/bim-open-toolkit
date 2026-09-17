// Opening a source without a renderer: the derived pieces the scene binding and the style pass
// need are plain functions of the model, so they are checked here rather than in a browser.

import { describe, expect, it } from 'vitest';
import { defaultAppearance, objectKey, parse } from '@bim-open-toolkit/model';
import { defaultBuildingOptions, generateBuilding } from '@bim-open-toolkit/synthetic';
import { baseAppearancesOf, objectKeysOf, resolveModelSource } from '../../src/gallery/model-source.js';
import { viewSlice, viewStateSchema } from '../../src/gallery/view-slice.js';
import type { ModelSource } from '../../src/gallery/contracts.js';

const building = generateBuilding(defaultBuildingOptions);

const asSource = (): ModelSource => ({
  kind: 'data',
  id: 'building',
  data: building.model,
  geometry: building.geometry,
});

describe('opening a model source', () => {
  it('keys every object by ordinal, in the order instance rows are addressed', () => {
    const keys = objectKeysOf(building.model);
    expect(keys).toHaveLength(building.model.objects.length);
    const first = building.model.objects[0];
    expect(first).toBeDefined();
    if (first !== undefined) expect(keys[0]).toBe(objectKey(first.ref));
  });

  it('takes the appearance each object was generated with, and falls back to grey for the rest', () => {
    const base = baseAppearancesOf(building.model);
    expect(base.size).toBe(building.model.objects.length);
    const missing = base.get('no such object');
    expect(missing).toBeUndefined();
    for (const appearance of base.values()) expect(appearance.opacity).toBeGreaterThan(0);
    expect(baseAppearancesOf({ ...building.model, objects: [] }).size).toBe(0);
    expect(defaultAppearance.visible).toBe(true);
  });

  it('resolves data already in memory without touching the network', async () => {
    const opened = await resolveModelSource(asSource());
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(opened.value.modelId).toBe('building');
    expect(opened.value.ref).toEqual(building.model.ref);
    expect(opened.value.keys.length).toBe(building.model.objects.length);
    expect(opened.value.base.size).toBe(building.model.objects.length);
  });

  it('reports the reason rather than throwing when a file holds no recognisable format', async () => {
    const opened = await resolveModelSource({
      kind: 'file',
      id: 'picked',
      file: new Blob([new Uint8Array([1, 2, 3, 4])]),
      name: 'notes.txt',
    });
    expect(opened.ok).toBe(false);
    expect(opened.diagnostics.length).toBeGreaterThan(0);
  });
});

describe('the view slice', () => {
  it('starts at the default view and reads back what it wrote', () => {
    const round = parse(viewStateSchema, JSON.parse(JSON.stringify(viewSlice.default)));
    expect(round.ok).toBe(true);
    if (round.ok) expect(round.value).toEqual(viewSlice.default);
  });

  it('refuses a stored value that is not a view', () => {
    expect(parse(viewStateSchema, { camera: { position: [0, 0] } }).ok).toBe(false);
  });
});
