/**
 * The property decoding, on rows built by hand.
 *
 * `modelPropertiesFrom` and its neighbours take the rows a Parquet reader hands back rather than a
 * file, which is the same seam `entityFactsFrom` sits on, so everything here runs on a handful of
 * literal rows and none of it needs a model on disk. The one test that does need the private
 * federated model lives in `real-model.test.ts` and skips itself when the file is not there.
 */

import { describe, expect, it } from 'vitest';
import {
  documentOfObject,
  findProperty,
  findPropertyRow,
  modelDocumentsFrom,
  modelPropertiesFrom,
  noModelProperties,
  objectProperties,
  parquetInteger,
  parquetNumber,
  parquetText,
  propertyCount,
  propertyDescriptorsFrom,
  propertyKindOf,
  propertyNumber,
  propertyRowEnd,
  propertyRowStart,
  propertyValue,
  readProperty,
  type PropertyTables,
} from '../src/properties.js';

// A string pool with an empty entry, which BOS uses where a label is absent.
const strings = ['Area', 'SQUARE_FEET', 'Dimensions', '', 'Comments', 'Wall', 'Level 1', 'Volume', 'CUBIC_FEET'];

// Two descriptors: a square-foot quantity and an unnamed text field with no unit and no group.
const descriptorRows = [
  { Name: 0, Units: 1, Group: 2, Type: 1 },
  { Name: 4, Units: 3, Group: 3, Type: 3 },
  { Name: 7, Units: 8, Group: 2, Type: 1 },
  { Name: 0, Units: 3, Group: 4, Type: 0 },
];

// Three objects, from four entities: entity 3 is not an object of the model.
const objectOfEntity = Int32Array.from([0, 1, 2, -1]);

const tables = (parameters: readonly Record<string, unknown>[]): PropertyTables => ({
  descriptors: descriptorRows,
  parameters,
  numbers: [{ Numbers: 12.5 }, { Numbers: 900 }],
  points: [{ X: 1, Y: 2, Z: 3 }],
  strings,
  objectOfEntity,
  objects: 3,
});

describe('propertyKindOf', () => {
  it('names the BOS ParameterType ordinals', () => {
    expect([0, 1, 2, 3, 4].map(propertyKindOf)).toEqual(['int', 'number', 'entity', 'string', 'point']);
  });

  it('reads an ordinal this schema does not define, and an absent one, as unknown', () => {
    expect(propertyKindOf(9)).toBe('unknown');
    expect(propertyKindOf(-1)).toBe('unknown');
    expect(propertyKindOf(undefined)).toBe('unknown');
  });
});

describe('propertyDescriptorsFrom', () => {
  const decoded = () => propertyDescriptorsFrom(descriptorRows, strings);

  it('reads the name, the unit and the group from the string pool', () => {
    const found = decoded();
    expect(found.count).toBe(4);
    expect(found.name[0]).toBe('Area');
    expect(found.units[0]).toBe('SQUARE_FEET');
    expect(found.group[0]).toBe('Dimensions');
    expect(found.kind[0]).toBe('number');
  });

  it('reads an empty pool entry as no value rather than as an empty label', () => {
    const found = decoded();
    expect(found.units[1]).toBeUndefined();
    expect(found.group[1]).toBeUndefined();
  });

  it('reads an index outside the pool as no value', () => {
    const found = propertyDescriptorsFrom([{ Name: 99, Units: -1, Group: undefined, Type: 3 }], strings);
    expect(found.name[0]).toBeUndefined();
    expect(found.units[0]).toBeUndefined();
    expect(found.group[0]).toBeUndefined();
  });

  it('indexes a name that repeats across groups and value kinds', () => {
    expect(decoded().byName.get('Area')).toEqual([0, 3]);
    expect(decoded().byName.get('Volume')).toEqual([2]);
    expect(decoded().byName.get('nothing')).toBeUndefined();
  });
});

