// Two snapshots and their proposals: determinism, disjoint id spaces, and unresolved cases that
// stay unresolved.

import { describe, expect, it } from 'vitest';
import { columnOf, type Table } from '@bim-open-toolkit/model';
import { splitIds } from '../src/arrays.js';
import { defaultBuildingOptions, generateBuilding } from '../src/building.js';
import { defaultRevisionsOptions, generateRevisions } from '../src/revisions.js';

const strings = (source: Table, name: string): readonly string[] => {
  const column = columnOf(source, name);
  return column === undefined || column.type !== 'string' ? [] : [...column.values];
};

const flags = (source: Table, name: string): readonly boolean[] => {
  const column = columnOf(source, name);
  return column === undefined || column.type !== 'bool' ? [] : [...column.values].map((value) => value === 1);
};

const counts = (source: Table, name: string): readonly number[] => {
  const column = columnOf(source, name);
  return column === undefined || column.type !== 'i32' ? [] : [...column.values];
};

const revisions = generateRevisions(defaultRevisionsOptions);

describe('generateRevisions', () => {
  it('is a function of its options alone', () => {
    const again = generateRevisions(defaultRevisionsOptions);
    expect(strings(again.objectsB, 'objectId')).toEqual(strings(revisions.objectsB, 'objectId'));
    expect(strings(again.correspondences, 'bIds')).toEqual(strings(revisions.correspondences, 'bIds'));
    expect(again.changeCounts).toEqual(revisions.changeCounts);
  });

  it('leaves snapshot A exactly what the building generator produces', () => {
    const building = generateBuilding(defaultBuildingOptions);
    expect(revisions.before.model.objects.map((item) => item.ref.objectId)).toEqual(
      building.model.objects.map((item) => item.ref.objectId),
    );
    expect(strings(revisions.objectsA, 'objectId')).toEqual(building.model.objects.map((item) => item.ref.objectId));
  });

  it('keeps the model id and takes a new revision', () => {
    expect(revisions.after.model.ref.id).toBe(revisions.before.model.ref.id);
    expect(revisions.after.model.ref.revision).not.toBe(revisions.before.model.ref.revision);
  });

  it('gives the two revisions disjoint object ids', () => {
    const before = new Set(strings(revisions.objectsA, 'objectId'));
    for (const objectId of strings(revisions.objectsB, 'objectId')) expect(before.has(objectId)).toBe(false);
  });

  it('produces every change kind the comparison has to tell apart', () => {
    const { unchanged, renamed, recategorized, moved, deleted, added, ambiguous, duplicated } = revisions.changeCounts;
    expect(unchanged).toBeGreaterThan(0);
    expect(renamed).toBeGreaterThan(0);
    expect(recategorized).toBeGreaterThan(0);
    expect(moved).toBeGreaterThan(0);
    expect(deleted).toBeGreaterThan(0);
    expect(added).toBe(defaultRevisionsOptions.additions);
    expect(ambiguous).toBeGreaterThan(0);
    expect(duplicated).toBe(1);
  });

  it('names ids that exist on both sides of every proposal', () => {
    const before = new Set(strings(revisions.objectsA, 'objectId'));
    const after = new Set(strings(revisions.objectsB, 'objectId'));
    const aIds = strings(revisions.correspondences, 'aId');
    const known = flags(revisions.correspondences, 'aIdKnown');
    const candidates = strings(revisions.correspondences, 'bIds');
    aIds.forEach((aId, row) => {
      if (known[row] === true) expect(before.has(aId)).toBe(true);
      else expect(aId).toBe('');
      for (const bId of splitIds(candidates[row] ?? '')) expect(after.has(bId)).toBe(true);
    });
  });

  it('keeps the candidate count in step with the candidate list', () => {
    const candidates = strings(revisions.correspondences, 'bIds');
    const sizes = counts(revisions.correspondences, 'candidateCount');
    candidates.forEach((cell, row) => {
      expect(splitIds(cell).length).toBe(sizes[row]);
    });
    expect(sizes.filter((size) => size === 0).length).toBe(revisions.changeCounts.deleted);
    expect(sizes.filter((size) => size > 1).length).toBe(revisions.changeCounts.ambiguous);
  });

  it('reports an unrecorded confidence as NaN, never as zero', () => {
    const column = columnOf(revisions.correspondences, 'confidence');
    if (column === undefined || column.type !== 'f64') throw new Error('the confidence column is missing');
    const recorded = flags(revisions.correspondences, 'confidenceKnown');
    const values = [...column.values];
    values.forEach((value, row) => {
      if (recorded[row] === true) expect(value).toBeGreaterThan(0);
      else expect(Number.isNaN(value)).toBe(true);
    });
    expect(recorded.filter((value) => !value).length).toBeGreaterThan(0);
  });

  it('names one object of the first revision in two separate proposals', () => {
    const aIds = strings(revisions.correspondences, 'aId').filter((value) => value !== '');
    const seen = new Set<string>();
    const repeated = aIds.filter((aId) => (seen.has(aId) ? true : (seen.add(aId), false)));
    expect(repeated.length).toBe(1);
  });

  it('never parents an object of the second revision to one that was deleted', () => {
    const present = new Set(revisions.after.model.objects.map((item) => item.ref.objectId));
    for (const record of revisions.after.model.objects) {
      if (record.parentId !== undefined) expect(present.has(record.parentId)).toBe(true);
    }
  });

  it('draws the second revision with the first revision\'s mesh library', () => {
    expect(revisions.after.meshGroups.map((group) => group.name)).toEqual(
      revisions.before.meshGroups.map((group) => group.name),
    );
    expect(revisions.after.geometry.instances.count).toBe(revisions.after.model.objects.length);
  });

  it('changes nothing when every rate is zero and nothing is added', () => {
    const same = generateRevisions({
      ...defaultRevisionsOptions,
      renameRate: 0,
      recategorizeRate: 0,
      moveRate: 0,
      deleteRate: 0,
      ambiguousRate: 0,
      additions: 0,
    });
    expect(same.objectsB.rowCount).toBe(same.objectsA.rowCount);
    expect(same.changeCounts.unchanged).toBe(same.objectsA.rowCount);
  });

  it('refuses a rate outside zero to one', () => {
    expect(() => generateRevisions({ ...defaultRevisionsOptions, moveRate: 1.5 })).toThrow(/moveRate/);
    expect(() => generateRevisions({ ...defaultRevisionsOptions, additions: -1 })).toThrow(/additions/);
  });
});
