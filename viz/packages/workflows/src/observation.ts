import {
  array,
  boolean,
  conflicting,
  flag,
  known,
  literal,
  missing,
  number,
  object,
  objectKey,
  optional,
  quantity,
  string,
  text,
  union,
  type Evidence,
  type FactValue,
  type MissingReason,
  type Observation,
  type Schema,
} from '@bim-open-toolkit/model';
import { enumeration } from './schema-tools.js';
import { listOrNothing, resultRecord, type ResultRecord, type ResultValue } from './values.js';

// The scalar a fact value reads as in a row: a quantity's number, a text, a flag, an object key, or
// a box written as its two corners. A row cell is one scalar, so a box reads as text here; a caller
// that needs the numbers reads `knownBounds` instead of parsing this back.
export const factScalar = (value: FactValue): string | number | boolean =>
  value.kind === 'quantity'
    ? value.quantity.value
    : value.kind === 'text'
      ? value.text
      : value.kind === 'flag'
        ? value.value
        : value.kind === 'reference'
          ? objectKey(value.ref)
          : `${value.bounds.min.join(' ')} to ${value.bounds.max.join(' ')}`;

// The unit a value reports, or nothing when it is not a quantity or states no unit.
export const unitOf = (value: FactValue): string | undefined =>
  value.kind === 'quantity' && value.quantity.unit !== '' ? value.quantity.unit : undefined;

// The one unit every value reports, or nothing when they do not all report the same one.
const sharedUnit = (values: readonly FactValue[]): string | undefined => {
  const units = values.map(unitOf);
  const first = units[0];
  return first !== undefined && units.every((unit) => unit === first) ? first : undefined;
};

const evidenceCell = (item: Evidence): ResultRecord =>
  resultRecord({ source: item.source, reference: item.reference, recordedAt: item.recordedAt });

const evidenceCells = (items: readonly Evidence[]): readonly ResultValue[] | undefined =>
  listOrNothing(items.map(evidenceCell));

// An observation as a result cell: what is known, or why it is not. It never substitutes a value.
// Evidence is written only when there is some, so an unevidenced observation reads as one field less.
export const observationCell = (observation: Observation): ResultRecord => {
  const value = observationJson(observation);
  return resultRecord({
    kind: value.kind,
    value: value.kind === 'known' ? value.value : undefined,
    values: value.kind === 'conflicting' ? [...value.values] : undefined,
    reason: value.kind === 'missing' ? value.reason : undefined,
    unit: value.kind === 'missing' ? undefined : value.unit,
    evidence: value.evidence === undefined ? undefined : evidenceCells(value.evidence),
  });
};

// Every reason a value can be unavailable, as model states them.
export const missingReasons: readonly MissingReason[] = [
  'not-provided',
  'not-applicable',
  'not-measured',
  'unresolved-source',
  'out-of-scope',
];

// A stated reason a value is unavailable.
export const missingReasonSchema: Schema<MissingReason> = enumeration(missingReasons);

// Where an observation came from.
export const evidenceSchema: Schema<Evidence> = object({
  source: string(),
  reference: optional(string()),
  recordedAt: optional(string()),
});

// The value a JSON observation carries: a number with an optional unit, a text, or a flag.
export type ObservationScalar = string | number | boolean;

// An observation as JSON, which is how workflow inputs and result rows carry one.
// It is the compact form of model's `Observation`: a number is a quantity of the stated unit, a
// string is text, a boolean is a flag, and evidence is written only when there is some.
export type ObservationJson =
  | {
      readonly kind: 'known';
      readonly value: ObservationScalar;
      readonly unit?: string | undefined;
      readonly evidence?: readonly Evidence[] | undefined;
    }
  | { readonly kind: 'missing'; readonly reason: MissingReason; readonly evidence?: readonly Evidence[] | undefined }
  | {
      readonly kind: 'conflicting';
      readonly values: readonly ObservationScalar[];
      readonly unit?: string | undefined;
      readonly evidence?: readonly Evidence[] | undefined;
    };

const scalarSchema = union<ObservationScalar>(string(), number(), boolean());

// The JSON form of an observation: `{kind, value, unit?}`, `{kind, reason}` or `{kind, values}`.
export const observationJsonSchema: Schema<ObservationJson> = union<ObservationJson>(
  object({
    kind: literal('known'),
    value: scalarSchema,
    unit: optional(string()),
    evidence: optional(array(evidenceSchema)),
  }),
  object({ kind: literal('missing'), reason: missingReasonSchema, evidence: optional(array(evidenceSchema)) }),
  object({
    kind: literal('conflicting'),
    values: array(scalarSchema),
    unit: optional(string()),
    evidence: optional(array(evidenceSchema)),
  }),
);

// An observation of model's in the JSON form workflow inputs and result rows carry. Evidence is
// written only when there is some, and a conflict keeps a unit only when its values agree on one.
export const observationJson = (observation: Observation): ObservationJson => {
  const evidence = observation.evidence.length === 0 ? undefined : observation.evidence;
  return observation.kind === 'known'
    ? { kind: 'known', value: factScalar(observation.value), unit: unitOf(observation.value), evidence }
    : observation.kind === 'missing'
      ? { kind: 'missing', reason: observation.reason, evidence }
      : {
          kind: 'conflicting',
          values: observation.values.map(factScalar),
          unit: sharedUnit(observation.values),
          evidence,
        };
};

// A scalar and its unit as a fact value: a number is a quantity, a text is text, a flag is a flag.
export const scalarFactValue = (value: ObservationScalar, unit: string | undefined): FactValue =>
  typeof value === 'number' ? quantity(value, unit ?? '') : typeof value === 'boolean' ? flag(value) : text(value);

// A JSON observation read as one of model's, which is what every rule in this package works on.
export const toObservation = (value: ObservationJson): Observation =>
  value.kind === 'known'
    ? known(scalarFactValue(value.value, value.unit), value.evidence ?? [])
    : value.kind === 'missing'
      ? missing(value.reason, value.evidence ?? [])
      : conflicting(
          value.values.map((item) => scalarFactValue(item, value.unit)),
          value.evidence ?? [],
        );

// The observation a row carries for that column, or a stated gap when the row carries none.
// Nothing recorded reads as missing, never as a zero or a default.
export const observationOf = (
  facts: Readonly<Record<string, ObservationJson>>,
  name: string,
  reason: MissingReason = 'not-provided',
): Observation => {
  const value = facts[name];
  return value === undefined ? missing(reason) : toObservation(value);
};
