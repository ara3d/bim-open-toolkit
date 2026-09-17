// The roll-up a model read from a file actually records: a quantity, added up per source document.
//
// WHY THIS IS A DIFFERENT QUESTION FROM THE ESTATE'S. The estate asks which building is the
// outlier, and its interesting failure is that a source document may name no building or several,
// so a figure cannot be attributed. Snowdon Towers cannot be asked that: the file declares no
// building and no site, it is one building, and every one of its objects names exactly one of its
// seven source documents - so there is nothing to attribute and nothing to disambiguate. What the
// file does record is a grouping of its own: the seven discipline models federated into it. So the
// question here is which source document records the most floor area, and can I drill into one.
// Same shape - a roll-up you can drill into, with what could not be added up still visible - about
// a grouping the file states rather than one this demo invented.
//
// This is why `runPortfolioDrillThrough` is not run over it. Its input is buildings, the documents
// that report figures about them, and one figure per document; to feed it here a source document
// would have to be entered as a building and then as a document naming that one building, which is
// a bijection the file does not state, in a table whose column would read `buildingId` and hold a
// document title. The rules the workflow applies - one unit per total, no total rather than a total
// of zero, nothing attributed through an unsettled mapping - are applied here instead, over the
// rows the file has, and its `Outcome` colouring and set names are reused unchanged.
//
// WHAT IS NEVER DONE HERE. An object carrying no row for a metric has none; it is counted under
// `without` and is never added in as a zero. An object whose recorded value is zero is a recorded
// zero and is counted separately, because "nobody measured it" and "it measures nothing" are
// different answers. Units are carried exactly as the exporter wrote them - `SQUARE_FEET`,
// `CUBIC_FEET`, `US_GALLONS` - and nothing is converted, so two units in one scope produce no
// total at all rather than a number that mixes them.

import {
  emptyBounds,
  instanceTransform,
  isEmptyBounds,
  objectKey,
  transformBounds,
  unionBounds,
  type Bounds,
  type Geometry,
  type ModelData,
  type ObjectKey,
} from '@bim-open-toolkit/model';
import {
  propertyRowEnd,
  propertyRowStart,
  readProperty,
  type ModelDocuments,
  type ModelProperties,
} from '@bim-open-toolkit/formats';
import type { Outcome } from '@bim-open-toolkit/workflows';
import type { OpenedModel } from '../../gallery/contracts.js';

// The quantity the roll-up adds up, and the ones it reports beside it without adding.
//
// These are names the exporter wrote, not names this demo chose: on Snowdon `Area` is on 23,773
// objects in `SQUARE_FEET`, and `Volume` is on 17,572 in two different units. A model recording
// neither produces a roll-up with nothing in it, which the sheet says rather than hides.
export const recordedMetricName = 'Area';
export const recordedMetricNames: readonly string[] = [recordedMetricName, 'Volume'];

// What one metric adds up to inside one unit. Nothing is ever added across two of these.
export type UnitTotal = {
  readonly unit: string;
  // Objects carrying this metric in this unit.
  readonly objects: number;
  // Of those, the ones whose recorded value is exactly zero.
  readonly zeros: number;
  readonly total: number;
};

// One metric over some set of objects: what carries it, in what units, and its total when - and
// only when - one unit was recorded.
export type MetricRollup = {
  readonly metricName: string;
  // Objects carrying at least one row of this metric.
  readonly objects: number;
  // Objects carrying no row of it at all. Not zeros: nobody recorded them.
  readonly without: number;
  readonly zeros: number;
  // One entry per unit recorded, largest total first.
  readonly byUnit: readonly UnitTotal[];
  // The total, and the unit it is in, when exactly one unit was recorded. Undefined otherwise, and
  // undefined is not zero: it means the file gives no single number here.
  readonly total: number | undefined;
  readonly unit: string | undefined;
};

// A metric nothing recorded.
const emptyMetric = (metricName: string, without: number): MetricRollup => ({
  metricName,
  objects: 0,
  without,
  zeros: 0,
  byUnit: [],
  total: undefined,
  unit: undefined,
});

