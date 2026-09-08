import {
  array,
  failure,
  mergeObservations,
  missing,
  modelRefSchema,
  object,
  resultOf,
  setOf,
  string,
  styleRule,
  type Color,
  type Diagnostic,
  type ModelRef,
  type Observation,
  type ObjectKey,
  type Result,
  type Schema,
  type StyleRule,
} from '@bim-open-toolkit/model';
import { workflowException, type WorkflowException } from './exception.js';
import { duplicateDiagnostics, keyOf, keysOf, namedObjectSet, suggestedView, unknownReferenceDiagnostic } from './keys.js';
import { enumeration } from './schema-tools.js';
import { observationJsonSchema, toObservation, type ObservationJson } from './observation.js';
import { marker, onObject, type Overlay } from './overlay.js';
import { step, workflowCommands } from './recipe.js';
import { workflowResult, type WorkflowResult } from './result.js';
import { resultRecord, resultTable, type ResultRow } from './values.js';
import { workflow, type Workflow } from './workflow.js';

// One item tracked through procurement, delivery, acceptance and installation.
export type TimelineObject = { readonly objectId: string; readonly name: string };

// The kind of event a dated record reports.
export type DeliveryEventType = 'delivered' | 'accepted' | 'installed';

// One dated record about one object. An object can have zero, one or more of these.
export type TimelineEvent = {
  readonly id: string;
  readonly objectId: string;
  readonly eventType: DeliveryEventType;
  readonly date: ObservationJson;
};

// The tracked objects, their dated events, and the date the timeline is read as of.
export type DeliveryTimelineInput = {
  readonly model: ModelRef;
  readonly asOfDate: string;
  readonly objects: readonly TimelineObject[];
  readonly events: readonly TimelineEvent[];
};

// The JSON a delivery timeline is given.
export const deliveryTimelineInputSchema: Schema<DeliveryTimelineInput> = object({
  model: modelRefSchema,
  asOfDate: string(),
  objects: array(object({ objectId: string(), name: string() })),
  events: array(
    object({
      id: string(),
      objectId: string(),
      eventType: enumeration<DeliveryEventType>(['delivered', 'accepted', 'installed']),
      date: observationJsonSchema,
    }),
  ),
});

// The single state a timeline row reports. `scheduled` means no event of any kind is usable yet.
export type TimelineState = 'scheduled' | DeliveryEventType;

// The colour of each state. A display convention, not domain meaning.
export const timelineStateColors: Readonly<Record<TimelineState, Color>> = {
  scheduled: [0.7, 0.7, 0.72],
  delivered: [0.55, 0.6, 0.85],
  accepted: [0.55, 0.4, 0.8],
  installed: [0.35, 0.65, 0.45],
};

// The event types in ascending rank, so the last one an object qualifies for is its highest state.
const rankedTypes: readonly DeliveryEventType[] = ['delivered', 'accepted', 'installed'];

// The date an observation reports, or nothing when it is not a known value.
const dateOf = (observation: Observation): string | undefined =>
  observation.kind === 'known' && observation.value.kind === 'text' ? observation.value.text : undefined;

type EventLookup = ReadonlyMap<DeliveryEventType, Observation>;

// The observations recorded about one object, by event type. Two rows of the same type are merged
// rather than one silently replacing the other, so two records that disagree read as a conflict.
const eventsOf = (objectId: string, events: readonly TimelineEvent[]): EventLookup => {
  const byType = new Map<DeliveryEventType, Observation>();
  for (const event of events.filter((item) => item.objectId === objectId)) {
    const recorded = byType.get(event.eventType);
    const observation = toObservation(event.date);
    byType.set(event.eventType, recorded === undefined ? observation : mergeObservations(recorded, observation));
  }
  return byType;
};

// The date of that event type, when it is known and not later than `asOfDate`. A missing or
// conflicting date is "not usable", never read as though the event happened on `asOfDate`.
const usableDate = (byType: EventLookup, type: DeliveryEventType, asOfDate: string): string | undefined => {
  const observation = byType.get(type);
  const date = observation === undefined ? undefined : dateOf(observation);
  return date !== undefined && date <= asOfDate ? date : undefined;
};

