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

  it('omits a finish type with no surface reporting a known area, rather than a zero subtotal', () => {
    expect(resultRows(result, 'subtotals').map((row) => row['finishType'])).not.toContain('Vinyl');
  });

  it('refuses a surfaces table that repeats an id rather than losing a row', () => {
    const repeated = runTakeoff({ ...input, surfaces: [...input.surfaces, ...input.surfaces.slice(0, 1)] });
    expect(repeated.ok).toBe(false);
    expect(repeated.diagnostics.map((item) => item.code)).toEqual(['workflow/duplicate-id']);
  });
});
