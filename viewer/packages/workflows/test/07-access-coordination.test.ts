import { describe, expect, it } from 'vitest';
import { accessCoordinationInputSchema, runAccessCoordination } from '../src/07-access-coordination.js';
import { exceptionRows, resultRows } from '../src/result.js';
import { fixtureInput, fixtureModel, loadFixture, valueOfResult } from './fixtures.js';

const fixture = loadFixture('07-access-coordination');
const input = fixtureInput(accessCoordinationInputSchema, fixture, { model: fixtureModel });
const result = valueOfResult('access coordination', runAccessCoordination(input));

describe('access coordination', () => {
  it('produces the expected candidate finding rows', () => {
    expect(resultRows(result, 'candidateFindings')).toEqual(fixture.expected['candidateFindings']);
  });

  it('produces the expected coordination-gap exception rows', () => {
    expect(exceptionRows(result)).toEqual(fixture.expected['exceptions']);
  });

  it('states every finding as a candidate and never as a verified clash', () => {
    for (const row of resultRows(result, 'candidateFindings')) expect(row['basis']).toBe('bounding-box-overlap');
    expect(result.rules.map((rule) => rule.id)).toEqual([
      'access-coordination/candidate',
      'access-coordination/missing',
    ]);
    expect(result.overlays.every((overlay) => overlay.outcome === 'candidate')).toBe(true);
    expect(JSON.stringify(result.tables).toLowerCase()).not.toContain('clash');
  });

  it('refuses an envelopes table that repeats an id rather than losing a row', () => {
    const repeated = runAccessCoordination({ ...input, envelopes: [...input.envelopes, ...input.envelopes.slice(0, 1)] });
    expect(repeated.ok).toBe(false);
    expect(repeated.diagnostics.map((item) => item.code)).toEqual(['workflow/duplicate-id']);
  });
});