// One source document, what it holds, and what it adds up to.
export type DocumentRollup = {
  // The document index the file records, or -1 for the objects it attributes to none.
  readonly index: number;
  readonly title: string;
  readonly path: string | undefined;
  readonly objects: number;
  // The objects of this document, so drilling into it can isolate and frame exactly them.
  readonly keys: readonly ObjectKey[];
  readonly bounds: Bounds;
  // The metric the roll-up adds up, over this document alone.
  readonly requested: MetricRollup;
  // Every metric asked about, in the order `recordedMetricNames` lists them.
  readonly metrics: readonly MetricRollup[];
  // `resolved` when this document reports the requested metric in one unit, `conflicting` when it
  // reports it in more than one so no total is given, `missing` when it reports none of it, and
  // `excluded` for the objects the file attributes to no document at all.
  readonly outcome: Outcome;
};

// The whole roll-up: every source document, the model-wide totals, and the objects behind each
// outcome so the demo can colour them.
export type RecordedRollup = {
  readonly modelId: string;
  readonly requestedMetricName: string;
  // Largest total first; a document with no total sorts after the ones that have one.
  readonly documents: readonly DocumentRollup[];
  readonly requested: MetricRollup;
  readonly metrics: readonly MetricRollup[];
  readonly objects: number;
  // Objects the file attributes to no source document.
  readonly unattributed: number;
  // What the decode itself reports, so the sheet can say what it read rather than assume.
  readonly documentCount: number;
  readonly propertyRows: number;
  readonly droppedRows: number;
  readonly descriptors: number;
  readonly bounds: Bounds;
  // The objects of each outcome, which is what the colouring and the two sets are built from.
  readonly byOutcome: ReadonlyMap<Outcome, readonly ObjectKey[]>;
};

// One object's reading of one metric: every value it records and every unit it records them in.
type ObjectMetric = { readonly values: readonly number[]; readonly units: readonly string[] };

// The descriptor indices of each metric name, as a set per metric so a row is matched by lookup
// rather than by scanning the names again. A name the file records under more than one group -
// `Area` is under both `Dimensions` and `Mechanical` on Snowdon - contributes all of them.
const descriptorsByMetric = (
  properties: ModelProperties,
  metricNames: readonly string[],
): ReadonlyMap<string, ReadonlySet<number>> =>
  new Map(metricNames.map((name) => [name, new Set(properties.descriptors.byName.get(name) ?? [])] as const));

// What one object records for one metric. An object with no row for it reads as no values at all,
// which is what `without` counts and is never turned into a zero.
const objectMetricOf = (
  properties: ModelProperties,
  objectRow: number,
  wanted: ReadonlySet<number>,
): ObjectMetric => {
  const values: number[] = [];
  const units: string[] = [];
  const end = propertyRowEnd(properties, objectRow);
  for (let row = propertyRowStart(properties, objectRow); row < end; row += 1) {
    if (!wanted.has(properties.descriptor[row] ?? -1)) continue;
    const reading = readProperty(properties, row);
    if (typeof reading.value !== 'number' || !Number.isFinite(reading.value)) continue;
    values.push(reading.value);
    units.push(reading.units ?? 'no unit recorded');
  }
  return { values, units };
};

// Accumulates one metric over a set of objects, keeping each unit apart.
class MetricTally {
  private readonly units = new Map<string, { objects: number; zeros: number; total: number }>();
  private objects = 0;
  private without = 0;
  private zeros = 0;

  add(reading: ObjectMetric): void {
    if (reading.values.length === 0) {
      this.without += 1;
      return;
    }
    this.objects += 1;
    const seen = new Set<string>();
    for (let at = 0; at < reading.values.length; at += 1) {
      const value = reading.values[at] ?? 0;
      const unit = reading.units[at] ?? 'no unit recorded';
      const held = this.units.get(unit) ?? { objects: 0, zeros: 0, total: 0 };
      if (!seen.has(unit)) {
        held.objects += 1;
        seen.add(unit);
      }
      held.total += value;
      if (value === 0) {
        held.zeros += 1;
        this.zeros += 1;
      }
      this.units.set(unit, held);
    }
  }

