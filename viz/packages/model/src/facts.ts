import { objectKey, sameObject, type ObjectKey, type ObjectRef } from './identity.js';
import { sameBounds, type Bounds } from './math.js';

// Why a value is not available. A missing value is never reported as zero or as a default.
export type MissingReason =
  | 'not-provided'
  | 'not-applicable'
  | 'not-measured'
  | 'unresolved-source'
  | 'out-of-scope';

// Where an observation came from, so a reader can check it.
export type Evidence = {
  readonly source: string;
  readonly reference?: string | undefined;
  readonly recordedAt?: string | undefined;
};

// A number with the unit it is expressed in. Units are strings so any domain can use this.
export type Quantity = {
  readonly value: number;
  readonly unit: string;
};

// The value an observation carries. Adding a kind here is a revision, not an addition: a reader that
// ends a chain of kind tests with the last kind it knows stops compiling, which is why every kind
// added costs one line in each such reader. Name the kinds you read and answer for the rest, as
// `sameFactValue` does, and a later kind leaves you compiling.
export type FactValue =
  | { readonly kind: 'quantity'; readonly quantity: Quantity }
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'flag'; readonly value: boolean }
  | { readonly kind: 'reference'; readonly ref: ObjectRef }
  | { readonly kind: 'bounds'; readonly bounds: Bounds };

// What is known about one value: a value, a reason it is absent, or sources that disagree.
export type Observation =
  | { readonly kind: 'known'; readonly value: FactValue; readonly evidence: readonly Evidence[] }
  | { readonly kind: 'missing'; readonly reason: MissingReason; readonly evidence: readonly Evidence[] }
  | { readonly kind: 'conflicting'; readonly values: readonly FactValue[]; readonly evidence: readonly Evidence[] };

// One named observation about one object.
export type Fact = {
  readonly subject: ObjectRef;
  readonly name: string;
  readonly observation: Observation;
};

// How complete a set of observations is. `known`, `missing` and `conflicting` sum to `total`.
export type Coverage = {
  readonly total: number;
  readonly known: number;
  readonly missing: number;
  readonly conflicting: number;
};

// A quantity value.
export const quantity = (value: number, unit: string): FactValue => ({ kind: 'quantity', quantity: { value, unit } });

// A text value.
export const text = (value: string): FactValue => ({ kind: 'text', text: value });

// A yes or no value.
export const flag = (value: boolean): FactValue => ({ kind: 'flag', value });

// A value that points at another object.
export const reference = (ref: ObjectRef): FactValue => ({ kind: 'reference', ref });

// A box-valued observation: where something is, as an axis-aligned box in a stated frame. The frame
// is not carried here, so a reader compares boxes only within one frame, as it does units.
export const bounds = (value: Bounds): FactValue => ({ kind: 'bounds', bounds: value });

// An observation with a value and the evidence for it.
export const known = (value: FactValue, evidence: readonly Evidence[] = []): Observation => ({
  kind: 'known',
  value,
  evidence,
});

// An observation with no value and a stated reason.
export const missing = (reason: MissingReason, evidence: readonly Evidence[] = []): Observation => ({
  kind: 'missing',
  reason,
  evidence,
});

// An observation whose sources disagree. It is never silently reduced to one of the values.
export const conflicting = (values: readonly FactValue[], evidence: readonly Evidence[] = []): Observation => ({
  kind: 'conflicting',
  values,
  evidence,
});

// The value of an observation, or undefined when it is missing or conflicting.
export const knownValue = (observation: Observation): FactValue | undefined =>
  observation.kind === 'known' ? observation.value : undefined;

// The quantity of an observation, or undefined when it is not a known quantity.
export const knownQuantity = (observation: Observation): Quantity | undefined => {
  const value = knownValue(observation);
  return value !== undefined && value.kind === 'quantity' ? value.quantity : undefined;
};

// The box of an observation, or undefined when it is not a known box.
export const knownBounds = (observation: Observation): Bounds | undefined => {
  const value = knownValue(observation);
  return value !== undefined && value.kind === 'bounds' ? value.bounds : undefined;
};

// A fact about an object.
export const fact = (subject: ObjectRef, name: string, observation: Observation): Fact => ({
  subject,
  name,
  observation,
});

// How many of the observations are known, missing and conflicting.
export const coverageOf = (observations: Iterable<Observation>): Coverage => {
  const items = [...observations];
  const count = (kind: Observation['kind']): number => items.filter((item) => item.kind === kind).length;
  return {
    total: items.length,
    known: count('known'),
    missing: count('missing'),
    conflicting: count('conflicting'),
  };
};

// The known share of a coverage, or undefined when there is nothing to cover.
// Undefined rather than zero, so an empty set is never reported as complete or as fully missing.
export const coverageRatio = (coverage: Coverage): number | undefined =>
  coverage.total === 0 ? undefined : coverage.known / coverage.total;

// Coverage of no observations at all.
export const emptyCoverage: Coverage = { total: 0, known: 0, missing: 0, conflicting: 0 };

// Facts looked up by the object they are about and then by name.
export type FactIndex = ReadonlyMap<ObjectKey, ReadonlyMap<string, Fact>>;

