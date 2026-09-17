import { describe, expect, it } from 'vitest';
import { defaultCarbonOptions, generateCarbon, type Carbon } from '@bim-open-toolkit/synthetic';
import { rowOf, type CellValue, type ModelRef } from '@bim-open-toolkit/model';
import {
  runMaterialCarbon,
  type CarbonFactor,
  type MaterialCarbonInput,
  type MaterialQuantity,
} from '../src/09-material-carbon.js';
import { missingReasons, type ObservationJson } from '../src/observation.js';
import { exceptionRows, resultRows } from '../src/result.js';
import { valueOfResult } from './fixtures.js';

// `carbon.ts` reports its material quantities as plain schedule columns rather than facts, so the
// observation is rebuilt from those columns instead of being read off a fact index.
const textAt = (value: unknown): string => (typeof value === 'string' ? value : '');
const numberAt = (value: unknown): number => (typeof value === 'number' ? value : Number.NaN);
const textOrUndefined = (value: string): string | undefined => (value === '' ? undefined : value);

const reasonAt = (value: unknown): (typeof missingReasons)[number] => {
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

// `carbon.ts` never generates a model, since it has no geometry; the workflow still needs a revision
// identity to key its result on, so one is stated here the same way the other data-only generators
// name their own synthetic model.
const modelOf = (seed: number): ModelRef => ({ id: 'synthetic-carbon', revision: `seed-${seed}` });

const materialCarbonInputOf = (carbon: Carbon): MaterialCarbonInput => {
  const quantities: readonly MaterialQuantity[] = Array.from({ length: carbon.quantities.rowCount }, (_, row) => {
    const cells = rowOf(carbon.quantities, row);
    return {
      objectId: textAt(cells['objectId']),
      materialId: textAt(cells['materialId']),
      quantity: quantityObservationOf(cells, 'quantity'),
    };
  });
  const factors: readonly CarbonFactor[] = Array.from({ length: carbon.factors.rowCount }, (_, row) => {
    const cells = rowOf(carbon.factors, row);
    return {
      id: textAt(cells['id']),
      materialId: textAt(cells['materialId']),
      scenario: textAt(cells['scenario']),
      unit: textAt(cells['unit']),
      lifecycleScope: textAt(cells['lifecycleScope']),
      factorValue: numberAt(cells['factorValue']),
    };
  });
  return {
    model: modelOf(carbon.options.seed),
    requestedLifecycleScope: carbon.requestedLifecycleScope,
    quantities,
    factors,
  };
};

const carbon = generateCarbon(defaultCarbonOptions);
const input = materialCarbonInputOf(carbon);
const result = valueOfResult('generated material carbon', runMaterialCarbon(input));

describe('material carbon on a generated set of quantities and factors', () => {
  it('reports exactly the quantity gaps the generator documents, as exceptions in every scenario', () => {
    // The factor-set gaps (timber has no factor at all, the as-designed steel factor covers the
    // wrong lifecycle scope, the low-carbon steel factor is quoted in the wrong unit, and aluminium
    // has a factor in one scenario only) are structural, fixed by the factor policy table rather
    // than scored as a `Coverage`; only the material quantity gaps are. A quantity that is not known
    // never reaches the factor-matching step, so every one of those gaps becomes an unresolved
    // contribution in every scenario the factors name.
    const quantityGaps = carbon.quantityCoverage.missing + carbon.quantityCoverage.conflicting;
    expect(quantityGaps).toBeGreaterThan(0);
    const quantityExceptions = exceptionRows(result).filter((row) => row['field'] === 'quantity');
    expect(quantityExceptions).toHaveLength(quantityGaps * carbon.scenarioIds.length);
  });

  it('never accounts for a material nobody publishes a factor for, in any scenario', () => {
    const ratedMaterials = new Set(input.factors.map((factor) => factor.materialId));
    const unratedIds = input.quantities.filter((item) => !ratedMaterials.has(item.materialId)).map((item) => item.objectId);
    expect(unratedIds.length).toBeGreaterThan(0);
    const resolvedIds = new Set(resultRows(result, 'contributions').map((row) => row['objectId']));
    for (const id of unratedIds) expect(resolvedIds.has(id)).toBe(false);
  });

  it('leaves only the factor set\'s own structural gaps once the generator has no quantity gaps to report', () => {
    const complete = generateCarbon({ ...defaultCarbonOptions, gapScale: 0 });
    expect(complete.quantityCoverage.missing + complete.quantityCoverage.conflicting).toBe(0);
    const completeResult = valueOfResult(
      'generated material carbon (complete)',
      runMaterialCarbon(materialCarbonInputOf(complete)),
    );
    // `gapScale` only governs the material quantities; the factor set's own gaps are a fact about
    // the factor policy table and stay whatever it states, as the generator's own comment says.
    expect(exceptionRows(completeResult).length).toBeGreaterThan(0);
    expect(exceptionRows(completeResult).every((row) => row['field'] === 'factor')).toBe(true);
  });
});
