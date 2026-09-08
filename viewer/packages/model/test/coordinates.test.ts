import { describe, expect, it } from 'vitest';
import { transformPoint } from '../src/math.js';
import { formatPath } from '../src/result.js';
import { parse } from '../src/schema.js';
import {
  contextTransform, conversionFactor, convertLength, coordinateContextSchema, geographicAnchor,
  isRegistered, lengthUnits, lengthUnitSchema, metresPerUnit, metresZUpLocal, registrationSchema,
  unitScaleMatrix, unknownCoordinates, upAxes, upAxisMatrix, upAxisSchema, upVector,
  type CoordinateContext,
} from '../src/coordinates.js';

describe('coordinates', () => {
  it('knows the metres in each unit and refuses to guess an unknown one', () => {
    expect(metresPerUnit('millimetres')).toBe(0.001);
    expect(metresPerUnit('feet')).toBe(0.3048);
    expect(metresPerUnit('unknown')).toBeUndefined();
  });

  it('converts lengths and reports an unknown conversion as undefined', () => {
    expect(convertLength(1000, 'millimetres', 'metres')).toBeCloseTo(1);
    expect(convertLength(1, 'metres', 'unknown')).toBeUndefined();
    expect(conversionFactor('metres', 'metres')).toBe(1);
  });

  it('scales coordinates by a unit change', () => {
    const matrix = unitScaleMatrix('millimetres', 'metres');
    expect(matrix === undefined ? undefined : transformPoint(matrix, [1000, 0, 0])[0]).toBeCloseTo(1);
    expect(unitScaleMatrix('unknown', 'metres')).toBeUndefined();
  });

  it('rotates between up-axis conventions and does nothing when they agree', () => {
    expect(upVector('z')).toEqual([0, 0, 1]);
    expect(transformPoint(upAxisMatrix('z', 'y'), [0, 0, 1])).toEqual([0, 1, 0]);
    expect(transformPoint(upAxisMatrix('y', 'z'), [0, 1, 0])).toEqual([0, 0, 1]);
    expect(transformPoint(upAxisMatrix('z', 'z'), [1, 2, 3])).toEqual([1, 2, 3]);
  });

  it('combines a unit change and an axis change between contexts', () => {
    const from: CoordinateContext = { units: 'millimetres', up: 'z', registration: { kind: 'local' } };
    const to: CoordinateContext = { units: 'metres', up: 'y', registration: { kind: 'local' } };
    const matrix = contextTransform(from, to);
    const moved = matrix === undefined ? undefined : transformPoint(matrix, [0, 0, 1000]);
    expect(moved?.[1]).toBeCloseTo(1);
    expect(contextTransform(unknownCoordinates, to)).toBeUndefined();
  });

  it('keeps unknown registration explicit', () => {
    expect(isRegistered(unknownCoordinates)).toBe(false);
    expect(isRegistered(metresZUpLocal)).toBe(false);
    expect(geographicAnchor(metresZUpLocal)).toBeUndefined();
  });

  it('reads a geographic anchor only from a geographic frame', () => {
    const anchor = { latitude: 51.5, longitude: -3.2, altitude: 12, trueNorthDegrees: 4 };
    const context: CoordinateContext = { units: 'metres', up: 'z', registration: { kind: 'geographic', anchor } };
    expect(isRegistered(context)).toBe(true);
    expect(geographicAnchor(context)).toEqual(anchor);
  });
});

describe('the coordinate frame schema', () => {
  const anchor = { latitude: 51.5, longitude: -3.2, altitude: 12, trueNorthDegrees: 4 };

  it('reads back every frame this module states, in each registration', () => {
    for (const registration of [
      { kind: 'local' },
      { kind: 'project', projectId: 'p1' },
      { kind: 'geographic', anchor },
      { kind: 'unknown' },
    ]) {
      const context = { units: 'feet', up: 'y', registration };
      expect(parse(coordinateContextSchema, context)).toEqual({ ok: true, value: context, diagnostics: [] });
    }
    expect(parse(coordinateContextSchema, metresZUpLocal).ok).toBe(true);
    expect(parse(coordinateContextSchema, unknownCoordinates).ok).toBe(true);
  });

  it('refuses a unit it does not state, and says where and what it expected', () => {
    const rejected = parse(coordinateContextSchema, { units: 'furlongs', up: 'z', registration: { kind: 'local' } });
    expect(rejected.ok).toBe(false);
    expect(rejected.diagnostics.map((item) => formatPath(item.path))).toEqual(['units']);
    expect(rejected.diagnostics[0]?.code).toBe('schema/enum');
    expect(parse(coordinateContextSchema, { units: 'metres', up: 'x', registration: { kind: 'local' } }).ok).toBe(false);
    expect(parse(coordinateContextSchema, { units: 'metres', up: 'z' }).ok).toBe(false);
  });

  it('describes its vocabularies as enums, listing exactly what the types allow', () => {
    expect(lengthUnits).toEqual(['metres', 'centimetres', 'millimetres', 'feet', 'inches', 'unknown']);
    expect(upAxes).toEqual(['y', 'z']);
    expect(lengthUnitSchema.describe()).toEqual({ type: 'string', enum: [...lengthUnits] });
    expect(upAxisSchema.describe()).toEqual({ type: 'string', enum: ['y', 'z'] });
    expect(coordinateContextSchema.describe()).toEqual({
      type: 'object',
      properties: {
        units: { type: 'string', enum: [...lengthUnits] },
        up: { type: 'string', enum: ['y', 'z'] },
        registration: registrationSchema.describe(),
      },
      required: ['units', 'up', 'registration'],
    });
  });
});
