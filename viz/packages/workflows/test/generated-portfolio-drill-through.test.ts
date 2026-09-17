import { describe, expect, it } from 'vitest';
import { defaultCityOptions, generateCity, splitIds, type City } from '@bim-open-toolkit/synthetic';
import { rowOf, type CellValue } from '@bim-open-toolkit/model';
import {
  runPortfolioDrillThrough,
  type PortfolioBuilding,
  type PortfolioDocument,
  type PortfolioInput,
  type PortfolioMetric,
} from '../src/10-portfolio-drill-through.js';
import { missingReasons, type ObservationJson } from '../src/observation.js';
import { exceptionRows, resultRows } from '../src/result.js';
import { valueOfResult } from './fixtures.js';

// `city.ts` reports its reported figures as plain schedule columns rather than facts, so the
// observation is rebuilt from those columns instead of being read off a fact index.
const textAt = (value: unknown): string => (typeof value === 'string' ? value : '');
const numberAt = (value: unknown): number => (typeof value === 'number' ? value : Number.NaN);
const textOrUndefined = (value: string): string | undefined => (value === '' ? undefined : value);

const reasonAt = (value: unknown): (typeof missingReasons)[number] => {
  const text = textAt(value);
  const found = missingReasons.find((reason) => reason === text);
  return found ?? 'not-provided';
};

const quantityObservationOf = (cells: Readonly<Record<string, CellValue>>, name: string): ObservationJson => {
  const state = textAt(cells[`${name}State`]);
  const unit = textOrUndefined(textAt(cells[`${name}Unit`]));
  if (state === 'known') return { kind: 'known', value: numberAt(cells[name]), unit };
  if (state === 'conflicting') {
    const values = textAt(cells[`${name}Conflict`])
      .split(' vs ')
      .map((part) => Number.parseFloat(part));
    return { kind: 'conflicting', values, unit };
  }
  return { kind: 'missing', reason: reasonAt(cells[`${name}MissingReason`]) };
};

const buildingsOf = (city: City): readonly PortfolioBuilding[] =>
  Array.from({ length: city.buildings.rowCount }, (_, row) => {
    const cells = rowOf(city.buildings, row);
    return { buildingId: textAt(cells['buildingId']), name: textAt(cells['name']), siteId: textAt(cells['siteId']) };
  });

const documentsOf = (city: City): readonly PortfolioDocument[] =>
  Array.from({ length: city.documents.rowCount }, (_, row) => {
    const cells = rowOf(city.documents, row);
    return { documentId: textAt(cells['documentId']), buildingIds: splitIds(textAt(cells['buildingIds'])) };
  });

const metricsOf = (city: City): readonly PortfolioMetric[] =>
  Array.from({ length: city.metrics.rowCount }, (_, row) => {
    const cells = rowOf(city.metrics, row);
    return {
      id: textAt(cells['id']),
      documentId: textAt(cells['documentId']),
      metricName: textAt(cells['metricName']),
      value: quantityObservationOf(cells, 'value'),
    };
  });

const portfolioInputOf = (city: City, requestedMetricName: string): PortfolioInput => ({
  model: city.model.ref,
  requestedMetricName,
  buildings: buildingsOf(city),
  documents: documentsOf(city),
  metrics: metricsOf(city),
});

const firstMetricNameOf = (city: City): string => {
  const name = city.metricNames[0];
  if (name === undefined) throw new Error('the generated city has no metric names');
  return name;
};

const city = generateCity(defaultCityOptions);
const input = portfolioInputOf(city, firstMetricNameOf(city));
const result = valueOfResult('generated portfolio drill-through', runPortfolioDrillThrough(input));

describe('the portfolio drill-through on a generated set of buildings and documents', () => {
  it('reports exactly the ambiguous mappings and disputed or absent figures the generator documents, as exceptions', () => {
    // A document that names anything other than exactly one building is unresolved for every metric
    // it carries, whatever that metric's own value says; the generator only ever disputes or drops a
    // figure when its document names exactly one building, so the two counts never overlap.
    const valueGaps = city.valueCoverage.missing + city.valueCoverage.conflicting;
    const mappingGaps = input.documents.filter((document) => document.buildingIds.length !== 1).length * city.metricNames.length;
    expect(valueGaps).toBeGreaterThan(0);
    expect(mappingGaps).toBeGreaterThan(0);
    expect(exceptionRows(result)).toHaveLength(valueGaps + mappingGaps);
  });

  it('gives no rollup row to a site whose only contributor figures were disputed or absent', () => {
    const lastSiteId = `site-${city.options.sites}`;
    expect(input.buildings.some((building) => building.siteId === lastSiteId)).toBe(true);
    expect(resultRows(result, 'portfolioRollup').some((row) => row['siteId'] === lastSiteId)).toBe(false);
  });

  it('leaves no exception when every document maps to exactly one building and every figure is known', () => {
    const complete = generateCity({ ...defaultCityOptions, gapScale: 0 });
    const completeResult = valueOfResult(
      'generated portfolio drill-through (complete)',
      runPortfolioDrillThrough(portfolioInputOf(complete, firstMetricNameOf(complete))),
    );
    expect(exceptionRows(completeResult)).toEqual([]);
  });
});
