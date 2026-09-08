import { describe, expect, it } from 'vitest';
import { runTakeoff, takeoffInputSchema } from '../src/03-takeoff.js';
import { exceptionRows, resultRows } from '../src/result.js';
import { fixtureInput, fixtureModel, loadFixture, valueOfResult } from './fixtures.js';

const fixture = loadFixture('03-takeoff');
const input = fixtureInput(takeoffInputSchema, fixture, { model: fixtureModel });
const result = valueOfResult('takeoff', runTakeoff(input));

describe('takeoff', () => {
  it('produces the expected finish-type subtotals', () => {
    expect(resultRows(result, 'subtotals')).toEqual(fixture.expected['subtotals']);
  });

  it('produces the expected grand total of known area', () => {
    expect(result.summary['totalKnownM2']).toEqual(fixture.expected['totalKnownM2']);
  });

  it('produces the expected exception rows', () => {
    expect(exceptionRows(result)).toEqual(fixture.expected['exceptions']);
  });

  it('withholds a subtotal whose areas are not all reported in one unit', () => {
    const mixed = {
      ...input,
      surfaces: input.surfaces.map((surface) =>
        surface.objectId === 'S-4'
          ? { ...surface, areaM2: { kind: 'known', value: 5, unit: 'ft2' } as const }
          : surface,
      ),
    };
    const result2 = valueOfResult('takeoff', runTakeoff(mixed));
    expect(resultRows(result2, 'subtotals').map((row) => row['finishType'])).toEqual(['Carpet']);
    expect(result2.summary['totalKnownM2']).toBe(39);
    const withheld = exceptionRows(result2).find((row) => row['field'] === 'areaM2' && row['reason'] === 'unresolved-source');
    expect(withheld).toEqual({
      subjects: ['S-4', 'S-9'],
      field: 'areaM2',
      detail: "areas for finish type 'Tile' are reported in more than one unit: ft2, m2",
      kind: 'missing',
      reason: 'unresolved-source',
    });
  });

  it('omits a finish type with no surface reporting a known area, rather than a zero subtotal', () => {
    expect(resultRows(result, 'subtotals').map((row) => row['finishType'])).not.toContain('Vinyl');
  });

  it('refuses a surfaces table that repeats an id rather than losing a row', () => {
    const repeated = runTakeoff({ ...input, surfaces: [...input.surfaces, ...input.surfaces.slice(0, 1)] });
    expect(repeated.ok).toBe(false);
    expect(repeated.diagnostics.map((item) => item.code)).toEqual(['workflow/duplicate-id']);
  });
});
