import { describe, expect, it } from 'vitest';
import { defaultCostOptions, generateCosts, type Costs } from '@bim-open-toolkit/synthetic';
import { rowOf, type CellValue, type MissingReason, type ModelRef } from '@bim-open-toolkit/model';
import {
  runPricingAlternatives,
  type PricingAlternativesInput,
  type PricingRate,
  type PricingScenario,
  type PricingScope,
} from '../src/04-pricing-alternatives.js';
import { missingReasons, type ObservationJson } from '../src/observation.js';
import { exceptionRows, resultRows } from '../src/result.js';
import { valueOfResult } from './fixtures.js';

// `costs.ts` reports its scope quantities as plain schedule columns rather than facts, so the
// observation is rebuilt from those columns instead of being read off a fact index.
const textAt = (value: unknown): string => (typeof value === 'string' ? value : '');
const numberAt = (value: unknown): number => (typeof value === 'number' ? value : Number.NaN);
const textOrUndefined = (value: string): string | undefined => (value === '' ? undefined : value);
const reasonAt = (value: unknown): MissingReason => {
  const text = textAt(value);
  const found = missingReasons.find((reason) => reason === text);
  return found ?? 'not-provided';
};

const quantityObservationOf = (cells: Readonly<Record<string, CellValue>>, name: string): ObservationJson => {
  const state = textAt(cells[`${name}State`]);
  const unit = textOrUndefined(textAt(cells[`${name}Unit`]));
  if (state === 'known') return { kind: 'known', value: numberAt(cells[name]), unit };
  if (state === 'conflicting') {
    const values = textAt(cells[`${name}Conflict`])
      .split(' vs ')
      .map((part) => Number.parseFloat(part));
    return { kind: 'conflicting', values, unit };
  }
  return { kind: 'missing', reason: reasonAt(cells[`${name}MissingReason`]) };
};

// `costs.ts` never generates a model, since it has no geometry; the pricing workflow still needs a
// revision identity to key its result on, so one is stated here the same way the other generators
// name their own synthetic model.
const modelOf = (seed: number): ModelRef => ({ id: 'synthetic-costs', revision: `seed-${seed}` });

const pricingInputOf = (costs: Costs): PricingAlternativesInput => {
  const scopes: readonly PricingScope[] = Array.from({ length: costs.scopes.rowCount }, (_, row) => {
    const cells = rowOf(costs.scopes, row);
    return {
      objectId: textAt(cells['objectId']),
      scopeType: textAt(cells['scopeType']),
      quantity: quantityObservationOf(cells, 'quantity'),
    };
  });
  const rates: readonly PricingRate[] = Array.from({ length: costs.rates.rowCount }, (_, row) => {
    const cells = rowOf(costs.rates, row);
    return {
      id: textAt(cells['id']),
      scopeType: textAt(cells['scopeType']),
      scenario: textAt(cells['scenario']),
      currency: textAt(cells['currency']),
      unit: textAt(cells['unit']),
      ratePerUnit: numberAt(cells['ratePerUnit']),
    };
  });
  const scenarios: readonly PricingScenario[] = Array.from({ length: costs.scenarios.rowCount }, (_, row) => {
    const cells = rowOf(costs.scenarios, row);
    return { id: textAt(cells['id']), name: textAt(cells['name']) };
  });
  return { model: modelOf(costs.options.seed), scopes, rates, scenarios };
};

const costs = generateCosts(defaultCostOptions);
const input = pricingInputOf(costs);
const result = valueOfResult('generated pricing alternatives', runPricingAlternatives(input));

describe('pricing alternatives on a generated rate set', () => {
  it('reports exactly the quantity gaps the generator documents, as exceptions in every scenario', () => {
    // The rate coverage gaps (Steelwork priced nowhere, Paint missing from `alternate`, the alternate
    // Carpet unit mismatch, and the duplicate `value`-scenario Doors rate) are structural, fixed by
    // the rate policy table rather than scored as a `Coverage`; only the scope quantity gaps are.
    // A scope whose own quantity is not known never reaches the rate-matching step, so every one of
    // those gaps becomes an unpriced exception in all three scenarios.
    const quantityGaps = costs.quantityCoverage.missing + costs.quantityCoverage.conflicting;
    expect(quantityGaps).toBeGreaterThan(0);
    const quantityExceptions = exceptionRows(result).filter((row) => row['field'] === 'quantity');
    expect(quantityExceptions).toHaveLength(quantityGaps * input.scenarios.length);
  });

  it('never prices a scope type nobody quotes a rate for, in any scenario', () => {
    const ratedTypes = new Set(input.rates.map((rate) => rate.scopeType));
    const unratedScopeIds = input.scopes.filter((scope) => !ratedTypes.has(scope.scopeType)).map((scope) => scope.objectId);
    expect(unratedScopeIds.length).toBeGreaterThan(0);
    const pricedIds = new Set(resultRows(result, 'priced').map((row) => row['objectId']));
    for (const id of unratedScopeIds) expect(pricedIds.has(id)).toBe(false);
  });

  it('leaves only the rate set\'s own structural gaps once the generator has no quantity gaps to report', () => {
    const complete = generateCosts({ ...defaultCostOptions, gapScale: 0 });
    expect(complete.quantityCoverage.missing + complete.quantityCoverage.conflicting).toBe(0);
    const completeResult = valueOfResult(
      'generated pricing alternatives (complete)',
      runPricingAlternatives(pricingInputOf(complete)),
    );
    // `gapScale` only governs the scope quantities; the rate set's own gaps are a fact about the
    // rate policy table and stay whatever it states, as the generator's own comment says.
    expect(exceptionRows(completeResult).length).toBeGreaterThan(0);
    expect(exceptionRows(completeResult).every((row) => row['field'] === 'rate')).toBe(true);
  });
});
