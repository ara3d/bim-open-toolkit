import { describe, expect, it } from 'vitest';
import { runValveIsolation, valveIsolationInputSchema } from '../src/06-valve-isolation.js';
import { exceptionRows, resultRows } from '../src/result.js';
import { fixtureInput, fixtureModel, loadFixture, valueOfResult } from './fixtures.js';

const fixture = loadFixture('06-valve-isolation');
const input = fixtureInput(valveIsolationInputSchema, fixture, { model: fixtureModel });
const result = valueOfResult('valve isolation', runValveIsolation(input));

describe('valve isolation trace', () => {
  it('produces the expected affected rows', () => {
    expect(resultRows(result, 'affected')).toEqual(fixture.expected['affected']);
  });

  it('produces the expected trace-coverage exception rows', () => {
    expect(exceptionRows(result)).toEqual(fixture.expected['exceptions']);
  });

  it('refuses a segments table that repeats an id rather than losing a row', () => {
    const repeated = runValveIsolation({ ...input, segments: [...input.segments, ...input.segments.slice(0, 1)] });
    expect(repeated.ok).toBe(false);
    expect(repeated.diagnostics.map((item) => item.code)).toEqual(['workflow/duplicate-id']);
  });
});