describe('modelPropertiesFrom', () => {
  const sample = () =>
    modelPropertiesFrom(
      tables([
        { Entity: 2, Descriptor: 1, Value: 5 },
        { Entity: 0, Descriptor: 0, Value: 0 },
        { Entity: 0, Descriptor: 1, Value: 6 },
        { Entity: 3, Descriptor: 0, Value: 1 },
        { Entity: 2, Descriptor: 2, Value: 1 },
      ]),
    );

  it('sorts the rows into object order, so an object reads as one contiguous range', () => {
    const found = sample();
    expect(found.rows).toBe(4);
    expect([...found.start]).toEqual([0, 2, 2, 4]);
    expect(propertyRowStart(found, 0)).toBe(0);
    expect(propertyRowEnd(found, 0)).toBe(2);
    expect([propertyCount(found, 0), propertyCount(found, 1), propertyCount(found, 2)]).toEqual([2, 0, 2]);
    expect([...found.descriptor]).toEqual([0, 1, 1, 2]);
  });

  it('drops a row naming an entity that is not an object, and says how many', () => {
    expect(sample().dropped).toBe(1);
  });

  it('reads no properties for an object row outside the table', () => {
    expect(propertyCount(sample(), 7)).toBe(0);
    expect(propertyCount(sample(), -1)).toBe(0);
  });

  it('carries the pools so a value can be resolved later', () => {
    const found = sample();
    expect([...found.numbers]).toEqual([12.5, 900]);
    expect([...found.points]).toEqual([1, 2, 3]);
    expect(found.strings).toBe(strings);
  });
});

describe('reading a value', () => {
  const withValue = (descriptor: number, value: number) =>
    modelPropertiesFrom(tables([{ Entity: 0, Descriptor: descriptor, Value: value }]));

  it('resolves a number through the number pool, keeping the unit the file recorded', () => {
    const found = withValue(0, 1);
    const reading = readProperty(found, 0);
    expect(reading.name).toBe('Area');
    expect(reading.value).toBe(900);
    expect(reading.units).toBe('SQUARE_FEET');
    expect(reading.kind).toBe('number');
    expect(reading.raw).toBe(1);
  });

  it('resolves a string through the string pool', () => {
    expect(readProperty(withValue(1, 5), 0).value).toBe('Wall');
  });

  it('reads an int value as the word itself', () => {
    expect(readProperty(withValue(3, 42), 0).value).toBe(42);
  });

  it('resolves an entity value to the object row it names', () => {
    const entityDescriptor = modelPropertiesFrom({
      ...tables([{ Entity: 0, Descriptor: 0, Value: 2 }]),
      descriptors: [{ Name: 4, Units: 3, Group: 3, Type: 2 }],
    });
    expect(readProperty(entityDescriptor, 0).value).toBe(2);
  });

  it('reads an entity value naming something that is not an object as no value', () => {
    const entityDescriptor = modelPropertiesFrom({
      ...tables([{ Entity: 0, Descriptor: 0, Value: 3 }]),
      descriptors: [{ Name: 4, Units: 3, Group: 3, Type: 2 }],
    });
    expect(readProperty(entityDescriptor, 0).value).toBeUndefined();
  });

  it('resolves a point value through the point pool', () => {
    const pointDescriptor = modelPropertiesFrom({
      ...tables([{ Entity: 0, Descriptor: 0, Value: 0 }]),
      descriptors: [{ Name: 4, Units: 3, Group: 3, Type: 4 }],
    });
    const reading = readProperty(pointDescriptor, 0);
    expect(reading.point).toEqual([1, 2, 3]);
    expect(reading.value).toBeUndefined();
  });

  it('reads a point value outside the pool as no point at all', () => {
    const pointDescriptor = modelPropertiesFrom({
      ...tables([{ Entity: 0, Descriptor: 0, Value: 9 }]),
      descriptors: [{ Name: 4, Units: 3, Group: 3, Type: 4 }],
    });
    expect(readProperty(pointDescriptor, 0).point).toBeUndefined();
  });

  it('reads an index outside the pool as no value rather than as a made-up one', () => {
    expect(propertyValue(withValue(0, 99), 0)).toBeUndefined();
    expect(propertyValue(withValue(1, 99), 0)).toBeUndefined();
  });

  it('reads an unknown kind as no value, keeping the raw word', () => {
    const strange = modelPropertiesFrom({
      ...tables([{ Entity: 0, Descriptor: 0, Value: 7 }]),
      descriptors: [{ Name: 4, Units: 3, Group: 3, Type: 11 }],
    });
    expect(readProperty(strange, 0)).toMatchObject({ kind: 'unknown', value: undefined, raw: 7 });
  });

  it('reads a quantity as a number, and a text or entity value as no number', () => {
    expect(propertyNumber(withValue(0, 0), 0)).toBe(12.5);
    expect(propertyNumber(withValue(3, 42), 0)).toBe(42);
    expect(propertyNumber(withValue(1, 5), 0)).toBeUndefined();
    const entityDescriptor = modelPropertiesFrom({
      ...tables([{ Entity: 0, Descriptor: 0, Value: 2 }]),
      descriptors: [{ Name: 4, Units: 3, Group: 3, Type: 2 }],
    });
    expect(propertyNumber(entityDescriptor, 0)).toBeUndefined();
  });
});