  // The metric as the sheet reads it. A total is given only when one unit was recorded, because
  // adding square feet to gallons would be a number nobody could check.
  read(metricName: string): MetricRollup {
    const byUnit: readonly UnitTotal[] = [...this.units]
      .map(([unit, held]): UnitTotal => ({ unit, objects: held.objects, zeros: held.zeros, total: held.total }))
      .sort((left, right) => right.total - left.total || left.unit.localeCompare(right.unit));
    const only = byUnit.length === 1 ? byUnit[0] : undefined;
    return {
      metricName,
      objects: this.objects,
      without: this.without,
      zeros: this.zeros,
      byUnit,
      total: only?.total,
      unit: only?.unit,
    };
  }
}

// The box each source document occupies, unioned over the instance rows that draw its objects.
//
// Only what is drawn counts. An object that draws nothing has no box, and it is deliberately not
// given the point its own record places it at: a model read from a BFAST file leaves every object
// record at the identity, because the real placement is on the instance rows, so that fallback
// would put half of a fifty-thousand-object model at the world origin and stretch every document's
// box from the building to a point nothing is at. A document that draws nothing gets an empty box,
// which is what stops the camera being sent to a box that means nothing.
const documentBounds = (
  model: ModelData,
  geometry: Geometry,
  documentOf: (objectRow: number) => number,
): ReadonlyMap<number, Bounds> => {
  const boxes = model.objects.map(() => emptyBounds);
  const instances = geometry.instances;
  for (let row = 0; row < instances.count; row += 1) {
    const meshIndex = instances.meshIndex[row] ?? -1;
    const objectIndex = instances.objectIndex[row] ?? -1;
    const source = geometry.meshes[meshIndex];
    const held = boxes[objectIndex];
    if (source === undefined || held === undefined) continue;
    boxes[objectIndex] = unionBounds(held, transformBounds(instanceTransform(instances, row), source.bounds));
  }
  const byDocument = new Map<number, Bounds>();
  for (let object = 0; object < model.objects.length; object += 1) {
    const box = boxes[object] ?? emptyBounds;
    if (isEmptyBounds(box)) continue;
    const document = documentOf(object);
    byDocument.set(document, unionBounds(byDocument.get(document) ?? emptyBounds, box));
  }
  return byDocument;
};

// What one object's requested metric makes of it. An object the file attributes to no document is
// left out of every document's total rather than pushed into one, so it is `excluded`; an object
// recording the metric more than once, disagreeing in value or in unit, is `conflicting` and is
// not added up.
const objectOutcome = (document: number, reading: ObjectMetric): Outcome => {
  if (document < 0) return 'excluded';
  if (reading.values.length === 0) return 'missing';
  if (new Set(reading.units).size > 1 || new Set(reading.values).size > 1) return 'conflicting';
  return 'resolved';
};

// A document's outcome from what it records of the requested metric.
const documentOutcome = (index: number, requested: MetricRollup): Outcome => {
  if (index < 0) return 'excluded';
  if (requested.objects === 0) return 'missing';
  return requested.byUnit.length > 1 ? 'conflicting' : 'resolved';
};

// The title the file records for a document, or the name the objects it attributes to none are
// listed under. That name is a statement about the file, not a document it contains.
export const unattributedTitle = 'No source document';

