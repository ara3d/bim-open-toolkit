import {
  array,
  fact,
  failure,
  missing,
  modelRefSchema,
  object,
  objectRef,
  resultOf,
  string,
  sumQuantities,
  type Diagnostic,
  type ModelRef,
  type Observation,
  type Result,
  type Schema,
} from '@bim-open-toolkit/model';
import { workflowException, type WorkflowException } from './exception.js';
import { duplicateDiagnostics, keyOf, keysOf, namedObjectSet, suggestedView } from './keys.js';
import { observationJsonSchema, toObservation, type ObservationJson } from './observation.js';
import { label, onObject, type Overlay } from './overlay.js';
import { groupByOutcome, outcomeRules, type Outcome } from './outcome.js';
import { workflowResult, type WorkflowResult } from './result.js';
import { resultRecord, resultTable, type ResultRow } from './values.js';
import { workflow, type Workflow } from './workflow.js';

// One physical building, which is the identity a portfolio rolls up to.
export type PortfolioBuilding = { readonly buildingId: string; readonly name: string; readonly siteId: string };

// One source document. `buildingIds` is what somebody decided the document represents: empty means
// nobody has decided yet, and more than one means the decision is not settled.
export type PortfolioDocument = { readonly documentId: string; readonly buildingIds: readonly string[] };

// One reported figure, always reported per source document rather than per building.
export type PortfolioMetric = {
  readonly id: string;
  readonly documentId: string;
  readonly metricName: string;
  readonly value: ObservationJson;
};

// The portfolio, the documents its figures come from, and the metric the rollup adds up.
export type PortfolioInput = {
  readonly model: ModelRef;
  readonly requestedMetricName: string;
  readonly buildings: readonly PortfolioBuilding[];
  readonly documents: readonly PortfolioDocument[];
  readonly metrics: readonly PortfolioMetric[];
};

// The JSON a portfolio drill-through is given.
export const portfolioInputSchema: Schema<PortfolioInput> = object({
  model: modelRefSchema,
  requestedMetricName: string(),
  buildings: array(object({ buildingId: string(), name: string(), siteId: string() })),
  documents: array(object({ documentId: string(), buildingIds: array(string()) })),
  metrics: array(
    object({ id: string(), documentId: string(), metricName: string(), value: observationJsonSchema }),
  ),
});

type Attribution =
  | { readonly kind: 'resolved'; readonly buildingId: string; readonly observation: Observation }
  | {
      readonly kind: 'unresolved';
      readonly field: string;
      readonly observation: Observation;
      readonly detail: string;
      readonly candidates: readonly string[];
    };

const mappingProblem = (input: PortfolioInput, metric: PortfolioMetric): Attribution | undefined => {
  const document = input.documents.find((entry) => entry.documentId === metric.documentId);
  if (document === undefined)
    return {
      kind: 'unresolved',
      field: 'documentId',
      observation: missing('unresolved-source'),
      detail: `The metrics table names document "${metric.documentId}", which the documents table does not contain.`,
      candidates: [],
    };
  if (document.buildingIds.length === 1) return undefined;
  return {
    kind: 'unresolved',
    field: 'documentBuildings',
    observation: missing('unresolved-source'),
    detail:
      document.buildingIds.length === 0
        ? 'The document maps to no building.'
        : `The document maps to ${document.buildingIds.length} candidate buildings.`,
    candidates: document.buildingIds,
  };
};

// A metric belongs to a building only when its document names exactly one, because a source
// document is not a building and this workflow never picks one of several candidates. A figure that
// is itself unavailable or disputed is reported whether or not the mapping is settled.
const attributionOf = (input: PortfolioInput, metric: PortfolioMetric): readonly Attribution[] => {
  const mapping = mappingProblem(input, metric);
  const observation = toObservation(metric.value);
  const value: readonly Attribution[] =
    observation.kind === 'known'
      ? []
      : [{ kind: 'unresolved', field: 'value', observation, detail: '', candidates: [] }];
  const buildingId = input.documents.find((entry) => entry.documentId === metric.documentId)?.buildingIds[0];
  return mapping !== undefined || value.length > 0
    ? [...(mapping === undefined ? [] : [mapping]), ...value]
    : buildingId === undefined
      ? []
      : [{ kind: 'resolved', buildingId, observation }];
};

const scalarOf = (observation: Observation): number | undefined =>
  observation.kind === 'known' && observation.value.kind === 'quantity' ? observation.value.quantity.value : undefined;

