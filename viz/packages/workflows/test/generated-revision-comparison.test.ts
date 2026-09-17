import { describe, expect, it } from 'vitest';
import { defaultRevisionsOptions, generateRevisions, splitIds, type Revisions } from '@bim-open-toolkit/synthetic';
import { rowOf, type Table } from '@bim-open-toolkit/model';
import {
  runRevisionComparison,
  type Correspondence,
  type RevisionComparisonInput,
  type RevisionObject,
} from '../src/02-revision-comparison.js';
import { exceptionRows, resultRows } from '../src/result.js';
import { valueOfResult } from './fixtures.js';

// The generated snapshots state everything the comparison reads as plain table columns, so nothing
// here re-decides which object changed: it only reads the two revisions and the correspondences the
// generator already produced between them.
const textAt = (value: unknown): string => (typeof value === 'string' ? value : '');
const boolAt = (value: unknown): boolean => value === true;

const revisionObjectsOf = (source: Table): readonly RevisionObject[] =>
  Array.from({ length: source.rowCount }, (_, row) => {
    const cells = rowOf(source, row);
    return { objectId: textAt(cells['objectId']), name: textAt(cells['name']), category: textAt(cells['category']) };
  });

const correspondencesOf = (source: Table): readonly Correspondence[] =>
  Array.from({ length: source.rowCount }, (_, row) => {
    const cells = rowOf(source, row);
    return {
      id: textAt(cells['id']),
      aId: boolAt(cells['aIdKnown']) ? textAt(cells['aId']) : null,
      bIds: splitIds(textAt(cells['bIds'])),
      basis: textAt(cells['basis']),
    };
  });

const revisionInput = (revisions: Revisions): RevisionComparisonInput => ({
  modelA: revisions.before.model.ref,
  modelB: revisions.after.model.ref,
  objectsA: revisionObjectsOf(revisions.objectsA),
  objectsB: revisionObjectsOf(revisions.objectsB),
  correspondences: correspondencesOf(revisions.correspondences),
});

const revisions = generateRevisions(defaultRevisionsOptions);
const input = revisionInput(revisions);
const result = valueOfResult('generated revision comparison', runRevisionComparison(input));

describe('the revision comparison on a generated pair of snapshots', () => {
  it('reports exactly the ambiguous proposals the generator documents, as exceptions', () => {
    // A `duplicated` event always turns both the original match and the duplicate proposal into
    // ambiguous entries (they collide on the same A or B id), so it counts twice. Every A and B
    // object already carries a proposal naming it, deletions and additions included, so this
    // generator never leaves an object unproposed.
    const expected = revisions.changeCounts.ambiguous + 2 * revisions.changeCounts.duplicated;
    expect(expected).toBeGreaterThan(0);
    expect(exceptionRows(result)).toHaveLength(expected);
  });

  it('never reports a resolved change for a correspondence it left ambiguous', () => {
    const rows = resultRows(result, 'comparison');
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row['changeType'] !== 'ambiguous')).toBe(true);
    expect(rows).toHaveLength(revisions.correspondences.rowCount - exceptionRows(result).length);
  });

  it('leaves no exception when every object is proposed as deleted', () => {
    // `deleteRate: 1` makes every draw for "deleted" come back true (a probability-1 chance always
    // fires), so no object is ever matched, which is also the only way this generator's unconditional
    // duplicate-proposal draw has nothing to duplicate.
    const gapless = generateRevisions({ ...defaultRevisionsOptions, deleteRate: 1 });
    expect(gapless.changeCounts.ambiguous).toBe(0);
    expect(gapless.changeCounts.duplicated).toBe(0);
    const gaplessResult = valueOfResult(
      'generated revision comparison (gapless)',
      runRevisionComparison(revisionInput(gapless)),
    );
    expect(exceptionRows(gaplessResult)).toEqual([]);
  });
});
