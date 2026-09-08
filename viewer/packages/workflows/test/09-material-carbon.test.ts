import { describe, expect, it } from 'vitest';
import { materialCarbonInputSchema, runMaterialCarbon } from '../src/09-material-carbon.js';
import { exceptionRows, resultRows } from '../src/result.js';
import { fixtureInput, fixtureModel, loadFixture, valueOfResult } from './fixtures.js';

const fixture = loadFixture('09-material-carbon');
const input = fixtureInput(materialCarbonInputSchema, fixture, { model: fixtureModel });
const result = valueOfResult('material carbon', runMaterialCarbon(input));

describe('material carbon', () => {
  it('produces the expected resolved contributions', () => {
    expect(resultRows(result, 'contributions')).toEqual(fixture.expected['contributions']);
  });

  it('produces the expected exception rows', () => {
    expect(exceptionRows(result)).toEqual(fixture.expected['exceptions']);
  });

  it('totals resolved contributions only, per scenario', () => {
    expect(result.summary['totalKnownKgCO2e']).toEqual(fixture.expected['totalKnownKgCO2e']);
  });

  it('colours an object unresolved when any scenario cannot account for it', () => {
    expect(result.rules.map((rule) => rule.id)).toEqual([
      'material-carbon/resolved',
      'material-carbon/missing',
      'material-carbon/conflicting',
    ]);
    expect(result.sets.find((set) => set.id === 'material-carbon/resolved')?.members.size).toBe(1);
    expect(result.sets.find((set) => set.id === 'material-carbon/unresolved')?.members.size).toBe(2);
  });

  it('reports a material with no factor at all as unresolved rather than as zero', () => {
    const withoutFactors = { ...input, factors: input.factors.filter((factor) => factor.materialId !== 'concrete') };
    const missing = valueOfResult('material carbon', runMaterialCarbon(withoutFactors));
    expect(resultRows(missing, 'contributions')).toEqual([]);
    expect(exceptionRows(missing)[0]).toEqual({
      subjects: ['OBJ-1'],
      field: 'factor',
      scope: 'asDesigned',
      detail: "no factor for material 'concrete' in scenario 'asDesigned'",
      kind: 'missing',
      reason: 'not-provided',
    });
    expect(missing.summary['totalKnownKgCO2e']).toEqual({});
  });
});
