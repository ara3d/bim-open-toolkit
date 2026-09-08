import { describe, expect, it } from 'vitest';
import {
  columnNames, completeFacts, conflicting, coverageOfFacts, deleteObjects, editLayer, emptyDocument,
  emptyTable, f32Column, fact, formatPath, getSlice, identityMatrix, indexFacts, instanceRecords,
  instanceTable, integer, joinTablesOn, known, object, objectKey, objectRef, parse, putSlice, reconcile,
  resolveStyles, rowsInSet, setKeys, setOf, stateSlice, string, stringColumn, styleComposition, styleOf,
  styleRule, tableFromRecord, text, unknownFacts, withColumn, type InstanceRecord, type ModelRef,
} from '../src/index.js';

// The examples in README.md, run, so the documentation cannot drift from the package.
describe('README examples', () => {
  it('validates and reports where the value was wrong', () => {
    const door = object({ id: string(), width: integer() });
    const read = parse(door, { id: 'D1', width: 'wide' });
    expect(read.ok).toBe(false);
    expect(read.diagnostics.map((item) => formatPath(item.path))).toEqual(['width']);
  });

  it('composes what the user sees', () => {
    const keys = ['a', 'b', 'c'];
    const layers = [editLayer('l1', 'Demolition', [deleteObjects(['a'])])];
    const rules = [styleRule('r1', 'Fire doors', ['b'], { color: [1, 0, 0] })];
    const resolved = resolveStyles(styleComposition(new Map(), layers, rules, setOf(['c'])), keys);
    expect(styleOf(resolved, 'b').color).toEqual([1, 0, 0]);
  });

  it('saves and reopens a feature state', () => {
    const clipping = stateSlice('clipping', 1, object({ planes: integer() }), { planes: 0 });
    const document = putSlice(emptyDocument(), clipping, { planes: 2 });
    expect(getSlice(document, clipping)).toEqual({ ok: true, value: { planes: 2 }, diagnostics: [] });
  });

  it('reviews the doors of a model', () => {
    const model: ModelRef = { id: 'tower', revision: '2026-09' };
    const door = (id: string) => objectRef(model, id);
    const doors = [door('d1'), door('d2'), door('d3')];
    const keys = doors.map(objectKey);

    const recorded = indexFacts([
      fact(door('d1'), 'fireRating', known(text('EI60'), [{ source: 'ifc' }])),
      fact(door('d3'), 'fireRating', conflicting([text('EI90'), text('EI60')])),
    ]);
    const rated = completeFacts(recorded, doors, ['fireRating']);
    expect(coverageOfFacts(rated)).toEqual({ total: 3, known: 1, missing: 1, conflicting: 1 });

    expect(reconcile([text('FD60')], [{ source: 'survey' }]).kind).toBe('known');

    const unrated = setOf(unknownFacts(rated).map((item) => objectKey(item.subject)));
    const rules = [styleRule('unrated', 'Unrated doors', setKeys(unrated), { color: [1, 0, 0] })];
    const resolved = resolveStyles(styleComposition(new Map(), [], rules), keys);
    expect(styleOf(resolved, objectKey(door('d2'))).color).toEqual([1, 0, 0]);

    const placed = instanceRecords(doors.map((_unused, index): InstanceRecord => ({
      meshIndex: 0, transform: identityMatrix, color: [1, 1, 1], opacity: 1, objectIndex: index,
    })));
    const rows = withColumn(instanceTable(placed), 'objectKey', stringColumn(keys));
    expect(rowsInSet(rows, 'objectIndex', unrated, keys).rowCount).toBe(2);
    const schedule = tableFromRecord({ objectKey: stringColumn(keys), width: f32Column([0.9, 1.2, 0.8]) });
    const joined = joinTablesOn(rows, 'objectKey', schedule, 'objectKey', 'schedule.');
    expect(joined.ok).toBe(true);
    const value = joined.ok ? joined.value : emptyTable;
    expect(value.rowCount).toBe(3);
    expect(columnNames(value)).toContain('schedule.width');
  });
});
