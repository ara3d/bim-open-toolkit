import { describe, expect, it } from 'vitest';
import { revisionComparisonInputSchema, runRevisionComparison } from '../src/02-revision-comparison.js';
import { keyOf } from '../src/keys.js';
import { exceptionRows, resultRows } from '../src/result.js';
import { fixtureInput, fixtureModel, fixtureModelB, loadFixture, valueOfResult } from './fixtures.js';

const fixture = loadFixture('02-revision-comparison');
const parameters = { modelA: fixtureModel, modelB: fixtureModelB };
const input = fixtureInput(revisionComparisonInputSchema, fixture, parameters);
const result = valueOfResult('revision comparison', runRevisionComparison(input));

describe('revision comparison', () => {
  it('produces the expected comparison rows', () => {
    expect(resultRows(result, 'comparison')).toEqual(fixture.expected['comparison']);
  });

  it('produces the expected exception rows', () => {
    expect(exceptionRows(result)).toEqual(fixture.expected['exceptions']);
  });

  it('keeps an ambiguous candidate out of the additions and shows both candidates', () => {
    expect(resultRows(result, 'comparison').map((row) => row['changeType'])).not.toContain('added');
    expect(result.overlays.map((overlay) => overlay.id)).toEqual([
      'revision-comparison/c4/D-1b',
      'revision-comparison/c4/D-9',
    ]);
    expect(result.view.selection).toEqual([
      keyOf(fixtureModel, 'D-1'),
      keyOf(fixtureModelB, 'D-1b'),
      keyOf(fixtureModelB, 'D-9'),
    ]);
  });

  it('reads the two revisions at two revisions of one model identity', () => {
    expect(result.recipe.steps.map((item) => item.command)).toContain('comparison.link');
    expect(keyOf(fixtureModel, 'W-1')).not.toBe(keyOf(fixtureModelB, 'W-1'));
  });

  it('reports an object no correspondence names as an unsupplied correspondence, not a change', () => {
    const extra = {
      ...input,
      objectsB: [...input.objectsB, { objectId: 'W-4b', name: 'Wall-04', category: 'Wall' }],
    };
    const rows = exceptionRows(valueOfResult('revision comparison', runRevisionComparison(extra)));
    expect(rows[1]).toEqual({
      subjects: ['W-4b'],
      field: 'correspondence',
      scope: 'revision B',
      detail: 'No correspondence was supplied for this object.',
      kind: 'missing',
      reason: 'not-provided',
    });
  });

  it('reports two proposals competing for one candidate as unresolved on both sides', () => {
    const competing = {
      ...input,
      correspondences: [
        { id: 'c1', aId: 'W-1', bIds: ['W-1b'], basis: 'same-id' },
        { id: 'c2', aId: 'W-2', bIds: ['W-1b'], basis: 'geometry-match' },
      ],
      objectsA: input.objectsA.slice(0, 2),
      objectsB: input.objectsB.slice(0, 1),
    };
    const rows = exceptionRows(valueOfResult('revision comparison', runRevisionComparison(competing)));
    expect(rows.map((row) => row['subjects'])).toEqual([['W-1'], ['W-2']]);
  });
});
