import {
  array,
  diagnostic,
  failure,
  literal,
  number,
  object,
  optional,
  parse,
  resultOf,
  string,
  union,
  type Diagnostic,
  type Evidence,
  type MissingReason,
  type ModelRef,
  type Result,
  type Schema,
} from '@bim-open-toolkit/model';
import { type DoorScheduleInput, type ScheduleDoor } from './01-door-schedule.js';
import { type ObservationJson } from './observation.js';
import { enumeration } from './schema-tools.js';

// The reasons a BuildingModel workflow projection gives for a width it does not carry.
export type ProjectionMissingReason = 'NotObserved' | 'NotExported' | 'NotApplicable' | 'Invalid' | 'Conflicting';

// How a projection's reason reads in the model vocabulary. `Conflicting` is not a missing reason at
// all: the sources disagreed, so it becomes a conflict whose disputed values the projection did not
// carry, rather than a value this adapter invents or a gap it calls unmeasured.
export const projectionMissingReasons: Readonly<Record<ProjectionMissingReason, MissingReason | 'conflict'>> = {
  NotObserved: 'not-measured',
  NotExported: 'not-provided',
  NotApplicable: 'not-applicable',
  Invalid: 'unresolved-source',
  Conflicting: 'conflict',
};

const projectionReasonSchema = enumeration<ProjectionMissingReason>([
  'NotObserved',
  'NotExported',
  'NotApplicable',
  'Invalid',
  'Conflicting',
]);

// A width the projection carries, in metres, or the reason it does not.
export type ProjectionWidth =
  | {
      readonly state: 'known';
      readonly value: { readonly Metres: number };
      readonly assurance?: string | undefined;
      readonly evidence?: readonly string[] | undefined;
    }
  | {
      readonly state: 'missing';
      readonly reason: ProjectionMissingReason;
      readonly explanation?: string | undefined;
      readonly evidence?: readonly string[] | undefined;
    };

const widthSchema: Schema<ProjectionWidth> = union<ProjectionWidth>(
  object({
    state: literal('known'),
    value: object({ Metres: number() }),
    assurance: optional(string()),
    evidence: optional(array(string())),
  }),
  object({
    state: literal('missing'),
    reason: projectionReasonSchema,
    explanation: optional(string()),
    evidence: optional(array(string())),
  }),
);

// One door of a projection, with the fields a schedule reads.
export type ProjectionDoor = {
  readonly Id: { readonly snapshot: string; readonly local: string };
  readonly Element: { readonly ObjectId: string; readonly Name?: string | undefined; readonly Evidence?: readonly string[] | undefined };
  readonly NominalWidth?: ProjectionWidth | undefined;
  readonly ClearWidth?: ProjectionWidth | undefined;
};

// One evidence record of a projection.
export type ProjectionEvidence = {
  readonly Id: string;
  readonly Origin?: string | undefined;
  readonly Method?: string | undefined;
  readonly Explanation?: string | undefined;
};

// The part of an `ara3d.building-workflow-projection` version 1 envelope a door schedule reads.
// Source-row identity, fingerprints and the full evidence graph stay with the projection's own
// adapter; this converter only shapes the door table into the schedule's input.
export type DoorProjection = {
  readonly Format: 'ara3d.building-workflow-projection';
  readonly Version: 1;
  readonly Model: {
    readonly Snapshot: { readonly Id: string };
    readonly Doors: readonly ProjectionDoor[];
    readonly Evidence?: readonly ProjectionEvidence[] | undefined;
  };
};

// The JSON a door projection is read from.
export const doorProjectionSchema: Schema<DoorProjection> = object({
  Format: literal('ara3d.building-workflow-projection'),
  Version: literal(1),
  Model: object({
    Snapshot: object({ Id: string() }),
    Doors: array(
      object({
        Id: object({ snapshot: string(), local: string() }),
        Element: object({ ObjectId: string(), Name: optional(string()), Evidence: optional(array(string())) }),
        NominalWidth: optional(widthSchema),
        ClearWidth: optional(widthSchema),
      }),
    ),
    Evidence: optional(
      array(
        object({
          Id: string(),
          Origin: optional(string()),
          Method: optional(string()),
          Explanation: optional(string()),
        }),
      ),
    ),
  }),
});

