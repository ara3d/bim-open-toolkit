import { describe, expect, it } from 'vitest';
import { portfolioInputSchema, runPortfolioDrillThrough } from '../src/10-portfolio-drill-through.js';
import { exceptionRows, resultRows } from '../src/result.js';
import { fixtureInput, fixtureModel, loadFixture, valueOfResult } from './fixtures.js';

const fixture = loadFixture('10-portfolio-drill-through');
const input = fixtureInput(portfolioInputSchema, fixture, { model: fixtureModel });
const result = valueOfResult('portfolio', runPortfolioDrillThrough(input));

describe('portfolio drill-through', () => {
  it('produces the expected drill-through rows', () => {
    expect(resultRows(result, 'drillThrough')).toEqual(fixture.expected['drillThrough']);
  });

  it('produces the expected exception rows', () => {
    expect(exceptionRows(result)).toEqual(fixture.expected['exceptions']);
  });

  it('produces the expected site rollup, and no row for a site with no resolved contributor', () => {
    expect(resultRows(result, 'portfolioRollup')).toEqual(fixture.expected['portfolioRollup']);
  });

  it('refuses to add up figures reported in more than one unit', () => {
    const mixed = {
      ...input,
      metrics: input.metrics.map((metric) =>
        metric.id === 'm2'
          ? { ...metric, value: { kind: 'known', value: 3000, unit: 'ft2' } as const }
          : metric,
      ),
    };
    const result2 = valueOfResult('portfolio', runPortfolioDrillThrough(mixed));
    expect(resultRows(result2, 'drillThrough')).toHaveLength(2);
    expect(resultRows(result2, 'portfolioRollup')).toEqual([]);
  });

  it('reports a metric naming a document the input does not contain', () => {
    const orphan = {
      ...input,
      metrics: [{ id: 'm6', documentId: 'DOC-9', metricName: 'totalFloorAreaM2', value: { kind: 'known', value: 1, unit: 'm2' } as const }],
    };
    const rows = exceptionRows(valueOfResult('portfolio', runPortfolioDrillThrough(orphan)));
    expect(rows).toEqual([
      {
        subjects: ['m6', 'DOC-9'],
        field: 'documentId',
        detail: 'The metrics table names document "DOC-9", which the documents table does not contain.',
        kind: 'missing',
        reason: 'unresolved-source',
      },
    ]);
  });

  it('labels each resolved building with the figure and its unit', () => {
    expect(result.overlays.map((overlay) => overlay.text)).toEqual(['B-1: 5000 m2', 'B-2: 3000 m2']);
  });
});
