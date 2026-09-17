// The sidebar sheet for the object being read: what it is, which file it came from, every property
// the file records about it in the groups the file puts them in, and every observation recorded
// about it with the state of that observation.
//
// A gap stays a gap. A missing observation becomes a missing value carrying the reason the data
// gives, a conflicting one lists what the sources say and never picks a winner, and the evidence of
// each observation is carried through so a reader can check it. A property the file records with no
// value in it - an empty string, an entity index of -1, a number the pool does not hold - is missing
// for the reason the encoding gives, never zero and never blank.
//
// Units are the exporter's own. `SQUARE_FEET` is shown as `SQUARE_FEET`; nothing here converts,
// because a converted number that has lost the name it was recorded in cannot be checked. Numbers
// are printed to six significant figures, which is more than the float the file stores carries.
//
// The sheet is re-derived after every change event, so it reads one object's own property rows
// through the index and never walks the parameter table.

import type { Evidence, FactValue, ObjectRecord, Observation, ObjectKey, Session, Vec3 } from '@bim-open-toolkit/model';
import type { PropertyReading } from '@bim-open-toolkit/formats';
import {
  conflictingValue,
  knownNumber,
  knownValue,
  missingValue,
  propertyGroup,
  propertyRow,
  propertySheet,
  type PropertyGroup,
  type PropertyRow,
  type PropertySheet,
  type PropertyValue,
} from '@bim-open-toolkit/ui-gratify';
import {
  documentOf,
  factsOf,
  inspectIndex,
  propertiesOf,
  storeyOfObject,
  type InspectIndex,
  type StoreyOfObject,
} from './building.js';
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

/**
 * A recorded number as text.
 *
 * A whole number keeps no decimals and everything else keeps six significant figures, which is more
 * than the float32 the file stores carries, so `465.61871337890625` reads as `465.619`. That is a
 * rounding for the eye and the only one on this sheet: the unit is never changed and the value is
 * never scaled, so the number and the name it was recorded under still say the same thing.
 */
export const numberText = (value: number): string => {
  if (!Number.isFinite(value)) return String(value);
  if (Number.isInteger(value)) return String(value);
  return String(Number(value.toPrecision(6)));
};

// A recorded point as text, in the coordinates the file records it in.
export const pointText = (point: readonly [number, number, number]): string => point.map(numberText).join(', ');

/**
 * An entity value read as the object it names.
 *
 * The raw value is a row number, which means nothing to a reader, so it is resolved to the name that
 * object carries and its object id is kept as evidence. A row the model does not hold, and the -1 the
 * exporter writes for a property that references nothing, are both missing with the reason: a row
 * number is never printed as if it were the value.
 */
export const referenceValue = (index: InspectIndex, reading: PropertyReading): PropertyValue => {
  if (typeof reading.value !== 'number') return missingValue('recorded as a reference to nothing');
  const record = index.model.objects[reading.value];
  if (record === undefined) return missingValue('references an object this model does not hold');
  const named = record.name ?? record.ref.objectId;
  return {
    kind: 'reference',
    text: named,
    state: 'known',
    evidence: [`references ${record.ref.objectId}${record.category === undefined ? '' : ` (${record.category})`}`],
  };
};

/**
 * One recorded property as a sheet value.
 *
 * Every kind the tables carry has its own answer, and every one of them that carries no value says
 * so with the reason its encoding gives rather than showing zero or an empty cell: a string pooled
 * as the empty string was written and left blank, an entity of -1 references nothing, and a number
 * index outside the pool is a value the file did not keep.
 */
export const readingValue = (index: InspectIndex, reading: PropertyReading): PropertyValue => {
  switch (reading.kind) {
    case 'int':
    case 'number':
      return typeof reading.value === 'number'
        ? { kind: 'number', text: numberText(reading.value), unit: reading.units, state: 'known' }
        : missingValue('the file keeps no number for it');
    case 'string':
      return typeof reading.value === 'string' && reading.value !== ''
        ? knownValue(reading.value, reading.units)
        : missingValue('recorded, with no text written in it');
    case 'entity':
      return referenceValue(index, reading);
    case 'point':
      return reading.point === undefined
        ? missingValue('the file keeps no point for it')
        : { kind: 'text', text: pointText(reading.point), unit: reading.units, state: 'known' };
    default:
      return missingValue('recorded under a value kind this reader does not know');
  }
};

