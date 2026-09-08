import {
  boolColumnOf,
  emptyDocument,
  getSlice,
  numberOf,
  putSlice,
  stringOf,
  type ModelRef,
} from '@bim-open-toolkit/model';
import { defaultRevisionsOptions, generateRevisions } from '@bim-open-toolkit/synthetic';
import { describe, expect, it } from 'vitest';
import {
  comparisonCommands,
  comparisonCounts,
  comparisonFeature,
  comparisonSlice,
  comparisonStatuses,
  comparisonViews,
  contestedIds,
  correspondenceStatus,
  findCorrespondence,
  noComparison,
  resolveCorrespondence,
  unrecordedConfidence,
  unresolvedCorrespondences,
  type ComparisonState,
  type Correspondence,
} from '../src/comparison.js';
import { fakeSession } from './support/fake-session.js';

const before: ModelRef = { id: 'tower', revision: 'a' };
const after: ModelRef = { id: 'tower', revision: 'b' };

const matched: Correspondence = { id: 'p1', aId: 'w-1', bIds: ['w-1-b'], basis: 'name', confidence: 0.9 };
const ambiguous: Correspondence = { id: 'p2', aId: 'w-2', bIds: ['w-2-b', 'w-3-b'], basis: 'geometry' };
const added: Correspondence = { id: 'p3', bIds: ['w-9-b'], basis: 'none' };
const deleted: Correspondence = { id: 'p4', aId: 'w-4', bIds: [], basis: 'none' };
const claiming: Correspondence = { id: 'p5', aId: 'w-5', bIds: ['shared-b'], basis: 'name', confidence: 0.4 };
const alsoClaiming: Correspondence = { id: 'p6', aId: 'w-6', bIds: ['shared-b'], basis: 'geometry', confidence: 0.5 };

const proposals: readonly Correspondence[] = [matched, ambiguous, added, deleted, claiming, alsoClaiming];

const loaded: ComparisonState = { ...noComparison, before, after, correspondences: proposals };

// The correspondences the revisions fixture proposes, read out of its table.
const fixtureCorrespondences = (): readonly Correspondence[] => {
  const revisions = generateRevisions(defaultRevisionsOptions);
  const table = revisions.correspondences;
  const aKnown = boolColumnOf(table, 'aIdKnown');
  const confidenceKnown = boolColumnOf(table, 'confidenceKnown');
  const rows: Correspondence[] = [];
  for (let row = 0; row < table.rowCount; row += 1) {
    const id = stringOf(table, 'id', row);
    const bIds = stringOf(table, 'bIds', row) ?? '';
    if (id === undefined) continue;
    const hasA = aKnown?.values[row] === 1;
    const hasConfidence = confidenceKnown?.values[row] === 1;
    rows.push({
      id,
      aId: hasA ? stringOf(table, 'aId', row) : undefined,
      bIds: bIds === '' ? [] : bIds.split(' '),
      basis: stringOf(table, 'basis', row) ?? '',
      confidence: hasConfidence ? numberOf(table, 'confidence', row) : undefined,
    });
  }
  return rows;
};

describe('comparison slice', () => {
  it('round trips through a document', () => {
    const document = putSlice(emptyDocument(), comparisonSlice, loaded);
    const read = getSlice(document, comparisonSlice);
    expect(read.ok && read.value).toEqual(loaded);
  });

  it('refuses two correspondences with one id', () => {
    const broken = { ...noComparison, correspondences: [matched, matched] };
    const document = { ...emptyDocument(), slices: { comparison: { version: 1, value: broken } } };
    expect(getSlice(document, comparisonSlice).ok).toBe(false);
  });
});

describe('reading the proposals', () => {
  it('tells the five cases apart', () => {
    expect(comparisonStatuses(loaded)).toEqual(['matched', 'ambiguous', 'added', 'deleted', 'contested', 'contested']);
  });

  it('counts them', () => {
    expect(comparisonCounts(loaded)).toEqual({ matched: 1, added: 1, deleted: 1, ambiguous: 1, contested: 2 });
  });

  it('names the objects two proposals both claim', () => {
    expect(contestedIds(proposals)).toEqual(['shared-b']);
  });

  it('leaves the undecidable ones visible', () => {
    expect(unresolvedCorrespondences(loaded).map((item) => item.id)).toEqual(['p2', 'p5', 'p6']);
  });

  it('keeps a confidence nobody recorded apart from a low one', () => {
    expect(unrecordedConfidence(loaded).map((item) => item.id)).toEqual(['p2', 'p3', 'p4']);
  });

  it('treats a decision as final whatever the proposal looked like', () => {
    expect(correspondenceStatus({ ...ambiguous, resolved: 'w-2-b' }, contestedIds(proposals))).toBe('matched');
  });
});

