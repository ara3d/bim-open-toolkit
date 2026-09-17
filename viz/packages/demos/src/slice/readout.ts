// What the page says in words: the picked object, and the status line. Pure.
//
// A missing or disputed fire rating is reported as what it is - the reason nobody recorded one, or
// the values that disagree - and never as a blank or a plausible default.

import { objectKey, type Coverage, type FactValue, type Observation, type ObjectKey } from '@bim-open-toolkit/model';
import type { SliceData } from './data.js';

// What the page shows about one picked object.
export type Readout = {
  readonly key: ObjectKey;
  readonly name: string;
  readonly category: string;
  readonly fireRating: string;
  readonly coverage: string;
};

// The counts the status line reports, and the last frame interval the render timer measured.
export type SliceCounts = {
  readonly objects: number;
  readonly instances: number;
  readonly triangles: number;
  readonly doors: number;
  readonly unratedDoors: number;
  readonly lastFrameMs: number;
  // What GPU timing came to, or the reason there is none. Never a CPU number in its place.
  readonly gpu: string;
};

// The discriminant of anything that carries one. Reading it through a parameter rather than off
// the narrowed value is what lets the line below compile whether or not `FactValue` has grown a
// kind since: with the union exhausted the argument is `never`, which is assignable to this.
const kindOf = (value: { readonly kind: string }): string => value.kind;

// A fact value as text. A quantity keeps its unit, because a number without one is not a value.
// The kinds are named rather than switched through exhaustively, so a kind added to `FactValue`
// leaves this compiling and reporting that kind by name instead of breaking the page.
export const describeValue = (value: FactValue): string => {
  if (value.kind === 'quantity') return `${value.quantity.value} ${value.quantity.unit}`;
  if (value.kind === 'text') return value.text;
  if (value.kind === 'flag') return value.value ? 'yes' : 'no';
  if (value.kind === 'reference') return objectKey(value.ref);
  return `a ${kindOf(value)} value this page does not read`;
};

// An observation as text: the value, the reason there is none, or the values that disagree.
export const describeObservation = (observation: Observation): string => {
  switch (observation.kind) {
    case 'known':
      return describeValue(observation.value);
    case 'missing':
      return `missing (${observation.reason})`;
    case 'conflicting':
      return `conflicting (${observation.values.map(describeValue).join(' vs ')})`;
  }
};

// How complete the fire ratings are, in words.
export const describeCoverage = (coverage: Coverage): string =>
  `fire rating over ${coverage.total} doors: ${coverage.known} known, ${coverage.missing} missing, ${coverage.conflicting} conflicting`;

// What the page shows about one picked object. An object with no fire-rating fact says so rather
// than showing an empty field.
export const readoutOf = (data: SliceData, key: ObjectKey): Readout => {
  const record = data.building.model.objects.find((item) => objectKey(item.ref) === key);
  const fact = data.fireRatings.get(key);
  return {
    key,
    name: record?.name ?? key,
    category: record?.category ?? 'uncategorised',
    fireRating: fact === undefined ? 'no fire-rating fact (not a door)' : describeObservation(fact.observation),
    coverage: describeCoverage(data.coverage),
  };
};

// The status line: what is in the scene and how long the last frame took.
export const statusLine = (counts: SliceCounts): string =>
  `${counts.objects} objects · ${counts.instances} instances · ${counts.triangles} triangles · ` +
  `${counts.unratedDoors} of ${counts.doors} doors unrated · ` +
  `last frame ${counts.lastFrameMs.toFixed(1)} ms · GPU timing: ${counts.gpu}`;
