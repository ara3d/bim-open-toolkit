import {
  array,
  failure,
  literal,
  missing,
  modelRefSchema,
  number,
  object,
  resultOf,
  string,
  union,
  type Diagnostic,
  type MissingReason,
  type ModelRef,
  type Result,
  type Schema,
  type Vec3,
} from '@bim-open-toolkit/model';
import { workflowException, type WorkflowException } from './exception.js';
import { duplicateDiagnostics, keyOf, keysOf, namedObjectSet, suggestedView } from './keys.js';
import { missingReasonSchema } from './observation.js';
import { atPoint, marker, type Overlay } from './overlay.js';
import { groupByOutcome, outcomeRules, type Outcome } from './outcome.js';
import { workflowResult, type WorkflowResult } from './result.js';
import { resultTable, type ResultRow } from './values.js';
import { workflow, type Workflow } from './workflow.js';

// An axis-aligned bounding box in one registered coordinate frame.
export type Box = {
  readonly minX: number;
  readonly minY: number;
  readonly minZ: number;
  readonly maxX: number;
  readonly maxY: number;
  readonly maxZ: number;
};

// A box the input either states or reports as missing. Model's `Observation` carries a `FactValue`,
// which has no shape for a box, so this workflow states its own purely validating equivalent: it
// follows `src/observation.ts`'s `known`/`missing` shape but never converts what it accepts.
export type BoxObservation = { readonly kind: 'known'; readonly value: Box } | { readonly kind: 'missing'; readonly reason: MissingReason };

// An equipment clearance or access envelope.
export type CoordinationEnvelope = { readonly objectId: string; readonly discipline: string; readonly bbox: BoxObservation };

// A wall or slab opening.
export type CoordinationPenetration = { readonly objectId: string; readonly discipline: string; readonly bbox: BoxObservation };

// The envelopes and penetrations this coordination check compares, sharing one coordinate frame.
export type AccessCoordinationInput = {
  readonly model: ModelRef;
  readonly envelopes: readonly CoordinationEnvelope[];
  readonly penetrations: readonly CoordinationPenetration[];
};

const boxSchema: Schema<Box> = object({
  minX: number(),
  minY: number(),
  minZ: number(),
  maxX: number(),
  maxY: number(),
  maxZ: number(),
});

// The JSON form of a `BoxObservation`.
export const boxObservationSchema: Schema<BoxObservation> = union<BoxObservation>(
  object({ kind: literal('known'), value: boxSchema }),
  object({ kind: literal('missing'), reason: missingReasonSchema }),
);

const participantSchema = object({ objectId: string(), discipline: string(), bbox: boxObservationSchema });

// The JSON an access coordination check is given.
export const accessCoordinationInputSchema: Schema<AccessCoordinationInput> = object({
  model: modelRefSchema,
  envelopes: array(participantSchema),
  penetrations: array(participantSchema),
});

// Whether two boxes overlap on every axis: the standard AABB overlap test, with touching bounds
// (equal on an axis) counted as overlapping.
const boxesOverlap = (a: Box, b: Box): boolean =>
  a.minX <= b.maxX && b.minX <= a.maxX && a.minY <= b.maxY && b.minY <= a.maxY && a.minZ <= b.maxZ && b.minZ <= a.maxZ;

// The centre of the region two overlapping boxes share, which is the point the input actually
// states for this pair; nothing here invents a position.
const overlapCentre = (a: Box, b: Box): Vec3 => [
  (Math.max(a.minX, b.minX) + Math.min(a.maxX, b.maxX)) / 2,
  (Math.max(a.minY, b.minY) + Math.min(a.maxY, b.maxY)) / 2,
  (Math.max(a.minZ, b.minZ) + Math.min(a.maxZ, b.maxZ)) / 2,
];

// One candidate finding, holding the two known boxes it was computed from rather than the raw
// participants, so nothing downstream has to re-narrow an `Observation` that has already resolved.
type Finding = {
  readonly envelopeId: string;
  readonly envelopeDiscipline: string;
  readonly envelopeBox: Box;
  readonly penetrationId: string;
  readonly penetrationDiscipline: string;
  readonly penetrationBox: Box;
};

const findingRow = (finding: Finding): ResultRow => ({
  envelopeId: finding.envelopeId,
  penetrationId: finding.penetrationId,
  disciplines: [finding.envelopeDiscipline, finding.penetrationDiscipline],
  basis: 'bounding-box-overlap',
});

