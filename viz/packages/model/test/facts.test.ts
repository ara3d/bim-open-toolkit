import { describe, expect, it } from 'vitest';
import { objectRef, type ModelRef, type ObjectRef } from '../src/identity.js';
import {
  bounds, completeFacts, conflicting, conflictingFacts, coverageByName, coverageOf, coverageOfFacts,
  coverageRatio, emptyCoverage, fact, flag, indexFacts, known, knownBounds, knownQuantity, knownValue,
  lookupFact, mergeObservations, missing, observationAt, observedValues, quantity, reconcile, reference,
  reportedUnits, sameFactValue, sumQuantities, text, unknownFacts, withEvidence, type Evidence,
} from '../src/facts.js';
import type { Bounds } from '../src/math.js';

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

const door = (id: string): ObjectRef => ({ modelId: 'm', revision: 'r1', objectId: id });
const drawing: Evidence = { source: 'drawing A-101' };
const survey: Evidence = { source: 'site survey' };

describe('fact values and observations', () => {
  it('compares values, quantities only when the units agree too', () => {
    expect(sameFactValue(quantity(0.9, 'm'), quantity(0.9, 'm'))).toBe(true);
    expect(sameFactValue(quantity(0.9, 'm'), quantity(0.9, 'ft'))).toBe(false);
    expect(sameFactValue(text('EI30'), text('EI30'))).toBe(true);
    expect(sameFactValue(flag(true), flag(false))).toBe(false);
    expect(sameFactValue(reference(door('1')), reference(door('1')))).toBe(true);
    expect(sameFactValue(text('a'), flag(true))).toBe(false);
  });

  it('reports the values an observation carries', () => {
    expect(observedValues(known(text('a')))).toEqual([text('a')]);
    expect(observedValues(missing('not-measured'))).toEqual([]);
    expect(observedValues(conflicting([text('a'), text('b')]))).toHaveLength(2);
  });

  it('records more evidence without changing the value', () => {
    const observation = withEvidence(known(text('a'), [drawing]), [survey]);
    expect(observation.evidence).toEqual([drawing, survey]);
    expect(knownValue(observation)).toEqual(text('a'));
  });

  it('reduces agreeing values to one and disagreeing values to a conflict', () => {
    expect(reconcile([quantity(1, 'm'), quantity(1, 'm')])).toEqual(known(quantity(1, 'm')));
    expect(reconcile([quantity(1, 'm'), quantity(2, 'm')]).kind).toBe('conflicting');
    expect(reconcile([], [], 'not-measured')).toEqual(missing('not-measured'));
  });

  it('merges two observations of the same thing, keeping a disagreement visible', () => {
    expect(mergeObservations(known(text('a'), [drawing]), known(text('a'), [survey]))).toEqual(
      known(text('a'), [drawing, survey]),
    );
    expect(mergeObservations(known(text('a')), known(text('b'))).kind).toBe('conflicting');
    expect(mergeObservations(missing('not-provided'), known(text('a')))).toEqual(known(text('a')));
    expect(mergeObservations(missing('not-applicable'), missing('not-provided'))).toEqual(
      missing('not-applicable'),
    );
  });
});

const boxA: Bounds = { min: [0, 0, 0], max: [1, 2, 3] };
const boxB: Bounds = { min: [0, 0, 0], max: [1, 2, 4] };

describe('box-valued observations', () => {
  it('carries a box as a value and reads it back', () => {
    expect(bounds(boxA)).toEqual({ kind: 'bounds', bounds: boxA });
    expect(knownBounds(known(bounds(boxA)))).toEqual(boxA);
  });

  it('reads a box back only from a known box observation', () => {
    expect(knownBounds(missing('not-measured'))).toBeUndefined();
    expect(knownBounds(conflicting([bounds(boxA), bounds(boxB)]))).toBeUndefined();
    expect(knownBounds(known(quantity(1, 'm')))).toBeUndefined();
    expect(knownQuantity(known(bounds(boxA)))).toBeUndefined();
  });

  it('compares boxes corner by corner, and never across kinds', () => {
    expect(sameFactValue(bounds(boxA), bounds({ min: [0, 0, 0], max: [1, 2, 3] }))).toBe(true);
    expect(sameFactValue(bounds(boxA), bounds(boxB))).toBe(false);
    expect(sameFactValue(bounds(boxA), text('0 0 0'))).toBe(false);
    expect(sameFactValue(text('0 0 0'), bounds(boxA))).toBe(false);
  });

  it('reconciles agreeing boxes and keeps disagreeing ones as a conflict', () => {
    expect(reconcile([bounds(boxA), bounds(boxA)])).toEqual(known(bounds(boxA)));
    const disputed = reconcile([bounds(boxA), bounds(boxB)], [drawing]);
    expect(disputed).toEqual(conflicting([bounds(boxA), bounds(boxB)], [drawing]));
    expect(knownBounds(disputed)).toBeUndefined();
  });

  it('merges two sources of a box, keeping a disagreement visible', () => {
    expect(mergeObservations(known(bounds(boxA), [drawing]), known(bounds(boxA), [survey]))).toEqual(
      known(bounds(boxA), [drawing, survey]),
    );
    expect(mergeObservations(known(bounds(boxA)), known(bounds(boxB))).kind).toBe('conflicting');
  });

  it('counts a box like any other observation and never totals it as a quantity', () => {
    const boxes = [fact(door('1'), 'bbox', known(bounds(boxA))), fact(door('2'), 'bbox', missing('not-provided'))];
    expect(coverageOfFacts(boxes)).toEqual({ total: 2, known: 1, missing: 1, conflicting: 0 });
    expect(reportedUnits(boxes)).toEqual([]);
    expect(sumQuantities(boxes)).toBeUndefined();
  });
});

