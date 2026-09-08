import {
  array,
  boolean,
  coverageByName,
  fact,
  failure,
  modelRefSchema,
  nullable,
  object,
  objectRef,
  record,
  resultOf,
  string,
  type Coverage,
  type Diagnostic,
  type Fact,
  type ModelRef,
  type Observation,
  type Result,
  type Schema,
} from '@bim-open-toolkit/model';
import { workflowException, type WorkflowException } from './exception.js';
import {
  duplicateDiagnostics,
  keyOf,
  keysOf,
  namedObjectSet,
  suggestedView,
  unknownReferenceDiagnostic,
} from './keys.js';
import { observationCell, observationOf, observationJsonSchema, type ObservationJson } from './observation.js';
import { marker, onObject, type Overlay } from './overlay.js';
import { groupByOutcome, outcomeRules, worseOutcome, type Outcome } from './outcome.js';
import { workflowResult, type WorkflowResult } from './result.js';
import { resultRecord, resultTable, type ResultRecord, type ResultRow } from './values.js';
import { workflow, type Workflow } from './workflow.js';

// One storey the schedule groups and orders by.
export type ScheduleStorey = { readonly storeyId: string; readonly name: string };

// One room a door can be linked to.
export type ScheduleRoom = { readonly objectId: string; readonly name: string; readonly storeyId: string };

// One door. `facts` holds every observation the schedule reports, one per column, so a source with
// different columns than another needs no change here. A door with no geometry is still scheduled.
export type ScheduleDoor = {
  readonly objectId: string;
  readonly name: string;
  readonly storeyId: string | null;
  readonly roomId: string | null;
  readonly hasGeometry: boolean;
  readonly facts: Readonly<Record<string, ObservationJson>>;
};

// The schedule's input. `exceptionFacts` names the facts whose gaps are exceptions; every other
// fact is reported in the schedule and never raises one, because which axis is under review is a
// decision of the review, not of this adapter.
export type DoorScheduleInput = {
  readonly model: ModelRef;
  readonly storeys: readonly ScheduleStorey[];
  readonly rooms: readonly ScheduleRoom[];
  readonly doors: readonly ScheduleDoor[];
  readonly exceptionFacts: readonly string[];
};

// The JSON a door schedule is given.
export const doorScheduleInputSchema: Schema<DoorScheduleInput> = object({
  model: modelRefSchema,
  storeys: array(object({ storeyId: string(), name: string() })),
  rooms: array(object({ objectId: string(), name: string(), storeyId: string() })),
  doors: array(
    object({
      objectId: string(),
      name: string(),
      storeyId: nullable(string()),
      roomId: nullable(string()),
      hasGeometry: boolean(),
      facts: record(observationJsonSchema),
    }),
  ),
  exceptionFacts: array(string()),
});

// The fact names the doors report, in the order they first appear, which is the column order.
const scheduledFacts = (doors: readonly ScheduleDoor[]): readonly string[] => {
  const names: string[] = [];
  for (const door of doors) for (const name of Object.keys(door.facts)) if (!names.includes(name)) names.push(name);
  return names;
};

const factOf = (door: ScheduleDoor, name: string): Observation => observationOf(door.facts, name);

const outcomeOfKind = (kind: Observation['kind']): Outcome =>
  kind === 'known' ? 'resolved' : kind === 'missing' ? 'missing' : 'conflicting';

const exceptionsOfDoor = (door: ScheduleDoor, exceptionFacts: readonly string[]): readonly WorkflowException[] =>
  exceptionFacts.flatMap((name) => {
    const observation = factOf(door, name);
    return observation.kind === 'known' ? [] : [workflowException([door.objectId], name, observation)];
  });

const doorOutcome = (door: ScheduleDoor, exceptionFacts: readonly string[]): Outcome =>
  exceptionFacts.reduce<Outcome>(
    (outcome, name) => worseOutcome(outcome, outcomeOfKind(factOf(door, name).kind)),
    'resolved',
  );

// The first of the ids that names a door, so an exception can be placed on the door it is about.
const doorOf = (
  byId: ReadonlyMap<string, ScheduleDoor>,
  ids: readonly string[],
): ScheduleDoor | undefined => {
  for (const id of ids) {
    const door = byId.get(id);
    if (door !== undefined) return door;
  }
  return undefined;
};

const exceptionText = (item: WorkflowException): string =>
  `${item.field} ${item.observation.kind === 'missing' ? item.observation.reason : 'conflicting'}`;

const coverageRecord = (facts: readonly Fact[]): ResultRecord =>
  Object.fromEntries(
    [...coverageByName(facts)].map(([name, coverage]: readonly [string, Coverage]) => [
      name,
      { total: coverage.total, known: coverage.known, missing: coverage.missing, conflicting: coverage.conflicting },
    ]),
  );