// True when two values say the same thing. Quantities must agree on the unit as well as the number,
// and boxes on every corner. Two values of different kinds never say the same thing, so a kind added
// to `FactValue` needs one line here and leaves the rest of this module unchanged.
export const sameFactValue = (a: FactValue, b: FactValue): boolean => {
  if (a.kind === 'quantity' && b.kind === 'quantity')
    return a.quantity.value === b.quantity.value && a.quantity.unit === b.quantity.unit;
  if (a.kind === 'text' && b.kind === 'text') return a.text === b.text;
  if (a.kind === 'flag' && b.kind === 'flag') return a.value === b.value;
  if (a.kind === 'reference' && b.kind === 'reference') return sameObject(a.ref, b.ref);
  if (a.kind === 'bounds' && b.kind === 'bounds') return sameBounds(a.bounds, b.bounds);
  return false;
};

// The values an observation carries: one when known, several when sources disagree, none when missing.
export const observedValues = (observation: Observation): readonly FactValue[] =>
  observation.kind === 'known' ? [observation.value] : observation.kind === 'conflicting' ? observation.values : [];

// The observation with more evidence recorded for it. The value itself does not change.
export const withEvidence = (observation: Observation, evidence: readonly Evidence[]): Observation => ({
  ...observation,
  evidence: [...observation.evidence, ...evidence],
});

// The values reduced to one observation: known when they agree, conflicting when they do not.
// An empty list is missing for the stated reason, never a zero or a default.
export const reconcile = (
  values: readonly FactValue[],
  evidence: readonly Evidence[] = [],
  absent: MissingReason = 'not-provided',
): Observation => {
  const distinct = values.filter(
    (value, index) => values.findIndex((other) => sameFactValue(value, other)) === index,
  );
  const first = distinct[0];
  if (first === undefined) return missing(absent, evidence);
  return distinct.length === 1 ? known(first, evidence) : conflicting(distinct, evidence);
};

// Two observations of the same thing combined. Sources that disagree stay visible as a conflict.
export const mergeObservations = (a: Observation, b: Observation): Observation => {
  const evidence = [...a.evidence, ...b.evidence];
  const values = [...observedValues(a), ...observedValues(b)];
  return values.length === 0
    ? missing(a.kind === 'missing' ? a.reason : 'not-provided', evidence)
    : reconcile(values, evidence);
};

// Facts by subject and name. Two facts about the same thing are merged, so a conflict stays visible.
export const indexFacts = (facts: Iterable<Fact>): FactIndex => {
  const index = new Map<ObjectKey, Map<string, Fact>>();
  for (const item of facts) {
    const key = objectKey(item.subject);
    const byName = index.get(key) ?? new Map<string, Fact>();
    const existing = byName.get(item.name);
    byName.set(
      item.name,
      existing === undefined
        ? item
        : { ...item, observation: mergeObservations(existing.observation, item.observation) },
    );
    index.set(key, byName);
  }
  return index;
};

// The fact of that name about that object, or undefined when there is none.
export const lookupFact = (index: FactIndex, subject: ObjectRef, name: string): Fact | undefined =>
  index.get(objectKey(subject))?.get(name);

// What is known about that name for that object. Nothing recorded reads as missing, never as absent data.
export const observationAt = (index: FactIndex, subject: ObjectRef, name: string): Observation =>
  lookupFact(index, subject, name)?.observation ?? missing('not-provided');

// A fact per subject and name, with an explicit missing observation wherever nothing was recorded.
// This is what a schedule reports from: every row exists, and gaps are stated rather than dropped.
export const completeFacts = (
  index: FactIndex,
  subjects: readonly ObjectRef[],
  names: readonly string[],
): readonly Fact[] =>
  subjects.flatMap((subject) => names.map((name) => fact(subject, name, observationAt(index, subject, name))));

// How complete a set of facts is.
export const coverageOfFacts = (facts: Iterable<Fact>): Coverage =>
  coverageOf([...facts].map((item) => item.observation));

// How complete the set of facts is for each name, so a report can say which column has gaps.
export const coverageByName = (facts: Iterable<Fact>): ReadonlyMap<string, Coverage> => {
  const byName = new Map<string, Observation[]>();
  for (const item of facts) byName.set(item.name, [...(byName.get(item.name) ?? []), item.observation]);
  return new Map([...byName].map(([name, observations]) => [name, coverageOf(observations)]));
};

// The facts whose value is not known, which is what an exception list reports.
export const unknownFacts = (facts: Iterable<Fact>): readonly Fact[] =>
  [...facts].filter((item) => item.observation.kind !== 'known');

// The facts whose sources disagree.
export const conflictingFacts = (facts: Iterable<Fact>): readonly Fact[] =>
  [...facts].filter((item) => item.observation.kind === 'conflicting');

// The units a set of observations reported for one name, in the order first seen.
// More than one unit means the values cannot be added up without a conversion the data does not state.
export const reportedUnits = (facts: Iterable<Fact>): readonly string[] => {
  const units: string[] = [];
  for (const item of facts)
    for (const value of observedValues(item.observation))
      if (value.kind === 'quantity' && !units.includes(value.quantity.unit)) units.push(value.quantity.unit);
  return units;
};

// The sum of the known quantities, or undefined when they do not all report the same unit.
// Undefined rather than a number, so a total is never quietly wrong about what it added.
export const sumQuantities = (facts: Iterable<Fact>): Quantity | undefined => {
  const items = [...facts];
  const units = reportedUnits(items);
  const unit = units[0];
  if (unit === undefined || units.length > 1) return undefined;
  const total = items.reduce((sum, item) => sum + (knownQuantity(item.observation)?.value ?? 0), 0);
  return { value: total, unit };
};
