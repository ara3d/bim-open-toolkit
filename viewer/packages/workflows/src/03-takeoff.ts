import {
  array,
  failure,
  missing,
  modelRefSchema,
  object,
  resultOf,
  string,
  type Diagnostic,
  type ModelRef,
  type Observation,
  type Result,
  type Schema,
} from '@bim-open-toolkit/model';
import { workflowException, type WorkflowException } from './exception.js';
import { duplicateDiagnostics, keyOf, keysOf, namedObjectSet, suggestedView } from './keys.js';
import { factScalar, observationJsonSchema, toObservation, unitOf, type ObservationJson } from './observation.js';
import { marker, onObject, type Overlay } from './overlay.js';
import { groupByOutcome, outcomeRules, worseOutcome, type Outcome } from './outcome.js';
import { workflowResult, type WorkflowResult } from './result.js';
import { resultRecord, resultTable, type ResultRow } from './values.js';
import { workflow, type Workflow } from './workflow.js';

// One distinct finish face. `basis` is provenance only: it is carried through for the reader, but a
// missing or conflicting `areaM2` is never rescued by trusting it instead.
export type TakeoffSurface = {
  readonly objectId: string;
  readonly roomId: string;
  readonly finishType: ObservationJson;
  readonly areaM2: ObservationJson;
  readonly basis: string;
};

// The takeoff's input: the distinct finish faces a survey or drawing supplied.
export type TakeoffInput = {
  readonly model: ModelRef;
  readonly surfaces: readonly TakeoffSurface[];
};

// The JSON a takeoff is given.
export const takeoffInputSchema: Schema<TakeoffInput> = object({
  model: modelRefSchema,
  surfaces: array(
    object({
      objectId: string(),
      roomId: string(),
      finishType: observationJsonSchema,
      areaM2: observationJsonSchema,
      basis: string(),
    }),
  ),
});

type SurfaceInfo = { readonly surface: TakeoffSurface; readonly finishType: Observation; readonly areaM2: Observation };

const infoOf = (surface: TakeoffSurface): SurfaceInfo => ({
  surface,
  finishType: toObservation(surface.finishType),
  areaM2: toObservation(surface.areaM2),
});

// A one-sentence statement of the other field's known value, so an exception about one field still
// carries the context the reader needs without guessing at the field that is itself the problem.
const knownDetail = (field: string, observation: Observation): string => {
  if (observation.kind !== 'known') return '';
  const value = factScalar(observation.value);
  const unit = unitOf(observation.value);
  const shown = typeof value === 'string' ? `'${value}'` : value;
  return unit === undefined ? `${field} is known as ${shown}` : `${field} is known as ${value} ${unit}`;
};

// A surface is an exception, once per offending field, when its finish type or its area is not
// known. A surface with both problems produces both exception rows, never one row that hides one.
const exceptionsOfSurface = (info: SurfaceInfo): readonly WorkflowException[] => [
  ...(info.finishType.kind === 'known'
    ? []
    : [
        workflowException([info.surface.objectId], 'finishType', info.finishType, {
          detail: knownDetail('areaM2', info.areaM2),
        }),
      ]),
  ...(info.areaM2.kind === 'known'
    ? []
    : [
        workflowException([info.surface.objectId], 'areaM2', info.areaM2, {
          detail: knownDetail('finishType', info.finishType),
        }),
      ]),
];

const outcomeOfKind = (kind: Observation['kind']): Outcome =>
  kind === 'known' ? 'resolved' : kind === 'missing' ? 'missing' : 'conflicting';

const surfaceOutcome = (info: SurfaceInfo): Outcome =>
  worseOutcome(outcomeOfKind(info.finishType.kind), outcomeOfKind(info.areaM2.kind));

type Contribution = { readonly finishType: string | number | boolean; readonly value: number; readonly unit: string | undefined };

// The known contribution of one surface: only surfaces with a known finish type and a known,
// numeric area contribute. Nothing here sums a triangle count; it only sums a supplied measurement.
const contributionOf = (info: SurfaceInfo): readonly Contribution[] =>
  info.finishType.kind === 'known' && info.areaM2.kind === 'known' && info.areaM2.value.kind === 'quantity'
    ? [{ finishType: factScalar(info.finishType.value), value: info.areaM2.value.quantity.value, unit: unitOf(info.areaM2.value) }]
    : [];