// The date of a known event type that has not happened yet as of `asOfDate`.
const futureDate = (byType: EventLookup, type: DeliveryEventType, asOfDate: string): string | undefined => {
  const observation = byType.get(type);
  const date = observation === undefined ? undefined : dateOf(observation);
  return date !== undefined && date > asOfDate ? date : undefined;
};

type TimelineRow = {
  readonly object: TimelineObject;
  readonly state: TimelineState;
  readonly knownDates: Readonly<Record<string, string>>;
  readonly futureDates: Readonly<Record<string, string>>;
  readonly coverageNote: string | undefined;
};

// One object's timeline row: its state is the highest-ranked event type with a usable date, never
// more than one state at once. A known higher state is not demoted by a lower-ranked event with no
// row at all; that gap is carried as a non-blocking coverage note instead.
const timelineRowOf = (input: DeliveryTimelineInput, object: TimelineObject): TimelineRow => {
  const byType = eventsOf(object.objectId, input.events);
  const usableTypes = rankedTypes.filter((type) => usableDate(byType, type, input.asOfDate) !== undefined);
  const state: TimelineState = usableTypes[usableTypes.length - 1] ?? 'scheduled';

  const knownDates = Object.fromEntries(
    rankedTypes.flatMap((type) => {
      const date = usableDate(byType, type, input.asOfDate);
      return date === undefined ? [] : [[type, date]];
    }),
  );
  const futureDates = Object.fromEntries(
    rankedTypes.flatMap((type) => {
      const date = futureDate(byType, type, input.asOfDate);
      return date === undefined ? [] : [[type, date]];
    }),
  );

  const currentRank = state === 'scheduled' ? 0 : rankedTypes.indexOf(state) + 1;
  const lowerGaps = rankedTypes
    .slice(0, Math.max(0, currentRank - 1))
    .filter((type) => usableDate(byType, type, input.asOfDate) === undefined);

  return {
    object,
    state,
    knownDates,
    futureDates,
    coverageNote: lowerGaps.length === 0 ? undefined : `${lowerGaps.join(', ')} not observed`,
  };
};

const rowRecord = (row: TimelineRow): ResultRow =>
  resultRecord({
    objectId: row.object.objectId,
    state: row.state,
    knownDates: row.knownDates,
    futureDates: Object.keys(row.futureDates).length === 0 ? undefined : row.futureDates,
    coverageNote: row.coverageNote,
  });

// An object with no event rows at all is an exception: nothing has been observed yet, which is not
// the same as a schedule confirmed on track.
const noEventExceptions = (input: DeliveryTimelineInput): readonly WorkflowException[] =>
  input.objects
    .filter((object) => eventsOf(object.objectId, input.events).size === 0)
    .map((object) => workflowException([object.objectId], 'events', missing('not-provided'), { detail: 'no events observed' }));

// An event whose sources disagree is an exception; its date is already excluded from ranking. The
// disagreement is read from the merged record, so two rows of one type that disagree count too.
const conflictingExceptions = (input: DeliveryTimelineInput): readonly WorkflowException[] =>
  input.objects.flatMap((object) => {
    const byType = eventsOf(object.objectId, input.events);
    return rankedTypes.flatMap((type) => {
      const observation = byType.get(type);
      return observation === undefined || observation.kind !== 'conflicting'
        ? []
        : [workflowException([object.objectId], type, observation)];
    });
  });

