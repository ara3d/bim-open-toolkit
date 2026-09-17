// Pricing and carbon: determinism, and the unpriced and unresolved cases that must be present on
// every run rather than on some seeds.

import { describe, expect, it } from 'vitest';
import { columnOf, type Table } from '@bim-open-toolkit/model';
import { defaultCarbonOptions, generateCarbon } from '../src/carbon.js';
import { defaultCostOptions, generateCosts } from '../src/costs.js';

const strings = (source: Table, name: string): readonly string[] => {
  const column = columnOf(source, name);
  return column === undefined || column.type !== 'string' ? [] : [...column.values];
};

const numbers = (source: Table, name: string): readonly number[] => {
  const column = columnOf(source, name);
  return column === undefined || column.type !== 'f64' ? [] : [...column.values];
};

// The scope types priced by one scenario, in the unit each rate is quoted in.
const ratesOf = (costs: ReturnType<typeof generateCosts>, scenario: string): readonly string[] => {
  const scenarios = strings(costs.rates, 'scenario');
  return strings(costs.rates, 'scopeType').filter((_, row) => scenarios[row] === scenario);
};

const costs = generateCosts(defaultCostOptions);
const carbon = generateCarbon(defaultCarbonOptions);

describe('generateCosts', () => {
  it('is a function of its options alone', () => {
    const again = generateCosts(defaultCostOptions);
    expect(numbers(again.rates, 'ratePerUnit')).toEqual(numbers(costs.rates, 'ratePerUnit'));
    expect(numbers(again.scopes, 'quantity')).toEqual(numbers(costs.scopes, 'quantity'));
  });

  it('produces one row per scope and covers every scope type', () => {
    expect(costs.scopes.rowCount).toBe(defaultCostOptions.scopes);
    expect(new Set(strings(costs.scopes, 'scopeType')).size).toBe(7);
  });

  it('leaves one scope type priced by no scenario at all', () => {
    const priced = new Set(strings(costs.rates, 'scopeType'));
    const unpriced = [...new Set(strings(costs.scopes, 'scopeType'))].filter((type) => !priced.has(type));
    expect(unpriced).toEqual(['Steelwork']);
  });

  it('quotes one rate in a unit its scope is not measured in', () => {
    const types = strings(costs.rates, 'scopeType');
    const units = strings(costs.rates, 'unit');
    const scenarios = strings(costs.rates, 'scenario');
    const mismatched = types.filter((type, row) => type === 'Carpet' && units[row] === 'ea');
    expect(mismatched.length).toBe(1);
    expect(scenarios[types.findIndex((type, row) => type === 'Carpet' && units[row] === 'ea')]).toBe('alternate');
  });

  it('quotes one scenario in another currency', () => {
    const currencies = strings(costs.scenarios, 'currency');
    expect(new Set(currencies)).toEqual(new Set(['USD', 'EUR']));
  });

  it('matches one scope type twice in one scenario', () => {
    const value = ratesOf(costs, 'value');
    expect(value.filter((type) => type === 'Doors').length).toBe(2);
  });

  it('prices a scope type in one scenario and not another', () => {
    expect(ratesOf(costs, 'base')).toContain('Paint');
    expect(ratesOf(costs, 'alternate')).not.toContain('Paint');
  });

  it('reports an unmeasured quantity as NaN, never as zero', () => {
    const values = numbers(costs.scopes, 'quantity');
    const states = strings(costs.scopes, 'quantityState');
    values.forEach((value, row) => {
      if (states[row] === 'known') expect(value).toBeGreaterThan(0);
      else expect(Number.isNaN(value)).toBe(true);
    });
    expect(states.filter((state) => state === 'missing').length).toBeGreaterThan(0);
    expect(states.filter((state) => state === 'conflicting').length).toBeGreaterThan(0);
  });

  it('keeps the structural gaps at gapScale zero', () => {
    const complete = generateCosts({ ...defaultCostOptions, gapScale: 0 });
    expect(strings(complete.scopes, 'quantityState').every((state) => state === 'known')).toBe(true);
    // Nobody prices steelwork whatever the gap scale: an absent rate is a fact about the rate set.
    expect(new Set(strings(complete.rates, 'scopeType')).has('Steelwork')).toBe(false);
  });

  it('refuses options it cannot build', () => {
    expect(() => generateCosts({ ...defaultCostOptions, scopes: 0 })).toThrow(/scopes/);
  });
});

describe('generateCarbon', () => {
  it('is a function of its options alone', () => {
    const again = generateCarbon(defaultCarbonOptions);
    expect(numbers(again.factors, 'factorValue')).toEqual(numbers(carbon.factors, 'factorValue'));
    expect(numbers(again.quantities, 'quantity')).toEqual(numbers(carbon.quantities, 'quantity'));
  });

  it('produces one row per object and covers every material', () => {
    expect(carbon.quantities.rowCount).toBe(defaultCarbonOptions.objects);
    expect(new Set(strings(carbon.quantities, 'materialId'))).toEqual(new Set(carbon.materialIds));
  });

  it('leaves one material with no factor in either scenario', () => {
    const covered = new Set(strings(carbon.factors, 'materialId'));
    expect(carbon.materialIds.filter((id) => !covered.has(id))).toEqual(['timber']);
  });

  it('publishes one factor for a lifecycle scope nobody asked for', () => {
    const scopes = strings(carbon.factors, 'lifecycleScope');
    const wrong = scopes.filter((scope) => scope !== carbon.requestedLifecycleScope);
    expect(wrong).toEqual(['A1-A5']);
  });

  it('publishes one factor in a unit its quantity is not measured in', () => {
    const materials = strings(carbon.factors, 'materialId');
    const units = strings(carbon.factors, 'unit');
    const scenarios = strings(carbon.factors, 'scenario');
    const row = materials.findIndex((id, index) => id === 'steel' && scenarios[index] === 'lowCarbonAlt');
    expect(units[row]).toBe('t');
  });

  it('covers a material in one scenario only', () => {
    const materials = strings(carbon.factors, 'materialId');
    const scenarios = strings(carbon.factors, 'scenario');
    const aluminium = scenarios.filter((_, row) => materials[row] === 'aluminium');
    expect(aluminium).toEqual(['asDesigned']);
  });

  it('reports an unknown quantity as NaN, never as zero', () => {
    const values = numbers(carbon.quantities, 'quantity');
    const states = strings(carbon.quantities, 'quantityState');
    values.forEach((value, row) => {
      if (states[row] === 'known') expect(value).toBeGreaterThan(0);
      else expect(Number.isNaN(value)).toBe(true);
    });
    expect(states.filter((state) => state !== 'known').length).toBeGreaterThan(0);
  });

  it('has a coverage that agrees with the state column', () => {
    const states = strings(carbon.quantities, 'quantityState');
    expect(carbon.quantityCoverage.total).toBe(states.length);
    expect(carbon.quantityCoverage.known).toBe(states.filter((state) => state === 'known').length);
  });

  it('refuses options it cannot build', () => {
    expect(() => generateCarbon({ ...defaultCarbonOptions, objects: 0 })).toThrow(/objects/);
    expect(() => generateCarbon({ ...defaultCarbonOptions, requestedLifecycleScope: '' })).toThrow(/lifecycle/);
  });
});