// The roll-up of one opened model, or nothing when the loader read no parameter table and no
// document table off it - which is every generated model and every format that carries neither.
// Returning nothing rather than an empty roll-up is what lets the sheet say which of the two it is.
export const rollupOf = (
  model: OpenedModel,
  metricNames: readonly string[] = recordedMetricNames,
  requestedMetricName: string = recordedMetricName,
): RecordedRollup | undefined => {
  const properties: ModelProperties | undefined = model.properties;
  const documents: ModelDocuments | undefined = model.documents;
  if (properties === undefined || documents === undefined) return undefined;
  if (properties.rows === 0 && documents.count === 0) return undefined;

  const wanted = descriptorsByMetric(properties, metricNames);
  const documentOf = (objectRow: number): number => documents.ofObject[objectRow] ?? -1;

  const whole = new Map(metricNames.map((name) => [name, new MetricTally()] as const));
  const perDocument = new Map<number, { keys: ObjectKey[]; tallies: Map<string, MetricTally> }>();
  const byOutcome = new Map<Outcome, ObjectKey[]>();
  let unattributed = 0;

  for (let object = 0; object < model.data.objects.length; object += 1) {
    const record = model.data.objects[object];
    if (record === undefined) continue;
    const key = objectKey(record.ref);
    const document = documentOf(object);
    if (document < 0) unattributed += 1;
    let held = perDocument.get(document);
    if (held === undefined) {
      held = { keys: [], tallies: new Map(metricNames.map((name) => [name, new MetricTally()] as const)) };
      perDocument.set(document, held);
    }
    held.keys.push(key);
    let requested: ObjectMetric = { values: [], units: [] };
    for (const name of metricNames) {
      const reading = objectMetricOf(properties, object, wanted.get(name) ?? new Set());
      whole.get(name)?.add(reading);
      held.tallies.get(name)?.add(reading);
      if (name === requestedMetricName) requested = reading;
    }
    const outcome = objectOutcome(document, requested);
    byOutcome.set(outcome, [...(byOutcome.get(outcome) ?? []), key]);
  }

  const boxes = documentBounds(model.data, model.geometry, documentOf);
  const readMetrics = (tallies: Map<string, MetricTally>): readonly MetricRollup[] =>
    metricNames.map((name) => tallies.get(name)?.read(name) ?? emptyMetric(name, 0));

  const rolled: readonly DocumentRollup[] = [...perDocument]
    .map(([index, held]): DocumentRollup => {
      const metrics = readMetrics(held.tallies);
      const requested =
        metrics.find((item) => item.metricName === requestedMetricName) ??
        emptyMetric(requestedMetricName, held.keys.length);
      return {
        index,
        title: index < 0 ? unattributedTitle : documents.title[index] ?? `Document ${String(index)}`,
        path: index < 0 ? undefined : documents.path[index],
        objects: held.keys.length,
        keys: held.keys,
        bounds: boxes.get(index) ?? emptyBounds,
        requested,
        metrics,
        outcome: documentOutcome(index, requested),
      };
    })
    .sort(
      (left, right) =>
        (right.requested.total ?? -1) - (left.requested.total ?? -1) || left.title.localeCompare(right.title),
    );

  const wholeMetrics = readMetrics(whole);
  return {
    modelId: model.modelId,
    requestedMetricName,
    documents: rolled,
    requested:
      wholeMetrics.find((item) => item.metricName === requestedMetricName) ??
      emptyMetric(requestedMetricName, model.data.objects.length),
    metrics: wholeMetrics,
    objects: model.data.objects.length,
    unattributed,
    documentCount: documents.count,
    propertyRows: properties.rows,
    droppedRows: properties.dropped,
    descriptors: properties.descriptors.count,
    bounds: rolled.reduce((all, one) => unionBounds(all, one.bounds), emptyBounds),
    byOutcome,
  };
};

// One document of a roll-up, or nothing when no document is at that index.
export const documentAt = (rollup: RecordedRollup, index: number): DocumentRollup | undefined =>
  rollup.documents.find((item) => item.index === index);

// A metric of a roll-up or of one document, by name.
export const metricOf = (metrics: readonly MetricRollup[], metricName: string): MetricRollup | undefined =>
  metrics.find((item) => item.metricName === metricName);

// A metric's figure as one line of text, in the unit it was recorded in and never converted. A
// metric nobody recorded says so; a metric recorded in more than one unit lists what each unit adds
// up to rather than adding them together.
export const metricText = (metric: MetricRollup | undefined): string => {
  if (metric === undefined || metric.byUnit.length === 0) return 'No figure recorded';
  if (metric.byUnit.length === 1) {
    const only = metric.byUnit[0];
    return only === undefined ? 'No figure recorded' : `${only.total.toFixed(2)} ${only.unit}`;
  }
  return `Not totalled: ${metric.byUnit.map((item) => `${item.total.toFixed(2)} ${item.unit}`).join(' and ')}`;
};

// The metric names a roll-up records in more than one unit, so nothing was totalled for them.
export const notTotalled = (rollup: RecordedRollup): readonly MetricRollup[] =>
  rollup.metrics.filter((item) => item.byUnit.length > 1);
