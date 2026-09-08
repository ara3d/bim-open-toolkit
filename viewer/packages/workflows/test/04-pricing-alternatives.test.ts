import { describe, expect, it } from 'vitest';
import { pricingAlternativesInputSchema, runPricingAlternatives } from '../src/04-pricing-alternatives.js';
import { exceptionRows, resultRows } from '../src/result.js';
import { fixtureInput, fixtureModel, loadFixture, valueOfResult } from './fixtures.js';

const fixture = loadFixture('04-pricing-alternatives');
const input = fixtureInput(pricingAlternativesInputSchema, fixture, { model: fixtureModel });
const result = valueOfResult('pricing alternatives', runPricingAlternatives(input));

describe('pricing alternatives', () => {
  it('produces the expected priced rows', () => {
    expect(resultRows(result, 'priced')).toEqual(fixture.expected['priced']);
  });

  it('produces the expected exception rows', () => {
    expect(exceptionRows(result)).toEqual(fixture.expected['exceptions']);
  });

  it('prices the same scope type differently per scenario without converting currency', () => {
    const rows = resultRows(result, 'priced');
    expect(rows.filter((row) => row['objectId'] === 'SC-Doors').map((row) => row['cost'])).toEqual([1800, 2100]);
  });

  it('reports a unit mismatch as unresolved-source rather than pricing it', () => {
    const carpetException = exceptionRows(result).find((row) => {
      const subjects = row['subjects'];
      return row['field'] === 'rate' && Array.isArray(subjects) && subjects.includes('SC-Carpet');
    });
    expect(carpetException?.['reason']).toBe('unresolved-source');
  });

  it('leaves a scope with two rates of the right unit unpriced rather than taking the first', () => {
    const ambiguous = {
      ...input,
      rates: [
        ...input.rates,
        { id: 'r5', scopeType: 'Doors', scenario: 'base', currency: 'USD', unit: 'ea', ratePerUnit: 160 },
      ],
    };
    const result2 = valueOfResult('pricing alternatives', runPricingAlternatives(ambiguous));
    expect(
      resultRows(result2, 'priced').filter((row) => row['objectId'] === 'SC-Doors' && row['scenario'] === 'base'),
    ).toEqual([]);
    expect(exceptionRows(result2)[0]).toEqual({
      subjects: ['SC-Doors'],
      field: 'rate',
      scope: 'base',
      detail: '2 rates matched this scope, scenario and unit',
      kind: 'missing',
      reason: 'unresolved-source',
    });
  });

  it('refuses a scopes table that repeats an id rather than losing a row', () => {
    const repeated = runPricingAlternatives({ ...input, scopes: [...input.scopes, ...input.scopes.slice(0, 1)] });
    expect(repeated.ok).toBe(false);
    expect(repeated.diagnostics.map((item) => item.code)).toEqual(['workflow/duplicate-id']);
  });
});