describe('fact lookup and reporting', () => {
  const facts = [
    fact(door('1'), 'width', known(quantity(0.9, 'm'), [drawing])),
    fact(door('1'), 'fireRating', known(text('EI30'))),
    fact(door('2'), 'width', known(quantity(1.2, 'm'))),
    fact(door('2'), 'width', known(quantity(1.1, 'm'), [survey])),
    fact(door('3'), 'width', missing('not-measured')),
  ];
  const index = indexFacts(facts);

  it('finds a fact by subject and name', () => {
    expect(knownQuantity(observationAt(index, door('1'), 'width'))).toEqual({ value: 0.9, unit: 'm' });
    expect(lookupFact(index, door('9'), 'width')).toBeUndefined();
  });

  it('reads nothing recorded as missing, never as absent data', () => {
    expect(observationAt(index, door('9'), 'width')).toEqual(missing('not-provided'));
  });

  it('turns two sources that disagree into a conflict when indexing', () => {
    const observation = observationAt(index, door('2'), 'width');
    expect(observation.kind).toBe('conflicting');
    expect(observation.evidence).toEqual([survey]);
  });

  it('gives a row for every subject and name, stating the gaps', () => {
    const complete = completeFacts(index, [door('1'), door('9')], ['width', 'fireRating']);
    expect(complete).toHaveLength(4);
    expect(complete[3]?.observation).toEqual(missing('not-provided'));
    expect(coverageOfFacts(complete)).toEqual({ total: 4, known: 2, missing: 2, conflicting: 0 });
  });

  it('reports coverage per name so a report can say which column has gaps', () => {
    const complete = completeFacts(index, [door('1'), door('2'), door('3')], ['width', 'fireRating']);
    expect(coverageByName(complete).get('width')).toEqual({ total: 3, known: 1, missing: 1, conflicting: 1 });
    expect(coverageByName(complete).get('fireRating')).toEqual({ total: 3, known: 1, missing: 2, conflicting: 0 });
  });

  it('lists the exceptions', () => {
    const complete = completeFacts(index, [door('1'), door('2'), door('3')], ['width']);
    expect(unknownFacts(complete).map((item) => item.subject.objectId)).toEqual(['2', '3']);
    expect(conflictingFacts(complete).map((item) => item.subject.objectId)).toEqual(['2']);
  });

  it('refuses to total quantities that do not share a unit', () => {
    const metres = [fact(door('1'), 'area', known(quantity(2, 'm2'))), fact(door('2'), 'area', known(quantity(3, 'm2')))];
    expect(sumQuantities(metres)).toEqual({ value: 5, unit: 'm2' });
    expect(reportedUnits(metres)).toEqual(['m2']);
    const mixed = [...metres, fact(door('3'), 'area', known(quantity(4, 'ft2')))];
    expect(reportedUnits(mixed)).toEqual(['m2', 'ft2']);
    expect(sumQuantities(mixed)).toBeUndefined();
    expect(sumQuantities([])).toBeUndefined();
  });

  it('leaves an unknown value out of a total instead of counting it as zero', () => {
    const some = [fact(door('1'), 'area', known(quantity(2, 'm2'))), fact(door('2'), 'area', missing('not-measured'))];
    expect(sumQuantities(some)).toEqual({ value: 2, unit: 'm2' });
    expect(coverageRatio(coverageOfFacts(some))).toBe(0.5);
  });
});