// The roof and room-finish takeoff: a subtotal per finish type from known areas only, and every
// surface whose finish type or area is not known reported as an exception rather than folded in as
// zero. A finish type with no contributing surface has no subtotal row at all.
export const runTakeoff = (input: TakeoffInput): Result<WorkflowResult> => {
  const duplicates = duplicateDiagnostics('surfaces', input.surfaces.map((surface) => surface.objectId));
  if (duplicates.length > 0) return failure(duplicates);

  const diagnostics: Diagnostic[] = [];
  const infos = input.surfaces.map(infoOf);
  const contributions = infos.flatMap(contributionOf);
  const finishTypes = [...new Set(contributions.map((item) => item.finishType))];

  // A finish type whose known areas are not all reported in one unit is not added up at all: the
  // subtotal is withheld and the surfaces are reported instead, so no total is quietly wrong about
  // what it added.
  const groups = finishTypes.map((finishType) => {
    const items = contributions.filter((item) => item.finishType === finishType);
    return { finishType, items, units: [...new Set(items.map((item) => item.unit))] };
  });
  const subtotals = groups
    .filter((group) => group.units.length === 1)
    .map((group) => ({
      finishType: group.finishType,
      areaM2: group.items.reduce((sum, item) => sum + item.value, 0),
      unit: group.units[0],
      surfaceCount: group.items.length,
    }));

  const rows: readonly ResultRow[] = subtotals.map((subtotal) => resultRecord({ ...subtotal }));
  const totalKnownM2 = subtotals.reduce((sum, subtotal) => sum + subtotal.areaM2, 0);

  const mixedUnits = groups
    .filter((group) => group.units.length > 1)
    .map((group) =>
      workflowException(
        infos
          .filter((info) => contributionOf(info).some((item) => item.finishType === group.finishType))
          .map((info) => info.surface.objectId),
        'areaM2',
        missing('unresolved-source'),
        {
          detail: `areas for finish type '${String(group.finishType)}' are reported in more than one unit: ${group.units
            .map((unit) => unit ?? 'none')
            .join(', ')}`,
        },
      ),
    );

  const exceptions = [...infos.flatMap(exceptionsOfSurface), ...mixedUnits];
  const exceptionIds = [...new Set(exceptions.flatMap((item) => item.subjects))];

  const overlays: readonly Overlay[] = exceptions.map((item) =>
    marker(
      `takeoff/${item.subjects[0] ?? ''}/${item.field}`,
      `${item.subjects[0] ?? ''}: ${item.field} ${item.observation.kind}`,
      outcomeOfKind(item.observation.kind),
      onObject(keyOf(input.model, item.subjects[0] ?? '')),
    ),
  );

  const rules = outcomeRules(
    'takeoff',
    groupByOutcome(infos.map((info) => [keyOf(input.model, info.surface.objectId), surfaceOutcome(info)] as const)),
  );

  return resultOf(
    workflowResult({
      id: 'takeoff',
      title: 'Roof and room-finish takeoff',
      model: input.model,
      tables: [resultTable('subtotals', 'Finish-type subtotals', rows)],
      summary: resultRecord({ totalKnownM2, surfaceCount: input.surfaces.length, exceptionCount: exceptions.length }),
      exceptions,
      rules,
      sets: [
        namedObjectSet('takeoff/surfaces', 'Surveyed surfaces', input.model, input.surfaces.map((surface) => surface.objectId)),
        namedObjectSet('takeoff/exceptions', 'Surfaces with exceptions', input.model, exceptionIds),
      ],
      overlays,
      view: suggestedView('takeoff', 'Takeoff exceptions', keysOf(input.model, exceptionIds), rules),
      selectSetId: 'takeoff/exceptions',
    }),
    diagnostics,
  );
};

// Roof and room-finish takeoff: subtotals summed from supplied measurements only, with every
// unassigned or disputed surface stated as an exception instead of folded into a subtotal as zero.
export const takeoffWorkflow: Workflow = workflow({
  id: 'takeoff',
  title: 'Roof and room-finish takeoff',
  description:
    'Sums the known areaM2 of surfaces sharing a known finishType into one subtotal per finish type. It never ' +
    'computes an area from geometry: a finish type with no surface reporting a known area gets no subtotal, and a ' +
    'surface with an unassigned finish or an unavailable or disputed area is reported as an exception instead.',
  basis: 'synthetic',
  input: takeoffInputSchema,
  run: runTakeoff,
});