// What the projection alone does not say: which model revision the doors belong to and which of
// them are loaded. A projection carries no geometry, so with no loaded ids every row is scheduled
// as geometry-free, which is the honest default: the schedule works without geometry.
export type DoorProjectionOptions = {
  readonly model: ModelRef;
  readonly loadedObjectIds?: readonly string[] | undefined;
};

const evidenceOf = (
  ids: readonly string[],
  records: ReadonlyMap<string, ProjectionEvidence>,
  diagnostics: Diagnostic[],
): readonly Evidence[] =>
  ids.map((id) => {
    const item = records.get(id);
    if (item === undefined) {
      diagnostics.push(
        diagnostic(
          'door-projection/unavailable-evidence',
          `Evidence "${id}" is referenced but the projection does not carry it.`,
          ['Model', 'Evidence', id],
          'warning',
        ),
      );
      return { source: id };
    }
    return { source: item.Origin ?? id, reference: id };
  });

const widthObservation = (
  width: ProjectionWidth | undefined,
  records: ReadonlyMap<string, ProjectionEvidence>,
  diagnostics: Diagnostic[],
): ObservationJson => {
  if (width === undefined) return { kind: 'missing', reason: 'not-provided' };
  const evidence = evidenceOf(width.evidence ?? [], records, diagnostics);
  if (width.state === 'known') return { kind: 'known', value: width.value.Metres, unit: 'm', evidence };
  const reason = projectionMissingReasons[width.reason];
  return reason === 'conflict'
    ? { kind: 'conflicting', values: [], evidence }
    : { kind: 'missing', reason, evidence };
};

// The doors of a BuildingModel workflow projection as a door schedule input, so the same adapter
// runs on generated tables and on a real source. Nominal and clear width stay separate facts and
// neither ever stands in for the other.
export const doorScheduleFromProjection = (
  value: unknown,
  options: DoorProjectionOptions,
): Result<DoorScheduleInput> => {
  const parsed = parse(doorProjectionSchema, value);
  if (!parsed.ok) return failure(parsed.diagnostics);
  const snapshot = parsed.value.Model.Snapshot.Id;
  const records = new Map((parsed.value.Model.Evidence ?? []).map((item) => [item.Id, item]));
  const loaded = options.loadedObjectIds;
  const diagnostics: Diagnostic[] = [];
  const mismatched = parsed.value.Model.Doors.filter(
    (door) => door.Id.snapshot !== snapshot || door.Id.local !== door.Element.ObjectId,
  );
  if (mismatched.length > 0)
    return failure(
      mismatched.map((door) =>
        diagnostic(
          'door-projection/inconsistent-identity',
          `Door "${door.Element.ObjectId}" carries an identity that disagrees with the projection snapshot.`,
          ['Model', 'Doors', door.Element.ObjectId],
        ),
      ),
    );
  const doors: readonly ScheduleDoor[] = parsed.value.Model.Doors.map((door) => ({
    objectId: door.Element.ObjectId,
    name: door.Element.Name ?? door.Element.ObjectId,
    storeyId: null,
    roomId: null,
    hasGeometry: loaded !== undefined && loaded.includes(door.Element.ObjectId),
    facts: {
      nominalWidth: widthObservation(door.NominalWidth, records, diagnostics),
      clearWidth: widthObservation(door.ClearWidth, records, diagnostics),
    },
  }));
  return resultOf(
    {
      model: options.model,
      storeys: [],
      rooms: [],
      doors,
      exceptionFacts: ['nominalWidth', 'clearWidth'],
    },
    [...parsed.diagnostics, ...diagnostics],
  );
};