// The delivery and installation timeline: one row per object with a single state, never a state and
// a later one shown together. A missing lower step under a known higher one is a coverage note, not
// a demotion; a conflicting date and an object with no events at all are the only exceptions.
export const runDeliveryTimeline = (input: DeliveryTimelineInput): Result<WorkflowResult> => {
  const duplicates = [
    ...duplicateDiagnostics('objects', input.objects.map((object) => object.objectId)),
    ...duplicateDiagnostics('events', input.events.map((event) => event.id)),
  ];
  if (duplicates.length > 0) return failure(duplicates);

  const diagnostics: Diagnostic[] = [];
  const objectIds = new Set(input.objects.map((object) => object.objectId));
  for (const event of input.events)
    if (!objectIds.has(event.objectId)) diagnostics.push(unknownReferenceDiagnostic('events', 'objectId', event.objectId));

  const rows = input.objects.map((object) => timelineRowOf(input, object));
  // `asOfDate` drives `animation.seek`, which takes milliseconds since the epoch. A date
  // `Date.parse` cannot read is not guessed at as zero or "now": it is reported as an exception and
  // the timeline is left wherever it already was, rather than moved on a fabricated time.
  const asOfMs = Date.parse(input.asOfDate);
  const exceptions = [
    ...conflictingExceptions(input),
    ...noEventExceptions(input),
    ...(Number.isFinite(asOfMs)
      ? []
      : [
          workflowException([], 'asOfDate', missing('unresolved-source'), {
            detail: `"${input.asOfDate}" is not a date Date.parse can read, so the timeline was not moved to it`,
          }),
        ]),
  ];
  const exceptionIds = [...new Set(exceptions.flatMap((item) => item.subjects))];

  const keysOfState = (state: TimelineState): readonly ObjectKey[] =>
    rows.filter((row) => row.state === state).map((row) => keyOf(input.model, row.object.objectId));

  const states: readonly TimelineState[] = ['scheduled', 'delivered', 'accepted', 'installed'];
  const present = states.filter((state) => keysOfState(state).length > 0);
  const rules: readonly StyleRule[] = present.map((state, index) =>
    styleRule(`delivery-timeline/${state}`, `delivery timeline ${state}`, keysOfState(state), { color: timelineStateColors[state] }, index + 1),
  );

  const overlays: readonly Overlay[] = exceptions.map((item) => {
    const subject = item.subjects[0] ?? '';
    return marker(
      `delivery-timeline/${subject}/${item.field}`,
      `${subject}: ${item.field} ${item.observation.kind}`,
      item.observation.kind === 'conflicting' ? 'conflicting' : 'missing',
      onObject(keyOf(input.model, subject)),
    );
  });

  return resultOf(
    workflowResult({
      id: 'delivery-timeline',
      title: 'Delivery and installation timeline',
      model: input.model,
      tables: [resultTable('timeline', 'Delivery timeline', rows.map(rowRecord))],
      summary: resultRecord({ asOfDate: input.asOfDate, objectCount: input.objects.length, exceptionCount: exceptions.length }),
      exceptions,
      rules,
      sets: [
        namedObjectSet('delivery-timeline/objects', 'Tracked objects', input.model, input.objects.map((object) => object.objectId)),
        ...present.map((state) => ({
          id: `delivery-timeline/${state}`,
          name: `Delivery timeline ${state}`,
          members: setOf(keysOfState(state)),
        })),
        namedObjectSet('delivery-timeline/exceptions', 'Objects with exceptions', input.model, exceptionIds),
      ],
      overlays,
      view: suggestedView('delivery-timeline', 'Delivery timeline exceptions', keysOf(input.model, exceptionIds), rules),
      selectSetId: 'delivery-timeline/exceptions',
      extraSteps: Number.isFinite(asOfMs)
        ? [step(workflowCommands.setTimelineDate, { timeMs: asOfMs }, `Set the timeline to ${input.asOfDate}.`)]
        : [],
    }),
    diagnostics,
  );
};

// Delivery and installation timeline: delivered, accepted and installed stay distinct states, a
// known higher state is never demoted by a missing lower one, and only a disputed date or an object
// with no events at all becomes an exception.
export const deliveryTimelineWorkflow: Workflow = workflow({
  id: 'delivery-timeline',
  title: 'Delivery and installation timeline',
  description:
    'Reports each object\'s single highest-ranked state (installed, accepted, delivered or scheduled) from its ' +
    'known, not-yet-future event dates as of the given date. A missing lower-ranked event under a known higher one ' +
    'is a coverage note, not a demotion; a conflicting date and an object with no events at all are exceptions.',
  basis: 'synthetic',
  input: deliveryTimelineInputSchema,
  run: runDeliveryTimeline,
});
