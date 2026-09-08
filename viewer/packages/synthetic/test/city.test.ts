// The portfolio and the sampled field: documents that are not buildings, buildings nobody
// registered, and cells nobody sampled.

import { describe, expect, it } from 'vitest';
import { columnOf, isRegistered, geographicAnchor, type Table } from '@bim-open-toolkit/model';
import { splitIds } from '../src/arrays.js';
import { defaultCityOptions, generateCity } from '../src/city.js';
import { cellCount, cellIndex, defaultFieldOptions, generateField } from '../src/field.js';

const strings = (source: Table, name: string): readonly string[] => {
  const column = columnOf(source, name);
  return column === undefined || column.type !== 'string' ? [] : [...column.values];
};

const numbers = (source: Table, name: string): readonly number[] => {
  const column = columnOf(source, name);
  return column === undefined || column.type !== 'f64' ? [] : [...column.values];
};

const city = generateCity(defaultCityOptions);
const field = generateField(defaultFieldOptions);

describe('generateCity', () => {
  it('is a function of its options alone', () => {
    const again = generateCity(defaultCityOptions);
    expect(numbers(again.buildings, 'latitude')).toEqual(numbers(city.buildings, 'latitude'));
    expect(strings(again.documents, 'buildingIds')).toEqual(strings(city.documents, 'buildingIds'));
  });

  it('produces the buildings its options ask for, across sites', () => {
    const expected = defaultCityOptions.sites * defaultCityOptions.buildingsPerSite;
    expect(city.buildings.rowCount).toBe(expected);
    expect(new Set(strings(city.buildings, 'siteId')).size).toBe(defaultCityOptions.sites);
  });

  it('gives every building a declared frame, one of them unknown', () => {
    expect(city.anchors.length).toBe(city.buildings.rowCount);
    const registered = city.anchors.filter((anchor) => isRegistered(anchor.coordinates));
    expect(registered.length).toBe(city.anchors.length - 1);
    const unregistered = city.anchors.filter((anchor) => !isRegistered(anchor.coordinates));
    expect(unregistered.length).toBe(1);
    for (const anchor of registered) expect(geographicAnchor(anchor.coordinates)).toBeDefined();
  });

  it('leaves an unregistered building at NaN rather than at the origin', () => {
    const registrations = strings(city.buildings, 'registration');
    const latitudes = numbers(city.buildings, 'latitude');
    registrations.forEach((registration, row) => {
      if (registration === 'geographic') expect(Number.isFinite(latitudes[row] ?? Number.NaN)).toBe(true);
      else expect(Number.isNaN(latitudes[row] ?? 0)).toBe(true);
    });
  });

  it('maps documents to one building, to two, and to none', () => {
    const counts = strings(city.documents, 'buildingIds').map((cell) => splitIds(cell).length);
    expect(counts.filter((count) => count === 1).length).toBeGreaterThan(0);
    expect(counts.filter((count) => count === 2).length).toBeGreaterThan(0);
    expect(counts.filter((count) => count === 0).length).toBe(1);
  });

  it('keeps the candidate count in step with the candidate list', () => {
    const cells = strings(city.documents, 'buildingIds');
    const column = columnOf(city.documents, 'buildingIdCount');
    if (column === undefined || column.type !== 'i32') throw new Error('the count column is missing');
    cells.forEach((cell, row) => {
      expect(splitIds(cell).length).toBe(column.values[row]);
    });
  });

  it('names buildings that exist wherever a document names any', () => {
    const known = new Set(strings(city.buildings, 'buildingId'));
    for (const cell of strings(city.documents, 'buildingIds')) {
      for (const buildingId of splitIds(cell)) expect(known.has(buildingId)).toBe(true);
    }
  });

  it('leaves one site with no resolved figure at all', () => {
    const sites = strings(city.buildings, 'siteId');
    const buildingIds = strings(city.buildings, 'buildingId');
    const documents = strings(city.documents, 'documentId');
    const mappings = strings(city.documents, 'buildingIds');
    const metricDocuments = strings(city.metrics, 'documentId');
    const states = strings(city.metrics, 'valueState');
    const lastSite = `site-${defaultCityOptions.sites}`;
    const lastSiteBuildings = new Set(buildingIds.filter((_, row) => sites[row] === lastSite));

    const resolved = metricDocuments.filter((documentId, row) => {
      if (states[row] !== 'known') return false;
      const mapping = splitIds(mappings[documents.indexOf(documentId)] ?? '');
      return mapping.length === 1 && lastSiteBuildings.has(mapping[0] ?? '');
    });
    expect(resolved.length).toBe(0);
  });

  it('reports an unresolved figure as NaN, never as zero', () => {
    const values = numbers(city.metrics, 'value');
    const states = strings(city.metrics, 'valueState');
    values.forEach((value, row) => {
      if (states[row] === 'known') expect(value).toBeGreaterThan(0);
      else expect(Number.isNaN(value)).toBe(true);
    });
    expect(states).toContain('conflicting');
    expect(states).toContain('missing');
  });

  it('draws one mass per building', () => {
    expect(city.model.objects.length).toBe(city.buildings.rowCount);
    expect(isRegistered(city.model.coordinates)).toBe(true);
  });

  it('registers every building and resolves every document at gapScale zero', () => {
    const complete = generateCity({ ...defaultCityOptions, gapScale: 0 });
    expect(complete.anchors.every((anchor) => isRegistered(anchor.coordinates))).toBe(true);
    expect(strings(complete.documents, 'buildingIds').every((cell) => splitIds(cell).length === 1)).toBe(true);
    expect(strings(complete.metrics, 'valueState').every((state) => state === 'known')).toBe(true);
  });

  it('refuses too few sites or buildings to carry the cases', () => {
    expect(() => generateCity({ ...defaultCityOptions, sites: 1 })).toThrow(/sites/);
    expect(() => generateCity({ ...defaultCityOptions, buildingsPerSite: 1 })).toThrow(/buildingsPerSite/);
  });
});

