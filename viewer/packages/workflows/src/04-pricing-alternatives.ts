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
import { resultRecord, type ResultRecord, resultTable, type ResultRow } from './values.js';
import { workflow, type Workflow } from './workflow.js';

// One priceable scope item.
export type PricingScope = { readonly objectId: string; readonly scopeType: string; readonly quantity: ObservationJson };

// One rate record: what one unit of one scope type costs, under one scenario.
export type PricingRate = {
  readonly id: string;
  readonly scopeType: string;
  readonly scenario: string;
  readonly currency: string;
  readonly unit: string;
  readonly ratePerUnit: number;
};

// One pricing scenario.
export type PricingScenario = { readonly id: string; readonly name: string };

// The scopes to price, the rates supplied for pricing them, and the scenarios to price under.
export type PricingAlternativesInput = {
  readonly model: ModelRef;
  readonly scopes: readonly PricingScope[];
  readonly rates: readonly PricingRate[];
  readonly scenarios: readonly PricingScenario[];
};

// The JSON a pricing-alternatives run is given.
export const pricingAlternativesInputSchema: Schema<PricingAlternativesInput> = object({
  model: modelRefSchema,
  scopes: array(object({ objectId: string(), scopeType: string(), quantity: observationJsonSchema })),
  rates: array(
    object({
      id: string(),
      scopeType: string(),
      scenario: string(),
      currency: string(),
      unit: string(),
      ratePerUnit: number(),
    }),
  ),
  scenarios: array(object({ id: string(), name: string() })),
});

type Priced = { readonly kind: 'priced'; readonly quantity: number; readonly unit: string; readonly rate: PricingRate; readonly cost: number };
type Unpriced = { readonly kind: 'unpriced'; readonly field: string; readonly observation: Observation; readonly detail: string };
type Pricing = Priced | Unpriced;

// One scope priced under one scenario: exactly one rate must match the scope type, the scenario and
// the scope's known quantity unit. A quantity that is not itself known settles the outcome on its
// own, carrying that observation's own kind and reason rather than "no rate found".
const pricingOf = (input: PricingAlternativesInput, scope: PricingScope, scenario: PricingScenario): Pricing => {
  const observed = toObservation(scope.quantity);
  if (observed.kind !== 'known') return { kind: 'unpriced', field: 'quantity', observation: observed, detail: '' };
  if (observed.value.kind !== 'quantity')
    return {
      kind: 'unpriced',
      field: 'quantity',
      observation: missing('unresolved-source'),
      detail: 'the quantity is not a number a rate can be applied to',
    };
  const quantity = observed.value.quantity.value;
  const unit = observed.value.quantity.unit;
  const matches = input.rates.filter((rate) => rate.scopeType === scope.scopeType && rate.scenario === scenario.id);
  if (matches.length === 0) return { kind: 'unpriced', field: 'rate', observation: missing('not-provided'), detail: '' };
  const usable = matches.filter((rate) => rate.unit === unit);
  if (usable.length !== 1)
    return {
      kind: 'unpriced',
      field: 'rate',
      observation: missing('unresolved-source'),
      detail:
        usable.length === 0
          ? `rate unit '${matches[0]?.unit ?? ''}' does not match quantity unit '${unit}'`
          : `${usable.length} rates matched this scope, scenario and unit`,
    };
  const rate = usable[0];
  return rate === undefined
    ? { kind: 'unpriced', field: 'rate', observation: missing('not-provided'), detail: '' }
    : { kind: 'priced', quantity, unit, rate, cost: quantity * rate.ratePerUnit };
};

const outcomeOf = (pricing: Pricing): Outcome =>
  pricing.kind === 'priced' ? 'resolved' : pricing.observation.kind === 'conflicting' ? 'conflicting' : 'missing';