// Doors in storey order, then by name, then in the order the input gave them, so a level-by-level
// reader walks the schedule in the order the storey table declares.
const orderedDoors = (input: DoorScheduleInput): readonly ScheduleDoor[] => {
  const rank = (storeyId: string | null): number => {
    const index = input.storeys.findIndex((storey) => storey.storeyId === storeyId);
    return index < 0 ? input.storeys.length : index;
  };
  return input.doors
    .map((door, index) => ({ door, index, rank: rank(door.storeyId) }))
    .sort((a, b) => a.rank - b.rank || a.door.name.localeCompare(b.door.name) || a.index - b.index)
    .map((item) => item.door);
};

const nameOf = (
  id: string | null,
  names: ReadonlyMap<string, string>,
  field: string,
  diagnostics: Diagnostic[],
): string | null => {
  if (id === null) return null;
  const name = names.get(id);
  if (name === undefined) diagnostics.push(unknownReferenceDiagnostic('doors', field, id));
  return name ?? null;
};

// The room and door schedule with its exceptions: one row per door whether or not it has geometry,
// every reported fact carried as observed, and a gap in a reviewed fact stated rather than filled.
export const runDoorSchedule = (input: DoorScheduleInput): Result<WorkflowResult> => {
  const duplicates = [
    ...duplicateDiagnostics('storeys', input.storeys.map((storey) => storey.storeyId)),
    ...duplicateDiagnostics('rooms', input.rooms.map((room) => room.objectId)),
    ...duplicateDiagnostics('doors', input.doors.map((door) => door.objectId)),
  ];
  if (duplicates.length > 0) return failure(duplicates);

  const diagnostics: Diagnostic[] = [];
  const storeyNames = new Map(input.storeys.map((storey) => [storey.storeyId, storey.name]));
  const roomNames = new Map(input.rooms.map((room) => [room.objectId, room.name]));
  const doors = orderedDoors(input);
  const names = scheduledFacts(input.doors);

  const rows: readonly ResultRow[] = doors.map((door) => ({
    ...resultRecord({
      objectId: door.objectId,
      name: door.name,
      storey: nameOf(door.storeyId, storeyNames, 'storeyId', diagnostics),
      room: nameOf(door.roomId, roomNames, 'roomId', diagnostics),
    }),
    ...Object.fromEntries(names.map((name) => [name, observationCell(factOf(door, name))])),
  }));

  const exceptions = doors.flatMap((door) => exceptionsOfDoor(door, input.exceptionFacts));
  const exceptionIds = [...new Set(exceptions.flatMap((item) => item.subjects))];
  const geometryFree = doors.filter((door) => !door.hasGeometry).map((door) => door.objectId);
  const facts = doors.flatMap((door) =>
    names.map((name) => fact(objectRef(input.model, door.objectId), name, factOf(door, name))),
  );

  const byId = new Map(doors.map((door) => [door.objectId, door]));
  const overlays: readonly Overlay[] = exceptions.flatMap((item) => {
    const door = doorOf(byId, item.subjects);
    return door === undefined || !door.hasGeometry
      ? []
      : [
          marker(
            `door-schedule/${door.objectId}/${item.field}`,
            `${door.name}: ${exceptionText(item)}`,
            outcomeOfKind(item.observation.kind),
            onObject(keyOf(input.model, door.objectId)),
          ),
        ];
  });

  const rules = outcomeRules(
    'door-schedule',
    groupByOutcome(doors.map((door) => [keyOf(input.model, door.objectId), doorOutcome(door, input.exceptionFacts)])),
  );

  return resultOf(
    workflowResult({
      id: 'door-schedule',
      title: 'Room and door schedule',
      model: input.model,
      tables: [resultTable('schedule', 'Door schedule', rows)],
      summary: { doorCount: doors.length, exceptionCount: exceptions.length, coverage: coverageRecord(facts) },
      exceptions,
      rules,
      sets: [
        namedObjectSet('door-schedule/doors', 'Scheduled doors', input.model, doors.map((door) => door.objectId)),
        namedObjectSet('door-schedule/exceptions', 'Doors with exceptions', input.model, exceptionIds),
        ...(geometryFree.length === 0
          ? []
          : [namedObjectSet('door-schedule/geometry-free', 'Doors with no geometry', input.model, geometryFree)]),
      ],
      overlays,
      view: suggestedView('door-schedule', 'Door schedule exceptions', keysOf(input.model, exceptionIds), rules),
      selectSetId: 'door-schedule/exceptions',
    }),
    diagnostics,
  );
};

// Building, room and door schedules with a reviewed fact's gaps stated as exceptions.
export const doorScheduleWorkflow: Workflow = workflow({
  id: 'door-schedule',
  title: 'Room and door schedule',
  description:
    'One row per door, joined to its storey and room, with every reported observation carried as observed. ' +
    'A reviewed fact that is unavailable or disputed becomes an exception; it is never filled in or read as zero.',
  basis: 'mixed',
  input: doorScheduleInputSchema,
  run: runDoorSchedule,
});
