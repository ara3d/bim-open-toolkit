import { describe, expect, it } from 'vitest';
import { generateQuantities, defaultQuantityOptions, type Quantities } from '@bim-open-toolkit/synthetic';
import { indexFacts, knownQuantity, objectRef, observationAt, rowOf, type Observation } from '@bim-open-toolkit/model';
import { runTakeoff, type TakeoffInput, type TakeoffSurface } from '../src/03-takeoff.js';
import { observationJson } from '../src/observation.js';
import { exceptionRows, resultRows } from '../src/result.js';
import { valueOfResult } from './fixtures.js';

const textAt = (value: unknown): string => (typeof value === 'string' ? value : '');

// The generated surfaces table carries the links and the provenance; the observations come from the
// facts, so nothing here re-reads the generator's own state and value columns.
const takeoffInput = (quantities: Quantities): TakeoffInput => {
  const index = indexFacts(quantities.facts);
  const surfaces: readonly TakeoffSurface[] = Array.from({ length: quantities.surfaces.rowCount }, (_, row) => {
    const cells = rowOf(quantities.surfaces, row);
    const ref = objectRef(quantities.model.ref, textAt(cells['objectId']));
    return {
      objectId: ref.objectId,
      roomId: textAt(cells['roomId']),
      finishType: observationJson(observationAt(index, ref, 'finishType')),
      areaM2: observationJson(observationAt(index, ref, 'areaM2')),
      basis: textAt(cells['basis']),
    };
  });
  return { model: quantities.model.ref, surfaces };
};

const quantities = generateQuantities(defaultQuantityOptions);
const input = takeoffInput(quantities);
const result = valueOfResult('generated takeoff', runTakeoff(input));
const gapsOf = (coverage: { readonly missing: number; readonly conflicting: number }): number =>
  coverage.missing + coverage.conflicting;

const observationOfSurface = (surface: TakeoffSurface, name: 'finishType' | 'areaM2'): Observation =>
  observationAt(indexFacts(quantities.facts), objectRef(quantities.model.ref, surface.objectId), name);

describe('the takeoff on a generated set of finish faces', () => {
  it('reports exactly the gaps the generator documents, one per offending field', () => {
    expect(exceptionRows(result)).toHaveLength(gapsOf(quantities.finishCoverage) + gapsOf(quantities.areaCoverage));
    expect(gapsOf(quantities.finishCoverage) + gapsOf(quantities.areaCoverage)).toBeGreaterThan(0);
  });

  it('totals only the surfaces whose finish type and area are both known', () => {
    const expected = input.surfaces
      .filter((surface) => observationOfSurface(surface, 'finishType').kind === 'known')
      .flatMap((surface) => {
        const quantity = knownQuantity(observationOfSurface(surface, 'areaM2'));
        return quantity === undefined ? [] : [quantity.value];
      })
      .reduce((sum, value) => sum + value, 0);
    expect(result.summary['totalKnownM2']).toBeCloseTo(expected, 9);
  });

  it('emits a subtotal only for a finish type something contributed to', () => {
    const rows = resultRows(result, 'subtotals');
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row['surfaceCount']).not.toBe(0);
      expect(row['unit']).toBe('m2');
    }
  });

  it('has nothing to report when the generator is asked for a complete takeoff', () => {
    const complete = generateQuantities({ ...defaultQuantityOptions, gapScale: 0 });
    const completeResult = valueOfResult('generated takeoff', runTakeoff(takeoffInput(complete)));
    expect(exceptionRows(completeResult)).toEqual([]);
  });
});
