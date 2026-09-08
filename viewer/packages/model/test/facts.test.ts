import { describe, expect, it } from 'vitest';
import { objectRef, type ModelRef } from '../src/identity.js';
import {
  conflicting, coverageOf, coverageRatio, emptyCoverage, fact, flag, known, knownQuantity, knownValue,
  missing, quantity, reference, text, type Evidence,
} from '../src/facts.js';

const model: ModelRef = { id: 'tower', revision: 'r1' };
const evidence: readonly Evidence[] = [{ source: 'schedule.csv', reference: 'row 12' }];

describe('facts', () => {
  it('carries evidence with a known value', () => {
    const observation = known(quantity(0.9, 'm'), evidence);
    expect(knownQuantity(observation)).toEqual({ value: 0.9, unit: 'm' });
    expect(observation.evidence).toEqual(evidence);
  });

  it('states why a value is absent instead of defaulting it', () => {
    const observation = missing('not-measured');
    expect(knownValue(observation)).toBeUndefined();
    expect(knownQuantity(observation)).toBeUndefined();
    expect(observation.kind === 'missing' ? observation.reason : undefined).toBe('not-measured');
  });

  it('keeps disagreeing sources unresolved', () => {
    const observation = conflicting([quantity(0.9, 'm'), quantity(1, 'm')], evidence);
    expect(knownValue(observation)).toBeUndefined();
    expect(observation.kind === 'conflicting' ? observation.values.length : 0).toBe(2);
  });

  it('carries every value kind', () => {
    expect(knownValue(known(text('fire door')))).toEqual({ kind: 'text', text: 'fire door' });
    expect(knownValue(known(flag(true)))).toEqual({ kind: 'flag', value: true });
    expect(knownValue(known(reference(objectRef(model, 'wall'))))?.kind).toBe('reference');
  });

  it('names the object a fact is about', () => {
    const item = fact(objectRef(model, 'door-1'), 'fireRating', missing('not-provided'));
    expect(item.subject.objectId).toBe('door-1');
    expect(item.name).toBe('fireRating');
  });

  it('counts known, missing and conflicting observations', () => {
    const coverage = coverageOf([known(quantity(1, 'm')), missing('not-provided'), conflicting([])]);
    expect(coverage).toEqual({ total: 3, known: 1, missing: 1, conflicting: 1 });
    expect(coverageRatio(coverage)).toBeCloseTo(1 / 3);
  });

  it('reports the coverage of nothing as undefined, never as zero or complete', () => {
    expect(coverageOf([])).toEqual(emptyCoverage);
    expect(coverageRatio(emptyCoverage)).toBeUndefined();
  });
});