describe('finding a named property', () => {
  const found = () =>
    modelPropertiesFrom(
      tables([
        { Entity: 0, Descriptor: 1, Value: 5 },
        { Entity: 0, Descriptor: 0, Value: 1 },
        { Entity: 1, Descriptor: 1, Value: 6 },
      ]),
    );

  it('reads the floor area of an object in the unit the file recorded', () => {
    const area = findProperty(found(), 0, 'Area');
    expect(area?.value).toBe(900);
    expect(area?.units).toBe('SQUARE_FEET');
  });

  it('reports no row for an object that does not carry the property', () => {
    expect(findPropertyRow(found(), 1, 'Area')).toBe(-1);
    expect(findProperty(found(), 1, 'Area')).toBeUndefined();
  });

  it('reports no row for a name the model does not define at all', () => {
    expect(findPropertyRow(found(), 0, 'Perimeter')).toBe(-1);
  });

  it('lists every property of one object', () => {
    expect(objectProperties(found(), 0).map((each) => each.name)).toEqual(['Comments', 'Area']);
    expect(objectProperties(found(), 2)).toEqual([]);
  });
});

describe('noModelProperties', () => {
  it('reads as a model that carries nothing, without special-casing at the call site', () => {
    expect(propertyCount(noModelProperties, 0)).toBe(0);
    expect(findPropertyRow(noModelProperties, 0, 'Area')).toBe(-1);
    expect(objectProperties(noModelProperties, 0)).toEqual([]);
  });
});

describe('modelDocumentsFrom', () => {
  const documentStrings = ['Architectural', 'C:/a.rvt', 'Structural', 'C:/b.rvt'];
  const rows = [
    { Title: 0, Path: 1 },
    { Title: 2, Path: 3 },
  ];

  it('reads the title and path of each document, and the document of each object row', () => {
    // Entity 0 is object row 1 and entity 2 is object row 0, so the mapping cannot be the identity.
    const found = modelDocumentsFrom(rows, documentStrings, Int32Array.from([1, 0, 0]), Int32Array.from([2, 0]));
    expect(found.count).toBe(2);
    expect(found.title).toEqual(['Architectural', 'Structural']);
    expect(found.path[1]).toBe('C:/b.rvt');
    expect([...found.ofObject]).toEqual([0, 1]);
    expect(documentOfObject(found, 1)).toBe(1);
  });

  it('reads an entity naming no document, or one the table does not hold, as no document', () => {
    const found = modelDocumentsFrom(rows, documentStrings, Int32Array.from([-1, 9]), Int32Array.from([0, 1]));
    expect([...found.ofObject]).toEqual([-1, -1]);
    expect(documentOfObject(found, 0)).toBe(-1);
    expect(documentOfObject(found, 7)).toBe(-1);
  });
});

describe('the Parquet cell readers', () => {
  it('reads a 64-bit id, which arrives as a bigint', () => {
    expect(parquetInteger(7n)).toBe(7);
    expect(parquetNumber(7n)).toBe(7);
  });

  it('truncates an integer cell and keeps a float cell whole', () => {
    expect(parquetInteger(2.9)).toBe(2);
    expect(parquetNumber(2.9)).toBe(2.9);
  });

  it('reads anything that is not a number, or is not finite, as no value', () => {
    expect(parquetInteger('4')).toBeUndefined();
    expect(parquetInteger(Number.NaN)).toBeUndefined();
    expect(parquetNumber(Number.POSITIVE_INFINITY)).toBeUndefined();
    expect(parquetText(4)).toBeUndefined();
    expect(parquetText('four')).toBe('four');
  });
});