describe('generateField', () => {
  it('is a function of its options alone', () => {
    const again = generateField(defaultFieldOptions);
    expect([...again.values]).toEqual([...field.values]);
  });

  it('samples one value per cell', () => {
    expect(field.values.length).toBe(cellCount(defaultFieldOptions.dimensions));
  });

  it('leaves an unsampled cell NaN rather than zero', () => {
    const holes = [...field.values].filter((value) => Number.isNaN(value));
    expect(holes.length).toBeGreaterThan(0);
    expect(field.sampled).toBe(field.values.length - holes.length);
    expect([...field.values].some((value) => value === 0)).toBe(false);
  });

  it('leaves a whole corner uncovered rather than only scattered dropouts', () => {
    const [nx] = defaultFieldOptions.dimensions;
    const corner = [
      cellIndex(defaultFieldOptions.dimensions, 0, 0, 0),
      cellIndex(defaultFieldOptions.dimensions, 1, 1, 1),
    ];
    for (const index of corner) expect(Number.isNaN(field.values[index] ?? 0)).toBe(true);
    expect(nx).toBeGreaterThan(4);
  });

  it('reports statistics over the sampled cells only', () => {
    const sampledValues = [...field.values].filter((value) => !Number.isNaN(value));
    expect(field.minimum).toBeCloseTo(Math.min(...sampledValues), 5);
    expect(field.maximum).toBeCloseTo(Math.max(...sampledValues), 5);
    const mean = sampledValues.reduce((sum, value) => sum + value, 0) / sampledValues.length;
    expect(field.mean).toBeCloseTo(mean, 5);
  });

  it('reports bounds that hold every cell', () => {
    const [nx, ny, nz] = defaultFieldOptions.dimensions;
    const far = [
      defaultFieldOptions.origin[0] + (nx - 1) * defaultFieldOptions.spacing[0],
      defaultFieldOptions.origin[1] + (ny - 1) * defaultFieldOptions.spacing[1],
      defaultFieldOptions.origin[2] + (nz - 1) * defaultFieldOptions.spacing[2],
    ];
    far.forEach((value, axis) => {
      expect(field.bounds.min[axis] ?? 0).toBeLessThan(defaultFieldOptions.origin[axis] ?? 0);
      expect(field.bounds.max[axis] ?? 0).toBeGreaterThan(value);
    });
  });

  it('samples every cell at gapScale zero', () => {
    const complete = generateField({ ...defaultFieldOptions, gapScale: 0 });
    expect(complete.sampled).toBe(complete.values.length);
    expect([...complete.values].every((value) => Number.isFinite(value))).toBe(true);
  });

  it('refuses a grid it cannot sample', () => {
    expect(() => generateField({ ...defaultFieldOptions, dimensions: [1, 4, 4] })).toThrow(/dimension/);
    expect(() => generateField({ ...defaultFieldOptions, spacing: [0, 1, 1] })).toThrow(/spacing/);
  });
});