describe('resolving', () => {
  it('refuses a candidate the proposal never named', () => {
    expect(resolveCorrespondence(loaded, 'p2', 'elsewhere').diagnostics.map((item) => item.code)).toEqual([
      'comparison/not-a-candidate',
    ]);
  });

  it('refuses a proposal nobody made', () => {
    expect(resolveCorrespondence(loaded, 'p9', 'x').ok).toBe(false);
  });

  it('takes the decision back when the candidate is null', () => {
    const decided = resolveCorrespondence(loaded, 'p2', 'w-3-b');
    expect(decided.ok && findCorrespondence(decided.value, 'p2')?.resolved).toBe('w-3-b');
    const undecided = decided.ok ? resolveCorrespondence(decided.value, 'p2', null) : decided;
    expect(undecided.ok && findCorrespondence(undecided.value, 'p2')?.resolved).toBeUndefined();
  });
});

describe('comparison commands through a session', () => {
  it('loads, links and resolves', () => {
    const session = fakeSession(comparisonCommands);
    expect(session.dispatch('comparison.load', { before, after, correspondences: proposals }).ok).toBe(true);
    expect(comparisonViews(session.read(comparisonSlice))).toEqual(['before', 'after']);

    expect(session.dispatch('comparison.link', { linked: true }).ok).toBe(true);
    expect(session.read(comparisonSlice).linkedCameras).toBe(true);

    expect(session.dispatch('comparison.resolve', { id: 'p2', bId: 'w-2-b' }).ok).toBe(true);
    expect(unresolvedCorrespondences(session.read(comparisonSlice)).map((item) => item.id)).toEqual(['p5', 'p6']);
  });

  it('warns when the two revisions are not of one model', () => {
    const session = fakeSession(comparisonCommands);
    const result = session.dispatch('comparison.load', {
      before,
      after: { id: 'annex', revision: 'a' },
      correspondences: [],
    });
    expect(result.diagnostics.map((item) => item.code)).toEqual(['comparison/different-models']);
  });

  it('warns when nothing is loaded to link', () => {
    const session = fakeSession(comparisonCommands);
    expect(session.dispatch('comparison.link', { linked: true }).diagnostics.map((item) => item.code)).toEqual([
      'comparison/not-loaded',
    ]);
  });

  it('refuses a load whose proposals repeat an id', () => {
    const session = fakeSession(comparisonCommands);
    const result = session.dispatch('comparison.load', {
      before,
      after,
      correspondences: [matched, matched],
    });
    expect(result.diagnostics.map((item) => item.code)).toEqual(['comparison/duplicate-id']);
  });
});

describe('the revisions fixture', () => {
  it('loads and leaves every undecidable case visible', () => {
    const revisions = generateRevisions(defaultRevisionsOptions);
    const correspondences = fixtureCorrespondences();
    const session = fakeSession(comparisonCommands);
    const loadedFixture = session.dispatch('comparison.load', {
      before: { id: 'building', revision: 'a' },
      after: { id: 'building', revision: 'b' },
      correspondences,
    });
    expect(loadedFixture.ok).toBe(true);

    const state = session.read(comparisonSlice);
    const counts = comparisonCounts(state);
    expect(counts.added).toBe(revisions.changeCounts.added);
    expect(counts.deleted).toBe(revisions.changeCounts.deleted);
    expect(counts.ambiguous).toBe(revisions.changeCounts.ambiguous);
    expect(counts.contested).toBeGreaterThan(0);
    expect(unresolvedCorrespondences(state).length).toBe(counts.ambiguous + counts.contested);
    expect(unrecordedConfidence(state).length).toBeGreaterThan(0);
  });
});

describe('the feature', () => {
  it('names its commands', () => {
    expect(comparisonFeature.id).toBe('comparison');
    expect(comparisonFeature.commands.map((item) => item.name)).toEqual([
      'comparison.load',
      'comparison.link',
      'comparison.resolve',
    ]);
  });
});