// Pricing alternatives: each scenario prices every scope independently from the rates supplied for
// it. A scope with no matching rate, a rate whose unit does not match the scope's quantity, or a
// quantity that is itself unavailable or disputed is reported as an exception, never as a zero cost.
export const runPricingAlternatives = (input: PricingAlternativesInput): Result<WorkflowResult> => {
  const duplicates = [
    ...duplicateDiagnostics('scopes', input.scopes.map((scope) => scope.objectId)),
    ...duplicateDiagnostics('rates', input.rates.map((rate) => rate.id)),
    ...duplicateDiagnostics('scenarios', input.scenarios.map((scenario) => scenario.id)),
  ];
  if (duplicates.length > 0) return failure(duplicates);

  const diagnostics: Diagnostic[] = [];
  const computed = input.scenarios.flatMap((scenario) =>
    input.scopes.map((scope) => ({ scope, scenario, pricing: pricingOf(input, scope, scenario) })),
  );

  const rows: readonly ResultRow[] = computed.flatMap((entry) =>
    entry.pricing.kind === 'priced'
      ? [
          resultRecord({
            objectId: entry.scope.objectId,
            scenario: entry.scenario.id,
            quantity: entry.pricing.quantity,
            unit: entry.pricing.unit,
            ratePerUnit: entry.pricing.rate.ratePerUnit,
            cost: entry.pricing.cost,
            currency: entry.pricing.rate.currency,
          }),
        ]
      : [],
  );

  const exceptions: readonly WorkflowException[] = computed.flatMap((entry) =>
    entry.pricing.kind === 'priced'
      ? []
      : [
          workflowException([entry.scope.objectId], entry.pricing.field, entry.pricing.observation, {
            scope: entry.scenario.id,
            detail: entry.pricing.detail,
          }),
        ],
  );

  const totalsByScenario: ResultRecord = Object.fromEntries(
    input.scenarios.flatMap((scenario) => {
      const costs = computed.flatMap((entry) =>
        entry.scenario.id === scenario.id && entry.pricing.kind === 'priced' ? [entry.pricing.cost] : [],
      );
      return costs.length === 0 ? [] : [[scenario.id, costs.reduce((sum, cost) => sum + cost, 0)] as const];
    }),
  );

  // One colour per scope across every scenario: resolved only when every scenario priced it, so a
  // scene never shows a scope as settled while one scenario still cannot price it.
  const outcomeByScope = input.scopes.map((scope): readonly [string, Outcome] => [
    keyOf(input.model, scope.objectId),
    computed
      .filter((entry) => entry.scope.objectId === scope.objectId)
      .reduce<Outcome>((outcome, entry) => worseOutcome(outcome, outcomeOf(entry.pricing)), 'resolved'),
  ]);
  const rules = outcomeRules('pricing-alternatives', groupByOutcome(outcomeByScope));

  const unresolvedIds = [...new Set(exceptions.flatMap((item) => item.subjects))];
  const overlays: readonly Overlay[] = computed.flatMap((entry) =>
    entry.pricing.kind === 'priced'
      ? []
      : [
          marker(
            `pricing-alternatives/${entry.scenario.id}/${entry.scope.objectId}`,
            `${entry.scope.objectId} unpriced in ${entry.scenario.name}: ${entry.pricing.field}`,
            outcomeOf(entry.pricing),
            onObject(keyOf(input.model, entry.scope.objectId)),
          ),
        ],
  );

  return resultOf(
    workflowResult({
      id: 'pricing-alternatives',
      title: 'Pricing alternatives',
      model: input.model,
      tables: [resultTable('priced', 'Priced scopes', rows)],
      summary: resultRecord({
        totalCostByScenario: totalsByScenario,
        scenarios: input.scenarios.map((scenario) => scenario.id),
        unpricedCount: exceptions.length,
      }),
      exceptions,
      rules,
      sets: [
        namedObjectSet(
          'pricing-alternatives/resolved',
          'Scopes priced in every scenario',
          input.model,
          input.scopes.map((scope) => scope.objectId).filter((objectId) => !unresolvedIds.includes(objectId)),
        ),
        namedObjectSet('pricing-alternatives/unresolved', 'Unpriced in some scenario', input.model, unresolvedIds),
        ...input.scenarios.map((scenario) =>
          namedObjectSet(
            `pricing-alternatives/unresolved/${scenario.id}`,
            `Unpriced in ${scenario.name}`,
            input.model,
            exceptions.filter((item) => item.scope === scenario.id).flatMap((item) => item.subjects),
          ),
        ),
      ],
      overlays,
      view: suggestedView(
        'pricing-alternatives',
        'Unpriced scopes',
        keysOf(input.model, unresolvedIds),
        rules,
      ),
      selectSetId: 'pricing-alternatives/unresolved',
      extraSteps: [
        step(
          workflowCommands.linkViews,
          { views: input.scenarios.map((scenario) => ({ scenario: scenario.id })) },
          'Compare the pricing scenarios side by side.',
        ),
      ],
    }),
    diagnostics,
  );
};

// Pricing alternatives: cost per scope per scenario from the rates supplied for it. An unmatched
// scope type, a rate whose unit does not match, and a scope whose own quantity is unavailable or
// disputed all stay explicit unpriced exceptions; nothing is priced at zero.
export const pricingAlternativesWorkflow: Workflow = workflow({
  id: 'pricing-alternatives',
  title: 'Pricing alternatives',
  description:
    'Prices each scope under each scenario from the one rate whose scope type, scenario and unit match. A scope ' +
    'with no matching rate, a rate whose unit does not match the scope quantity, and a scope whose own quantity is ' +
    'not known each stay an explicit exception; nothing is priced at zero and currencies are never converted.',
  basis: 'synthetic',
  input: pricingAlternativesInputSchema,
  run: runPricingAlternatives,
});
