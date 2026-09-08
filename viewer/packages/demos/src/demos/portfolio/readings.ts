// What the portfolio result says about one building, read off the result rather than re-derived.
//
// The workflow already decided which figures resolved, which documents are ambiguous and how each
// building should be coloured. Deriving any of that a second time here would be a second opinion
// nobody asked for, so every reading below reads the result's own tables, sets and rules.

import type { ObjectKey } from '@bim-open-toolkit/model';
import { resultRows, type Outcome, type ResultRow, type WorkflowResult } from '@bim-open-toolkit/workflows';
import { buildingKey, type PortfolioIndex } from './city.js';

// The five outcomes a workflow colours by, in the order `outcomeRules` writes them.
export const portfolioOutcomes: readonly Outcome[] = [
  'resolved',
  'candidate',
  'missing',
  'conflicting',
  'excluded',
];

// The outcome the result coloured an object by, or nothing when no rule names it.
export const outcomeOf = (result: WorkflowResult, key: ObjectKey): Outcome | undefined =>
  portfolioOutcomes.find((outcome) =>
    result.rules.some((rule) => rule.id === `portfolio/${outcome}` && rule.targets.includes(key)),
  );

// One figure the result attributed to a building, with the document it came through.
export type Reading = {
  readonly buildingId: string;
  readonly documentId: string;
  readonly metricName: string;
  readonly value: number;
  readonly unit: string;
};

const textOf = (row: ResultRow, name: string): string => {
  const value = row[name];
  return typeof value === 'string' ? value : '';
};

const numberOf = (row: ResultRow, name: string): number | undefined => {
  const value = row[name];
  return typeof value === 'number' ? value : undefined;
};

// Every figure the result resolved, in the order the drill-through table holds them.
export const readingsOf = (result: WorkflowResult): readonly Reading[] =>
  resultRows(result, 'drillThrough').flatMap((row) => {
    const value = numberOf(row, 'value');
    return value === undefined
      ? []
      : [
          {
            buildingId: textOf(row, 'buildingId'),
            documentId: textOf(row, 'documentId'),
            metricName: textOf(row, 'metricName'),
            value,
            unit: textOf(row, 'unit'),
          },
        ];
  });

// The resolved figures of one building for the metric the rollup adds up.
export const readingsFor = (
  result: WorkflowResult,
  buildingId: string,
  metricName: string,
): readonly Reading[] =>
  readingsOf(result).filter((item) => item.buildingId === buildingId && item.metricName === metricName);

// One site's rollup: the total of its resolved contributors, and how many buildings were left out.
export type Rollup = {
  readonly siteId: string;
  readonly metricName: string;
  readonly total: number;
  readonly unit: string;
  readonly resolvedBuildingCount: number;
  readonly excludedBuildingCount: number;
};

// Every site that had at least one resolved contributor. A site with none has no row at all, which
// is the workflow's rule and is why the sheet says "no rollup" rather than showing a zero.
export const rollupsOf = (result: WorkflowResult): readonly Rollup[] =>
  resultRows(result, 'portfolioRollup').flatMap((row) => {
    const total = numberOf(row, 'total');
    return total === undefined
      ? []
      : [
          {
            siteId: textOf(row, 'siteId'),
            metricName: textOf(row, 'metricName'),
            total,
            unit: textOf(row, 'unit'),
            resolvedBuildingCount: numberOf(row, 'resolvedBuildingCount') ?? 0,
            excludedBuildingCount: numberOf(row, 'excludedBuildingCount') ?? 0,
          },
        ];
  });

// What the demo shows about one building: its identity, the figure that resolved for it if any,
// and the outcome the workflow coloured it by.
export type BuildingReading = {
  readonly buildingId: string;
  readonly name: string;
  readonly siteId: string;
  readonly registration: string;
  readonly outcome: Outcome | undefined;
  readonly readings: readonly Reading[];
};

// Every building of the estate with what the result says about it, in the order the estate lists.
export const buildingReadings = (
  index: PortfolioIndex,
  result: WorkflowResult,
): readonly BuildingReading[] =>
  index.input.buildings.map((building) => ({
    buildingId: building.buildingId,
    name: building.name,
    siteId: building.siteId,
    registration: index.registration.get(building.buildingId) ?? 'unknown',
    outcome: outcomeOf(result, buildingKey(index, building.buildingId)),
    readings: readingsFor(result, building.buildingId, index.metricName),
  }));

// The one building the reader has drilled into, or nothing when the whole estate is shown.
// Drilling isolates exactly one building, so the isolation is what says which one.
export const drilledBuildingId = (
  index: PortfolioIndex,
  isolated: readonly ObjectKey[] | null,
): string | undefined => {
  if (isolated === null || isolated.length !== 1) return undefined;
  const only = isolated[0];
  return index.input.buildings.find((building) => buildingKey(index, building.buildingId) === only)?.buildingId;
};