// The group a property belongs to. Every descriptor on Snowdon names one; a file that names none for
// a property says so rather than having it quietly join another group.
export const ungrouped = 'Ungrouped';

// A group name as a sheet id: `Electrical - Loads` becomes `props/electrical-loads`.
export const propertyGroupId = (name: string): string =>
  `props/${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;

/**
 * The properties of one object, in the groups the file puts them in.
 *
 * Groups come out in the order the object's rows first mention them and rows keep the order the file
 * records them, so the sheet is the file's own arrangement rather than one imposed here. An object
 * can carry a hundred and twenty properties; the group headers are what make that readable, and the
 * row key is the object's own row number so a name recorded twice - `Category` is, on every Snowdon
 * object - gives two rows rather than one row that hides the other.
 */
export const propertyGroupsOf = (index: InspectIndex, key: ObjectKey): readonly PropertyGroup[] => {
  const order: string[] = [];
  const grouped = new Map<string, PropertyRow[]>();
  propertiesOf(index, key).forEach((reading, at) => {
    const name = reading.group ?? ungrouped;
    const row = propertyRow(
      `p${at}`,
      reading.name ?? `Descriptor ${reading.descriptor}`,
      readingValue(index, reading),
    );
    const held = grouped.get(name);
    if (held === undefined) {
      order.push(name);
      grouped.set(name, [row]);
    } else held.push(row);
  });
  return order.map((name) => propertyGroup(propertyGroupId(name), name, grouped.get(name) ?? []));
};

// The storey row: the level the object sits on, with what found the link as its evidence. A model
// that links it neither way says so, and neither reads a level off an elevation.
export const storeyValue = (storey: StoreyOfObject | undefined): PropertyValue => {
  if (storey === undefined) return missingValue('no storey link recorded');
  if (storey.name === undefined || storey.name === '')
    return { ...missingValue('linked to a storey that records no name'), evidence: [`found by ${storey.via}`] };
  return { ...knownValue(storey.name), evidence: [`found by ${storey.via}`] };
};

// What the model itself says about the object: what it is, what it is called, and where it sits.
export const identityRows = (record: ObjectRecord, storey: StoreyOfObject | undefined): readonly PropertyRow[] => [
  propertyRow('category', 'Category', recordedOr(record.category, 'no category recorded')),
  propertyRow('name', 'Name', recordedOr(record.name, 'no name recorded')),
  propertyRow('storey', 'Storey', storeyValue(storey)),
  propertyRow('objectId', 'Object id', knownValue(record.ref.objectId)),
];

// Which of the source files the object was exported from. A federated model is several documents in
// one file - Snowdon is seven - and this is the one that holds this object.
export const sourceRows = (index: InspectIndex, key: ObjectKey): readonly PropertyRow[] => {
  const document = documentOf(index, key);
  return [
    propertyRow('document', 'Source document', recordedOr(document?.title, 'the file names no document for it')),
    propertyRow('documentPath', 'Exported from', recordedOr(document?.path, 'the file records no export path')),
  ];
};

// What the facts group is called. An object with no observations says whether that is because this
// object has none or because the file records none at all, which are different answers.
export const factsTitle = (index: InspectIndex, rows: number): string => {
  if (rows > 0) return 'Facts';
  return index.recorded.length === 0
    ? 'Facts: this file records no observations'
    : 'Facts: none recorded for this object';
};

// What the sheet says under its title: how much the file records about this object, and how the
// object came to be shown. The counts are handed in because the sheet has already built the groups
// and nothing here reads the object's rows a second time.
export const sheetSubtitle = (properties: number, groups: number, pinned: boolean): string => {
  const held = pinned ? 'Pinned; click elsewhere to move the pin.' : 'Under the pointer; click to pin.';
  if (properties === 0) return held;
  return `${properties} ${properties === 1 ? 'property' : 'properties'} in ${groups} ${groups === 1 ? 'group' : 'groups'}. ${held}`;
};

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
  const groups = propertyGroupsOf(index, key);
  const properties = groups.reduce((total, group) => total + group.rows.length, 0);
  return propertySheet(
    record.name ?? record.ref.objectId,
    [
      propertyGroup('identity', 'Identity', identityRows(record, storeyOfObject(index, key))),
      ...(index.documents.count === 0 ? [] : [propertyGroup('source', 'Source', sourceRows(index, key))]),
      propertyGroup('facts', factsTitle(index, rows.length), rows),
      ...groups,
    ],
    sheetSubtitle(properties, groups.length, isPinned(session)),
  );
};