// Portfolio comparison with drill-through to the document a figure came from. A figure is attributed
// to a building only through a document that names exactly one; an ambiguous or unmapped document,
// and a figure that is itself unavailable or disputed, are exceptions with their candidates visible.
// A site with no resolved contributor gets no rollup row at all, never a total of zero.
export const runPortfolioDrillThrough = (input: PortfolioInput): Result<WorkflowResult> => {
  const duplicates = [
    ...duplicateDiagnostics('buildings', input.buildings.map((item) => item.buildingId)),
    ...duplicateDiagnostics('documents', input.documents.map((item) => item.documentId)),
    ...duplicateDiagnostics('metrics', input.metrics.map((item) => item.id)),
  ];
  if (duplicates.length > 0) return failure(duplicates);

  const diagnostics: Diagnostic[] = [];
  const attributed = input.metrics.flatMap((metric) =>
    attributionOf(input, metric).map((attribution) => ({ metric, attribution })),
  );

  const rows: readonly ResultRow[] = attributed.flatMap((entry) =>
    entry.attribution.kind !== 'resolved'
      ? []
      : [
          resultRecord({
            buildingId: entry.attribution.buildingId,
            documentId: entry.metric.documentId,
            metricName: entry.metric.metricName,
            value: scalarOf(entry.attribution.observation) ?? null,
            unit:
              entry.attribution.observation.kind === 'known' &&
              entry.attribution.observation.value.kind === 'quantity'
                ? entry.attribution.observation.value.quantity.unit
                : undefined,
          }),
        ],
  );

  const exceptions: readonly WorkflowException[] = attributed.flatMap((entry) =>
    entry.attribution.kind === 'resolved'
      ? []
      : [
          workflowException(
            [entry.metric.id, entry.metric.documentId],
            entry.attribution.field,
            entry.attribution.observation,
            { related: entry.attribution.candidates, detail: entry.attribution.detail },
          ),
        ],
  );

  const resolvedFor = (buildingId: string): readonly Observation[] =>
    attributed.flatMap((entry) =>
      entry.attribution.kind === 'resolved' &&
      entry.attribution.buildingId === buildingId &&
      entry.metric.metricName === input.requestedMetricName
        ? [entry.attribution.observation]
        : [],
    );

  const sites: readonly string[] = [...new Set(input.buildings.map((item) => item.siteId))];
  const rollup: readonly ResultRow[] = sites.flatMap((siteId) => {
    const buildings = input.buildings.filter((item) => item.siteId === siteId);
    const contributors = buildings.filter((item) => resolvedFor(item.buildingId).length > 0);
    if (contributors.length === 0) return [];
    const total = sumQuantities(
      contributors.flatMap((item) =>
        resolvedFor(item.buildingId).map((observation) =>
          fact(objectRef(input.model, item.buildingId), input.requestedMetricName, observation),
        ),
      ),
    );
    // Values reported in more than one unit are not added up: `sumQuantities` refuses, and the site
    // is reported without a total rather than with a number that mixes units.
    return total === undefined
      ? []
      : [
          {
            siteId,
            metricName: input.requestedMetricName,
            total: total.value,
            unit: total.unit,
            resolvedBuildingCount: contributors.length,
            excludedBuildingCount: buildings.length - contributors.length,
          },
        ];
  });

  // A building a document names is coloured by what stopped its figure from resolving: a disputed
  // figure reads as a conflict, anything else as a gap.
  const candidateOf = (metric: PortfolioMetric): readonly string[] =>
    input.documents.find((item) => item.documentId === metric.documentId)?.buildingIds ?? [];

  const outcomeOf = (buildingId: string): Outcome =>
    resolvedFor(buildingId).length > 0
      ? 'resolved'
      : attributed.some(
            (entry) =>
              entry.attribution.kind === 'unresolved' &&
              entry.attribution.observation.kind === 'conflicting' &&
              candidateOf(entry.metric).includes(buildingId),
          )
        ? 'conflicting'
        : 'missing';

  const rules = outcomeRules(
    'portfolio',
    groupByOutcome(input.buildings.map((item) => [keyOf(input.model, item.buildingId), outcomeOf(item.buildingId)])),
  );

  const unresolvedBuildings = input.buildings
    .filter((item) => resolvedFor(item.buildingId).length === 0)
    .map((item) => item.buildingId);

  const overlays: readonly Overlay[] = rows.flatMap((row) => {
    const buildingId = row['buildingId'];
    const value = row['value'];
    return typeof buildingId !== 'string' || typeof value !== 'number'
      ? []
      : [
          label(
            `portfolio/${buildingId}`,
            `${buildingId}: ${value} ${String(row['unit'] ?? '')}`.trim(),
            'resolved',
            onObject(keyOf(input.model, buildingId)),
          ),
        ];
  });

  return resultOf(
    workflowResult({
      id: 'portfolio-drill-through',
      title: 'Portfolio comparison and drill-through',
      model: input.model,
      tables: [
        resultTable('drillThrough', 'Metrics by building', rows),
        resultTable('portfolioRollup', 'Site rollup', rollup),
      ],
      summary: {
        requestedMetricName: input.requestedMetricName,
        resolvedCount: rows.length,
        unresolvedCount: exceptions.length,
      },
      exceptions,
      rules,
      sets: [
        namedObjectSet(
          'portfolio/resolved',
          'Buildings with a resolved metric',
          input.model,
          input.buildings
            .map((item) => item.buildingId)
            .filter((buildingId) => !unresolvedBuildings.includes(buildingId)),
        ),
        namedObjectSet(
          'portfolio/unresolved',
          'Buildings with no resolved metric',
          input.model,
          unresolvedBuildings,
        ),
      ],
      overlays,
      view: suggestedView(
        'portfolio-drill-through',
        'Buildings with no resolved metric',
        keysOf(input.model, unresolvedBuildings),
        rules,
      ),
      selectSetId: 'portfolio/unresolved',
    }),
    diagnostics,
  );
};

// Portfolio comparison and drill-through, where a source document is never assumed to be a building.
export const portfolioDrillThroughWorkflow: Workflow = workflow({
  id: 'portfolio-drill-through',
  title: 'Portfolio comparison and drill-through',
  description:
    'Attributes a reported figure to a building only through a document that names exactly one building, and rolls ' +
    'the requested metric up per site. An ambiguous or unmapped document and a disputed figure stay exceptions with ' +
    'their candidates visible; a site with no resolved contributor has no total rather than a total of zero.',
  basis: 'synthetic',
  input: portfolioInputSchema,
  run: runPortfolioDrillThrough,
});
