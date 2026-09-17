// The heat map: one banded colouring per scenario over the contributions the workflow resolved,
// and the switch that shows one scenario at a time.
//
// The scale is fixed rather than measured, and it is the same scale in both scenarios. That is the
// whole point of comparing them: a box that is darker in one scenario than in the other is carrying
// more carbon, not being drawn against a different ruler.
//
// The ramp's two ends are a display convention stated here. The colours an unresolved contribution
// takes are the workflows package's own outcome palette, so a gap on this page looks like a gap on
// every other workflow page. Neither is a theme token, so changing theme or text size does not
// change what a colour means. A ramp published by `workflows` beside `outcomeAppearance` would let
// this file state nothing at all; that is a request in CHECKPOINT-D4.md.

import { numericStyling, type Legend, type NumericScale, type Styling } from '@bim-open-toolkit/features';
import {
  f64Column,
  stringColumn,
  table,
  type Color,
  type Result,
  type Session,
  type Table,
} from '@bim-open-toolkit/model';
import { outcomeAppearance, resultRows, type ResultRow, type WorkflowResult } from '@bim-open-toolkit/workflows';
import { carbonKey } from './carbon.js';

// The low end of the carbon ramp: the least carbon on the fixed scale.
export const carbonRampLow: Color = [0.97, 0.93, 0.75];

// The high end of the carbon ramp: the most carbon on the fixed scale.
export const carbonRampHigh: Color = [0.52, 0.09, 0.06];

// The colour of a contribution nobody could resolve, from the workflows package's outcome palette.
export const unresolvedColor: Color = outcomeAppearance.missing.color ?? [0.6, 0.6, 0.6];

// The colour of a quantity whose sources disagree, from the same palette.
export const disputedColor: Color = outcomeAppearance.conflicting.color ?? [0.6, 0.6, 0.6];

// The fixed range every scenario is drawn against, in kilogrammes of carbon dioxide equivalent.
// A contribution above the top of the scale takes the top colour, which the legend states.
export const carbonScaleMax = 14000;

// How many steps the ramp is divided into. A rule carries one colour, so the bands are what the
// objects actually get and the legend says how many there are.
export const carbonBands = 6;

// The rules and legend of one scenario are named after it, so switching scenario is switching which
// of these rule sets is enabled.
export const scenarioStylingId = (scenario: string): string => `material-carbon/heat/${scenario}`;

// The scale one scenario is drawn against. It does not depend on the scenario: that is what makes
// the two comparable.
export const carbonScale = (scenario: string): NumericScale => ({
  title: `Embodied carbon, ${scenario}`,
  min: 0,
  max: carbonScaleMax,
  low: carbonRampLow,
  high: carbonRampHigh,
  bands: carbonBands,
  missing: { value: 'unresolved', label: 'Unresolved in this scenario', color: unresolvedColor },
});

const textOf = (row: ResultRow, name: string): string => {
  const value = row[name];
  return typeof value === 'string' ? value : '';
};

const numberOf = (row: ResultRow, name: string): number | undefined => {
  const value = row[name];
  return typeof value === 'number' ? value : undefined;
};

// One resolved contribution: an object, a scenario and the figure the workflow computed.
export type Contribution = { readonly objectId: string; readonly scenario: string; readonly kgCO2e: number };

// Every contribution the workflow resolved, in the order its table holds them.
export const contributionsOf = (result: WorkflowResult): readonly Contribution[] =>
  resultRows(result, 'contributions').flatMap((row) => {
    const value = numberOf(row, 'kgCO2e');
    return value === undefined
      ? []
      : [{ objectId: textOf(row, 'objectId'), scenario: textOf(row, 'scenario'), kgCO2e: value }];
  });

// The contributions of one scenario.
export const contributionsIn = (result: WorkflowResult, scenario: string): readonly Contribution[] =>
  contributionsOf(result).filter((item) => item.scenario === scenario);

// The total of one scenario's resolved contributions, or nothing when it resolved none. A scenario
// with nothing resolved has no total rather than a total of zero.
export const scenarioTotal = (result: WorkflowResult, scenario: string): number | undefined => {
  const items = contributionsIn(result, scenario);
  return items.length === 0 ? undefined : items.reduce((sum, item) => sum + item.kgCO2e, 0);
};

// How many contributions one scenario could not resolve.
export const unresolvedCount = (result: WorkflowResult, scenario: string): number =>
  result.exceptions.filter((item) => item.scope === scenario).length;

// The keys and figures one scenario resolved, as the two-column table a colouring reads. An object
// with no resolved contribution is not in it, so no rule of this colouring names it and the
// workflow's own outcome rule is what colours it.
export const heatTable = (result: WorkflowResult, scenario: string): Table => {
  const items = contributionsIn(result, scenario);
  return table([
    ['key', stringColumn(items.map((item) => carbonKey(item.objectId)))],
    ['kgCO2e', f64Column(items.map((item) => item.kgCO2e))],
  ]);
};

// One scenario's colouring: the banded rules and the legend that explains them, made together from
// one table so they cannot disagree.
export const scenarioStyling = (result: WorkflowResult, scenario: string): Result<Styling> =>
  numericStyling(
    scenarioStylingId(scenario),
    heatTable(result, scenario),
    'key',
    'kgCO2e',
    carbonScale(scenario),
    // Above the workflow's own resolved rule and below its missing and conflicting ones, so the
    // heat map colours what resolved and never paints over a gap.
    3,
  );

// One scenario's colouring, ready to dispatch.
export type ScenarioStyling = { readonly scenario: string; readonly rules: readonly string[]; readonly legend: Legend };

// The rules of one scenario as `appearance.addRules` takes them, enabled only when it is the
// scenario the page opens on.
export const addScenarioStyling = (
  session: Session,
  result: WorkflowResult,
  scenario: string,
  enabled: boolean,
): Result<ScenarioStyling> => {
  const built = scenarioStyling(result, scenario);
  if (!built.ok) return built;
  const rules = built.value.rules.map((rule) => ({ ...rule, enabled }));
  const sent = session.dispatch('appearance.addRules', { rules, legend: built.value.legend });
  return sent.ok
    ? { ok: true, value: { scenario, rules: rules.map((rule) => rule.id), legend: built.value.legend }, diagnostics: sent.diagnostics }
    : { ok: false, diagnostics: sent.diagnostics };
};

// Shows one scenario by enabling its rules and switching the others off. Nothing is added or
// removed, so the two colourings stay in the document and a saved view carries both.
export const showScenario = (
  session: Session,
  stylings: readonly ScenarioStyling[],
  scenario: string,
): void => {
  for (const styling of stylings)
    for (const id of styling.rules)
      session.dispatch('appearance.setRuleEnabled', { id, enabled: styling.scenario === scenario });
};
