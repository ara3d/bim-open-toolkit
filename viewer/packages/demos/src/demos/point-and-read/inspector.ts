// The sidebar sheet for the object being read: what it is, where it is, and every fact recorded
// about it with the state of that fact.
//
// A gap stays a gap. A missing observation becomes a missing value carrying the reason the data
// gives, a conflicting one lists what the sources say and never picks a winner, and the evidence of
// each observation is carried through so a reader can check it.

import type { Evidence, FactValue, ObjectRecord, Observation, Session, Vec3 } from '@bim-open-toolkit/model';
import {
  conflictingValue,
  knownNumber,
  knownValue,
  missingValue,
  propertyGroup,
  propertyRow,
  propertySheet,
  type PropertyRow,
  type PropertySheet,
  type PropertyValue,
} from '@bim-open-toolkit/ui-gratify';
import { factsOf, inspectIndex, storeyNameOf } from './building.js';
import { isPinned, shownKey } from './pinning.js';

// The evidence of an observation as text, one line per source.
export const evidenceTexts = (evidence: readonly Evidence[]): readonly string[] =>
  evidence.map((item) => (item.reference === undefined ? item.source : `${item.source} ${item.reference}`));

const corner = (point: Vec3): string => point.map((axis) => axis.toFixed(2)).join(', ');

// A fact value as text. A quantity keeps its unit; a reference reads as the object it points at;
// a box reads as its two corners.
export const factText = (value: FactValue): string =>
  value.kind === 'quantity'
    ? `${value.quantity.value} ${value.quantity.unit}`
    : value.kind === 'text'
      ? value.text
      : value.kind === 'flag'
        ? value.value
          ? 'yes'
          : 'no'
        : value.kind === 'reference'
          ? value.ref.objectId
          : `${corner(value.bounds.min)} to ${corner(value.bounds.max)}`;

// An observation as a sheet value: known with its evidence, missing with the reason the data gives,
// or conflicting with every value the sources reported.
export const observationValue = (observation: Observation): PropertyValue => {
  const evidence = evidenceTexts(observation.evidence);
  if (observation.kind === 'conflicting') return conflictingValue(observation.values.map(factText), evidence);
  if (observation.kind === 'missing') return { ...missingValue(observation.reason.replace(/-/g, ' ')), evidence };
  const value = observation.value;
  return value.kind === 'quantity'
    ? { ...knownNumber(value.quantity.value, value.quantity.unit, 0), evidence }
    : { ...knownValue(factText(value)), evidence };
};

// A recorded fact name as a label: `nominalWidth` reads as `Nominal width`.
export const factLabel = (name: string): string => {
  const spaced = name.replace(/([A-Z])/g, ' $1');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
};

// A value that is known, or a missing one with the stated reason when it is not recorded.
const recordedOr = (value: string | undefined, reason: string): PropertyValue =>
  value === undefined || value === '' ? missingValue(reason) : knownValue(value);

// What the model itself says about the object: what it is, what it is called, and where it sits.
export const identityRows = (record: ObjectRecord, storey: string | undefined): readonly PropertyRow[] => [
  propertyRow('category', 'Category', recordedOr(record.category, 'no category recorded')),
  propertyRow('name', 'Name', recordedOr(record.name, 'no name recorded')),
  propertyRow('storey', 'Storey', recordedOr(storey, 'no storey link recorded')),
  propertyRow('objectId', 'Object id', knownValue(record.ref.objectId)),
];

// The sheet for whatever the session is showing. Nothing pointed at is a sheet that says so, not an
// empty panel.
export const pointAndReadSheet = (session: Session): PropertySheet => {
  const key = shownKey(session);
  const index = inspectIndex();
  const record = key === undefined ? undefined : index.records.get(key);
  if (key === undefined || record === undefined)
    return propertySheet('Nothing pointed at', [], 'Move the pointer over the building, then click to pin.');
  const facts = factsOf(index, key);
  const rows = facts.map((item) => propertyRow(item.name, factLabel(item.name), observationValue(item.observation)));
  return propertySheet(
    record.name ?? record.ref.objectId,
    [
      propertyGroup('identity', 'Identity', identityRows(record, storeyNameOf(index, key))),
      propertyGroup(
        'facts',
        rows.length === 0 ? 'Facts: none recorded' : 'Facts',
        rows,
      ),
    ],
    isPinned(session) ? 'Pinned; click elsewhere to move the pin.' : 'Under the pointer; click to pin.',
  );
};
