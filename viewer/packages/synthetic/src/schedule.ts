// Turns observations into table columns without losing what is not known.
//
// A schedule reader wants columns, but a column of numbers cannot say "nobody measured this" or
// "two sources disagree". So each observed field becomes several columns: the value, the state,
// the reason it is absent, the disagreeing values and the evidence. The value column is only
// meaningful where the state column says `known`; a missing number reads as NaN and a missing
// string as the empty string, never as zero and never as a plausible default.

import {
  f64Column,
  knownQuantity,
  stringColumn,
  type Column,
  type Evidence,
  type FactValue,
  type Observation,
} from '@bim-open-toolkit/model';

// One column of a table together with the name it is filed under.
export type NamedColumn = readonly [string, Column];

// The state of an observation, as it appears in a `<field>State` column.
export type ObservationState = Observation['kind'];

// The state of an observation.
export const observationState = (observation: Observation): ObservationState => observation.kind;

// Why the value is absent, or the empty string when the observation is not missing.
export const missingReasonOf = (observation: Observation): string =>
  observation.kind === 'missing' ? observation.reason : '';

// One source rendered for a reader: its name, with the reference in brackets when there is one.
const formatEvidence = (item: Evidence): string =>
  item.reference === undefined ? item.source : `${item.source} (${item.reference})`;

// Every source behind an observation, joined by "; ". Empty when none was recorded.
export const evidenceOf = (observation: Observation): string =>
  observation.evidence.map(formatEvidence).join('; ');

// The number of a known quantity, or NaN. Read the state column before this one.
export const quantityNumber = (observation: Observation): number =>
  knownQuantity(observation)?.value ?? Number.NaN;

// The unit of a known quantity, or the empty string when there is no known quantity.
export const quantityUnit = (observation: Observation): string => knownQuantity(observation)?.unit ?? '';

// The text of a known text observation, or the empty string. Read the state column before this one.
export const observationText = (observation: Observation): string => {
  if (observation.kind !== 'known') return '';
  return observation.value.kind === 'text' ? observation.value.text : '';
};

// One value rendered for a reader, whatever kind it is.
const formatValue = (value: FactValue): string => {
  switch (value.kind) {
    case 'quantity':
      return `${value.quantity.value} ${value.quantity.unit}`;
    case 'text':
      return value.text;
    case 'flag':
      return value.value ? 'true' : 'false';
    case 'reference':
      return value.ref.objectId;
  }
};

// The disagreeing values of a conflicting observation, joined by " vs ". Empty otherwise.
export const conflictOf = (observation: Observation): string =>
  observation.kind === 'conflicting' ? observation.values.map(formatValue).join(' vs ') : '';

// The columns shared by every observed field: state, missing reason, disagreeing values, evidence.
const stateColumns = (name: string, observations: readonly Observation[]): readonly NamedColumn[] => [
  [`${name}State`, stringColumn(observations.map(observationState))],
  [`${name}MissingReason`, stringColumn(observations.map(missingReasonOf))],
  [`${name}Conflict`, stringColumn(observations.map(conflictOf))],
  [`${name}Evidence`, stringColumn(observations.map(evidenceOf))],
];

// The columns describing an observed quantity: value, unit, state, reason, conflict, evidence.
// The value is NaN wherever the state is not `known`.
export const quantityColumns = (name: string, observations: readonly Observation[]): readonly NamedColumn[] => [
  [name, f64Column(observations.map(quantityNumber))],
  [`${name}Unit`, stringColumn(observations.map(quantityUnit))],
  ...stateColumns(name, observations),
];

// The columns describing an observed text field: value, state, reason, conflict, evidence.
// The value is the empty string wherever the state is not `known`.
export const textColumns = (name: string, observations: readonly Observation[]): readonly NamedColumn[] => [
  [name, stringColumn(observations.map(observationText))],
  ...stateColumns(name, observations),
];
