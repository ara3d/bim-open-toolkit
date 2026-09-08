import type { ObjectRef } from './identity.js';

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

// The value an observation carries.
export type FactValue =
  | { readonly kind: 'quantity'; readonly quantity: Quantity }
  | { readonly kind: 'text'; readonly text: string }
  | { readonly kind: 'flag'; readonly value: boolean }
  | { readonly kind: 'reference'; readonly ref: ObjectRef };

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