// A coordination gap: the participant's bounds are not registered, so it cannot be tested for
// overlap at all. It is reported once, never silently skipped and never treated as "no overlap."
const gapException = (item: { readonly objectId: string }, reason: MissingReason): WorkflowException =>
  workflowException([item.objectId], 'bbox', missing(reason), {
    detail: 'coordination gap: no registered coordinates',
  });

// Shared penetrations and equipment access coordination: an axis-aligned bounding-box overlap
// between an envelope and a penetration is reported as a candidate finding, never as a verified
// clash, and a participant with no registered bounds is reported as a coordination gap instead of
// being silently skipped or treated as clear.
export const runAccessCoordination = (input: AccessCoordinationInput): Result<WorkflowResult> => {
  const duplicates = [
    ...duplicateDiagnostics('envelopes', input.envelopes.map((item) => item.objectId)),
    ...duplicateDiagnostics('penetrations', input.penetrations.map((item) => item.objectId)),
  ];
  if (duplicates.length > 0) return failure(duplicates);

  const diagnostics: Diagnostic[] = [];

  const findings: readonly Finding[] = input.envelopes.flatMap((envelope) => {
    const envelopeBox = envelope.bbox;
    return envelopeBox.kind !== 'known'
      ? []
      : input.penetrations.flatMap((penetration) => {
          const penetrationBox = penetration.bbox;
          return penetrationBox.kind === 'known' && boxesOverlap(envelopeBox.value, penetrationBox.value)
            ? [
                {
                  envelopeId: envelope.objectId,
                  envelopeDiscipline: envelope.discipline,
                  envelopeBox: envelopeBox.value,
                  penetrationId: penetration.objectId,
                  penetrationDiscipline: penetration.discipline,
                  penetrationBox: penetrationBox.value,
                },
              ]
            : [];
        });
  });

  const exceptions: readonly WorkflowException[] = [
    ...input.envelopes.flatMap((item) => (item.bbox.kind === 'missing' ? [gapException(item, item.bbox.reason)] : [])),
    ...input.penetrations.flatMap((item) => (item.bbox.kind === 'missing' ? [gapException(item, item.bbox.reason)] : [])),
  ];

  const candidateIds = [...new Set(findings.flatMap((finding) => [finding.envelopeId, finding.penetrationId]))];
  const gapIds = exceptions.flatMap((item) => item.subjects);

  const rules = outcomeRules(
    'access-coordination',
    groupByOutcome([
      ...candidateIds.map((id): readonly [string, Outcome] => [keyOf(input.model, id), 'candidate']),
      ...gapIds.map((id): readonly [string, Outcome] => [keyOf(input.model, id), 'missing']),
    ]),
  );

  const overlays: readonly Overlay[] = findings.map((finding) =>
    marker(
      `access-coordination/${finding.envelopeId}/${finding.penetrationId}`,
      `Candidate overlap: ${finding.envelopeId} and ${finding.penetrationId}`,
      'candidate',
      atPoint(overlapCentre(finding.envelopeBox, finding.penetrationBox)),
    ),
  );

  return resultOf(
    workflowResult({
      id: 'access-coordination',
      title: 'Shared penetrations and equipment access coordination',
      model: input.model,
      tables: [resultTable('candidateFindings', 'Candidate access-coordination findings', findings.map(findingRow))],
      summary: { candidateCount: findings.length, coordinationGapCount: exceptions.length },
      exceptions,
      rules,
      sets: [
        namedObjectSet('access-coordination/candidates', 'Candidate overlap participants', input.model, candidateIds),
        namedObjectSet('access-coordination/gaps', 'Coordination gaps', input.model, gapIds),
      ],
      overlays,
      view: suggestedView(
        'access-coordination',
        'Candidate access-coordination findings',
        keysOf(input.model, candidateIds),
        rules,
      ),
      selectSetId: 'access-coordination/candidates',
    }),
    diagnostics,
  );
};

// Access coordination: an envelope and a penetration whose registered bounding boxes overlap on
// every axis become a candidate finding, stated as a bounding-box overlap and never as a verified
// clash; a participant with no registered bounds is a coordination gap, not a cleared check.
export const accessCoordinationWorkflow: Workflow = workflow({
  id: 'access-coordination',
  title: 'Shared penetrations and equipment access coordination',
  description:
    'Reports an axis-aligned bounding-box overlap between an envelope and a penetration as a candidate finding, ' +
    'basis "bounding-box-overlap", never as a verified clash. A participant with no registered coordinates is a ' +
    'coordination gap, reported on its own rather than skipped or treated as clear.',
  basis: 'synthetic',
  input: accessCoordinationInputSchema,
  run: runAccessCoordination,
});
