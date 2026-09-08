import { describe, expect, it } from 'vitest';
import { metresZUpLocal, unknownCoordinates } from '@bim-open-toolkit/model';
import { accessCoordinationInputSchema, runAccessCoordination } from '../src/07-access-coordination.js';
import { exceptionRows, resultRows } from '../src/result.js';
import { fixtureInput, fixtureModel, loadFixture, valueOfResult } from './fixtures.js';

const fixture = loadFixture('07-access-coordination');
const input = fixtureInput(accessCoordinationInputSchema, fixture, {
  model: fixtureModel,
  envelopeFrame: metresZUpLocal,
  penetrationFrame: metresZUpLocal,
});
const result = valueOfResult('access coordination', runAccessCoordination(input));

describe('access coordination', () => {
  it('produces the expected candidate finding rows', () => {
    expect(resultRows(result, 'candidateFindings')).toEqual(fixture.expected['candidateFindings']);
  });

  it('produces the expected coordination-gap exception rows', () => {
    expect(exceptionRows(result)).toEqual(fixture.expected['exceptions']);
  });

  it('states every finding as a candidate and never as a verified clash', () => {
    for (const row of resultRows(result, 'candidateFindings')) expect(row['basis']).toBe('bounding-box-overlap');
    expect(result.rules.map((rule) => rule.id)).toEqual([
      'access-coordination/candidate',
      'access-coordination/missing',
    ]);
    expect(result.overlays.every((overlay) => overlay.outcome === 'candidate')).toBe(true);
    expect(JSON.stringify(result.tables).toLowerCase()).not.toContain('clash');
  });

  it('tests nothing against a participant whose sources disagree, and shows both bounds', () => {
    const disputed = {
      ...input,
      penetrations: input.penetrations.map((item) =>
        item.objectId === 'PEN-1'
          ? { ...item, bbox: { kind: 'conflicting', values: ['1,1,0 to 3,3,2', '1,2,0 to 3,4,2'] } as const }
          : item,
      ),
    };
    const result2 = valueOfResult('access coordination', runAccessCoordination(disputed));
    expect(resultRows(result2, 'candidateFindings')).toEqual([]);
    expect(exceptionRows(result2)).toContainEqual({
      subjects: ['PEN-1'],
      field: 'bbox',
      detail: 'coordination gap: the sources state different bounds',
      kind: 'conflicting',
      values: ['1,1,0 to 3,3,2', '1,2,0 to 3,4,2'],
    });
    expect(result2.rules.map((rule) => rule.id)).toContain('access-coordination/conflicting');
  });

  it('compares no boxes at all when the two frames cannot be related', () => {
    const unrelated = valueOfResult(
      'access coordination',
      runAccessCoordination({ ...input, penetrationFrame: unknownCoordinates }),
    );
    expect(resultRows(unrelated, 'candidateFindings')).toEqual([]);
    expect(exceptionRows(unrelated)[0]).toEqual({
      subjects: [],
      field: 'coordinates',
      detail:
        'the penetration frame (unknown, unknown) cannot be related to the envelope frame (metres, local), so no boxes were compared',
      kind: 'missing',
      reason: 'unresolved-source',
    });
  });

  it('reads a penetration box in the envelope frame before comparing it', () => {
    const millimetres = valueOfResult(
      'access coordination',
      runAccessCoordination({
        ...input,
        penetrationFrame: { ...metresZUpLocal, units: 'millimetres' },
      }),
    );
    // Every penetration is a thousand times smaller once it is read in metres, so all three fall
    // inside the first envelope. The units decide the answer, which is why they are stated.
    expect(resultRows(millimetres, 'candidateFindings').map((row) => row['penetrationId'])).toEqual([
      'PEN-1',
      'PEN-2',
      'PEN-3',
    ]);
  });

  it('refuses an envelopes table that repeats an id rather than losing a row', () => {
    const repeated = runAccessCoordination({ ...input, envelopes: [...input.envelopes, ...input.envelopes.slice(0, 1)] });
    expect(repeated.ok).toBe(false);
    expect(repeated.diagnostics.map((item) => item.code)).toEqual(['workflow/duplicate-id']);
  });
});
