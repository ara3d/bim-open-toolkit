import {
  array,
  failure,
  missing,
  modelRefSchema,
  number,
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
import { observationJsonSchema, toObservation, type ObservationJson } from './observation.js';
import { marker, onObject, type Overlay } from './overlay.js';
import { groupByOutcome, outcomeRules, worseOutcome, type Outcome } from './outcome.js';
import { step, workflowCommands } from './recipe.js';
import { workflowResult, type WorkflowResult } from './result.js';
import { resultRecord, resultTable, type ResultRecord, type ResultRow } from './values.js';
import { workflow, type Workflow } from './workflow.js';

// How much of one material one object is made of.
export type MaterialQuantity = {
  readonly objectId: string;
  readonly materialId: string;
  readonly quantity: ObservationJson;
};

// A carbon factor: how much one unit of a material counts for, in one scenario and lifecycle scope.
export type CarbonFactor = {
  readonly id: string;
  readonly materialId: string;
  readonly scenario: string;
  readonly unit: string;
  readonly lifecycleScope: string;
  readonly factorValue: number;
};

// The material quantities, the factors, and the one lifecycle scope this run asks about.
// Scenarios are the scenarios the factors name, in the order they first appear.
export type MaterialCarbonInput = {
  readonly model: ModelRef;
  readonly requestedLifecycleScope: string;
  readonly quantities: readonly MaterialQuantity[];
  readonly factors: readonly CarbonFactor[];
};

// The JSON a material carbon run is given.
export const materialCarbonInputSchema: Schema<MaterialCarbonInput> = object({
  model: modelRefSchema,
  requestedLifecycleScope: string(),
  quantities: array(object({ objectId: string(), materialId: string(), quantity: observationJsonSchema })),
  factors: array(
    object({
      id: string(),
      materialId: string(),
      scenario: string(),
      unit: string(),
      lifecycleScope: string(),
      factorValue: number(),
    }),
  ),
});

type Contribution =
  | { readonly kind: 'resolved'; readonly kgCO2e: number }
  | { readonly kind: 'unresolved'; readonly field: string; readonly observation: Observation; readonly detail: string };

const contributionOf = (
  input: MaterialCarbonInput,
  item: MaterialQuantity,
  scenario: string,
): Contribution => {
  const observed = toObservation(item.quantity);
  // A quantity that is not known settles the contribution on its own: no factor is consulted, and
  // the reason reported is the quantity's own, not a claim about the factor.
  if (observed.kind !== 'known')
    return { kind: 'unresolved', field: 'quantity', observation: observed, detail: '' };
  const value = observed.value;
  const factor = input.factors.find((entry) => entry.materialId === item.materialId && entry.scenario === scenario);
  if (factor === undefined)
    return {
      kind: 'unresolved',
      field: 'factor',
      observation: missing('not-provided'),
      detail: `no factor for material '${item.materialId}' in scenario '${scenario}'`,
    };
  if (factor.lifecycleScope !== input.requestedLifecycleScope)
    return {
      kind: 'unresolved',
      field: 'factor',
      observation: missing('unresolved-source'),
      detail: `factor lifecycleScope '${factor.lifecycleScope}' does not match requested '${input.requestedLifecycleScope}'`,
    };
  const unit = value.kind === 'quantity' ? value.quantity.unit : '';
  if (factor.unit !== unit)
    return {
      kind: 'unresolved',
      field: 'factor',
      observation: missing('unresolved-source'),
      detail: `factor unit '${factor.unit}' does not match quantity unit '${unit}'`,
    };
  return value.kind === 'quantity'
    ? { kind: 'resolved', kgCO2e: value.quantity.value * factor.factorValue }
    : {
        kind: 'unresolved',
        field: 'quantity',
        observation: missing('unresolved-source'),
        detail: 'the quantity is not a number a factor can be applied to',
      };
};

const outcomeOf = (contribution: Contribution): Outcome =>
  contribution.kind === 'resolved'
    ? 'resolved'
    : contribution.observation.kind === 'conflicting'
      ? 'conflicting'
      : 'missing';

// Material carbon per scenario. A contribution is computed only from a known quantity and a factor
// that matches the material, the scenario, the unit and the requested lifecycle scope. Everything
// else stays an explicit unresolved contribution: no factor is converted, substituted or assumed,
// and an unresolved contribution never counts as zero in a total.
export const runMaterialCarbon = (input: MaterialCarbonInput): Result<WorkflowResult> => {
  const duplicates = [
    ...duplicateDiagnostics('quantities', input.quantities.map((item) => item.objectId)),
    ...duplicateDiagnostics('factors', input.factors.map((item) => item.id)),
  ];
  if (duplicates.length > 0) return failure(duplicates);

  const diagnostics: Diagnostic[] = [];
  const scenarios: readonly string[] = [...new Set(input.factors.map((factor) => factor.scenario))];
  const computed = scenarios.flatMap((scenario) =>
    input.quantities.map((item) => ({ item, scenario, contribution: contributionOf(input, item, scenario) })),
  );

  const rows: readonly ResultRow[] = computed.flatMap((entry) =>
    entry.contribution.kind === 'resolved'
      ? [{ objectId: entry.item.objectId, scenario: entry.scenario, kgCO2e: entry.contribution.kgCO2e }]
      : [],
  );

  const exceptions: readonly WorkflowException[] = computed.flatMap((entry) =>
    entry.contribution.kind === 'resolved'
      ? []
      : [
          workflowException([entry.item.objectId], entry.contribution.field, entry.contribution.observation, {
            scope: entry.scenario,
            detail: entry.contribution.detail,
          }),
        ],
  );

  // A scenario with no resolved contribution has no total at all, rather than a total of zero.
  const totals: ResultRecord = Object.fromEntries(
    scenarios.flatMap((scenario) => {
      const resolved = computed.flatMap((entry) =>
        entry.scenario === scenario && entry.contribution.kind === 'resolved' ? [entry.contribution.kgCO2e] : [],
      );
      return resolved.length === 0
        ? []
        : [[scenario, resolved.reduce((sum, value) => sum + value, 0)] as const];
    }),
  );

  // One colour per object across every scenario: resolved only when every scenario resolved it, so
  // a scene never shows an object as settled while one scenario still cannot account for it.
  const outcomeByObject = input.quantities.map((item): readonly [string, Outcome] => [
    keyOf(input.model, item.objectId),
    computed
      .filter((entry) => entry.item.objectId === item.objectId)
      .reduce<Outcome>((outcome, entry) => worseOutcome(outcome, outcomeOf(entry.contribution)), 'resolved'),
  ]);
  const rules = outcomeRules('material-carbon', groupByOutcome(outcomeByObject));

  const unresolvedIds = [...new Set(exceptions.flatMap((item) => item.subjects))];
  const overlays: readonly Overlay[] = computed.flatMap((entry) =>
    entry.contribution.kind === 'resolved'
      ? []
      : [
          marker(
            `material-carbon/${entry.scenario}/${entry.item.objectId}`,
            `${entry.item.objectId} unresolved in ${entry.scenario}: ${entry.contribution.field}`,
            outcomeOf(entry.contribution),
            onObject(keyOf(input.model, entry.item.objectId)),
          ),
        ],
  );

  return resultOf(
    workflowResult({
      id: 'material-carbon',
      title: 'Material carbon',
      model: input.model,
      tables: [resultTable('contributions', 'Carbon contributions', rows)],
      summary: resultRecord({
        totalKnownKgCO2e: totals,
        requestedLifecycleScope: input.requestedLifecycleScope,
        scenarios,
        unresolvedCount: exceptions.length,
      }),
      exceptions,
      rules,
      sets: [
        namedObjectSet(
          'material-carbon/resolved',
          'Objects accounted for in every scenario',
          input.model,
          input.quantities
            .map((item) => item.objectId)
            .filter((objectId) => !unresolvedIds.includes(objectId)),
        ),
        namedObjectSet('material-carbon/unresolved', 'Unresolved contributions', input.model, unresolvedIds),
        ...scenarios.map((scenario) =>
          namedObjectSet(
            `material-carbon/unresolved/${scenario}`,
            `Unresolved in ${scenario}`,
            input.model,
            exceptions.filter((item) => item.scope === scenario).flatMap((item) => item.subjects),
          ),
        ),
      ],
      overlays,
      view: suggestedView(
        'material-carbon',
        'Unresolved carbon contributions',
        keysOf(input.model, unresolvedIds),
        rules,
      ),
      selectSetId: 'material-carbon/unresolved',
      extraSteps: [
        step(
          workflowCommands.linkViews,
          { views: scenarios.map((scenario) => ({ scenario })) },
          'Compare the scenarios side by side.',
        ),
      ],
    }),
    diagnostics,
  );
};

// Material carbon with every unresolved contribution stated rather than dropped or zeroed.
export const materialCarbonWorkflow: Workflow = workflow({
  id: 'material-carbon',
  title: 'Material carbon',
  description:
    'Multiplies a known material quantity by the factor that matches its material, scenario, unit and the requested ' +
    'lifecycle scope. A missing factor, a unit or scope mismatch, and a quantity that is itself unavailable or ' +
    'disputed each stay an explicit unresolved contribution; totals sum resolved contributions only.',
  basis: 'synthetic',
  input: materialCarbonInputSchema,
  run: runMaterialCarbon,
});
