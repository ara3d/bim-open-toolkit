import { describe, expect, it } from 'vitest';
import { transformPoint } from '../src/math.js';
import {
  contextTransform, conversionFactor, convertLength, geographicAnchor, isRegistered, metresPerUnit,
  metresZUpLocal, unitScaleMatrix, unknownCoordinates, upAxisMatrix, upVector, type CoordinateContext,
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
