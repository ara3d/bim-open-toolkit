import { describe, expect, it } from 'vitest';
import { runValveIsolation, valveIsolationInputSchema } from '../src/06-valve-isolation.js';
import { exceptionRows, resultRows } from '../src/result.js';
import { fixtureInput, fixtureModel, loadFixture, valueOfResult } from './fixtures.js';

const fixture = loadFixture('06-valve-isolation');
const input = fixtureInput(valveIsolationInputSchema, fixture, { model: fixtureModel });
const result = valueOfResult('valve isolation', runValveIsolation(input));

describe('valve isolation trace', () => {
  it('produces the expected affected rows', () => {
    expect(resultRows(result, 'affected')).toEqual(fixture.expected['affected']);
  });

  it('produces the expected trace-coverage exception rows', () => {
    expect(exceptionRows(result)).toEqual(fixture.expected['exceptions']);
  });

  it('keeps what the closed valve cut off out of the affected set, without calling it a gap', () => {
    const affected = result.sets.find((set) => set.id === 'valve-isolation/affected');
    expect(affected?.members.size).toBe(2);
    expect(result.rules.map((rule) => rule.id)).toEqual([
      'valve-isolation/resolved',
      'valve-isolation/missing',
      'valve-isolation/excluded',
    ]);
    expect(result.rules.find((rule) => rule.id === 'valve-isolation/excluded')?.targets).toHaveLength(2);
    expect(exceptionRows(result)).toHaveLength(1);
  });

  it('says nothing about an unverified connection the trace never came near', () => {
    const elsewhere = {
      ...input,
      segments: [
        ...input.segments,
        { objectId: 'SEG-6', fromNodeId: 'N5', toNodeId: 'N6', topologyStatus: 'unverified' as const },
      ],
    };
    const rows = exceptionRows(valueOfResult('valve isolation', runValveIsolation(elsewhere)));
    expect(rows.map((row) => row['subjects'])).toEqual([['SEG-4']]);
  });

  it('draws one directed line along the path the trace actually took', () => {
    expect(result.overlays.map((overlay) => overlay.id)).toEqual(['valve-isolation/SEG-1-SEG-2']);
  });

  it('refuses a segments table that repeats an id rather than losing a row', () => {
    const repeated = runValveIsolation({ ...input, segments: [...input.segments, ...input.segments.slice(0, 1)] });
    expect(repeated.ok).toBe(false);
    expect(repeated.diagnostics.map((item) => item.code)).toEqual(['workflow/duplicate-id']);
  });
});
