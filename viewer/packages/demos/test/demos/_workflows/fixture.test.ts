import { describe, expect, it } from 'vitest';
import { geometryBounds, hasRepresentation, isEmptyBounds } from '@bim-open-toolkit/model';
import { defaultBuildingOptions, generateBuilding } from '@bim-open-toolkit/synthetic';
import { emptyGeometry, syntheticFixture, tabularFixture, tabularModel } from '../../../src/demos/_workflows/fixture.js';
import { boundsOfKeys, objectBounds } from '../../../src/demos/_workflows/bounds.js';
import { objectKey } from '@bim-open-toolkit/model';

describe('the data a workflow demo opens', () => {
  it('opens a catalog fixture that has geometry as data already in memory', async () => {
    const source = await syntheticFixture('building', 'Synthetic building').source();
    expect(source.ok).toBe(true);
    if (!source.ok || source.value.kind !== 'data') return;
    expect(source.value.data.objects.length).toBeGreaterThan(0);
    expect(source.value.geometry.instances.count).toBeGreaterThan(0);
  });

  it('refuses a catalog fixture that publishes no geometry rather than drawing something else', async () => {
    const source = await syntheticFixture('costs', 'Synthetic rate set').source();
    expect(source.ok).toBe(false);
    expect(source.diagnostics.map((item) => item.code)).toEqual(['demos/no-geometry']);
  });

  it('gives a table-only fixture objects that exist and a viewport that is honestly empty', async () => {
    const model = tabularModel({ id: 'synthetic-costs', revision: 'seed-7' }, ['scope-1', 'scope-2'], 'Scope');
    expect(model.objects.every((record) => !hasRepresentation(record))).toBe(true);
    const source = await tabularFixture('costs', 'Synthetic rate set', model).source();
    expect(source.ok).toBe(true);
    if (!source.ok || source.value.kind !== 'data') return;
    expect(source.value.geometry).toBe(emptyGeometry);
    expect(isEmptyBounds(geometryBounds(source.value.geometry))).toBe(true);
  });
});

describe('the box each object occupies', () => {
  const building = generateBuilding(defaultBuildingOptions);
  const boxes = objectBounds(building.model, building.geometry);

  it('gives a box to every drawn object and none to an object with no instance', () => {
    const drawn = building.model.objects.filter(hasRepresentation);
    expect(drawn.length).toBeGreaterThan(0);
    for (const record of drawn) expect(boxes.has(objectKey(record.ref))).toBe(true);
    for (const record of building.model.objects.filter((item) => !hasRepresentation(item)))
      expect(boxes.has(objectKey(record.ref))).toBe(false);
  });

  it('adds up to the whole geometry when every object is asked for', () => {
    expect(boundsOfKeys(boxes, boxes.keys())).toEqual(geometryBounds(building.geometry));
  });

  it('says nothing rather than an empty box when none of the objects is drawn', () => {
    expect(boundsOfKeys(boxes, ['nothing-like-this'])).toBeUndefined();
  });
});
