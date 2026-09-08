import { describe, expect, it } from 'vitest';
import { conflicting, known, missing, parse, quantity, text } from '@bim-open-toolkit/model';
import { exceptionRow, exceptionTable, missingException, workflowException } from '../src/exception.js';
import { keyOf, suggestedView } from '../src/keys.js';
import { observationCell, observationJsonSchema, observationOf, toObservation } from '../src/observation.js';
import { groupByOutcome, outcomeRules, worseOutcome } from '../src/outcome.js';
import { marker, onObject, overlayRecord } from '../src/overlay.js';
import { exceptionRows, resultRows, workflowResult } from '../src/result.js';
import { resultColumns, resultRecord, resultTable, rowsOf } from '../src/values.js';
import { fixtureModel } from './fixtures.js';

describe('result values', () => {
  it('leaves an absent field out and keeps a stated null', () => {
    expect(resultRecord({ a: 1, b: undefined, c: null })).toEqual({ a: 1, c: null });
  });

  it('reads the columns in the order the rows first use them', () => {
    const table = resultTable('t', 'T', [{ a: 1 }, { b: 2, a: 3 }]);
    expect(resultColumns(table)).toEqual(['a', 'b']);
    expect(rowsOf([table], 'other')).toEqual([]);
  });
});

describe('observations as JSON', () => {
  it('writes a known quantity with its unit and reads it back unchanged', () => {
    const cell = observationCell(known(quantity(900, 'mm')));
    expect(cell).toEqual({ kind: 'known', value: 900, unit: 'mm' });
    const back = parse(observationJsonSchema, cell);
    expect(back.ok && toObservation(back.value)).toEqual(known(quantity(900, 'mm')));
  });

  it('writes a missing observation as its reason, never as a value', () => {
    expect(observationCell(missing('not-measured'))).toEqual({ kind: 'missing', reason: 'not-measured' });
  });

  it('keeps every disputed value and the unit they agree on', () => {
    expect(observationCell(conflicting([quantity(60, 'min'), quantity(90, 'min')]))).toEqual({
      kind: 'conflicting',
      values: [60, 90],
      unit: 'min',
    });
    expect(observationCell(conflicting([quantity(1, 'm'), quantity(2, 'ft')]))).toEqual({
      kind: 'conflicting',
      values: [1, 2],
    });
  });

  it('writes evidence only when there is some', () => {
    expect(observationCell(known(text('a'), [{ source: 'survey', reference: 'r-1' }]))).toEqual({
      kind: 'known',
      value: 'a',
      evidence: [{ source: 'survey', reference: 'r-1' }],
    });
  });

  it('reads a column no row carries as missing for a stated reason, never as absent data', () => {
    expect(observationOf({}, 'width')).toEqual(missing('not-provided'));
    expect(observationOf({}, 'width', 'out-of-scope')).toEqual(missing('out-of-scope'));
  });

  it('refuses JSON that is not an observation', () => {
    expect(parse(observationJsonSchema, { kind: 'known' }).ok).toBe(false);
    expect(parse(observationJsonSchema, { kind: 'missing', reason: 'because' }).ok).toBe(false);
  });
});

describe('exceptions', () => {
  it('writes the subject, the field and the observation, and leaves empty context out', () => {
    expect(exceptionRow(missingException(['D-1'], 'fireRating', 'not-provided'))).toEqual({
      subjects: ['D-1'],
      field: 'fireRating',
      kind: 'missing',
      reason: 'not-provided',
    });
  });

  it('writes the candidates, the scenario and the detail when there are any', () => {
    const item = workflowException(['m3'], 'documentBuildings', missing('unresolved-source'), {
      related: ['B-1', 'B-2'],
      scope: 'base',
      detail: 'Two candidates.',
    });
    expect(exceptionRow(item)).toEqual({
      subjects: ['m3'],
      related: ['B-1', 'B-2'],
      field: 'documentBuildings',
      scope: 'base',
      detail: 'Two candidates.',
      kind: 'missing',
      reason: 'unresolved-source',
    });
    expect(exceptionTable([item]).id).toBe('exceptions');
  });
});

describe('outcomes', () => {
  it('shows the more serious of two outcomes', () => {
    expect(worseOutcome('resolved', 'missing')).toBe('missing');
    expect(worseOutcome('conflicting', 'missing')).toBe('conflicting');
    expect(worseOutcome('resolved', 'resolved')).toBe('resolved');
  });

  it('writes one rule per outcome that has objects, a conflict outranking a gap', () => {
    const rules = outcomeRules(
      'w',
      groupByOutcome([
        ['a', 'missing'],
        ['b', 'resolved'],
        ['c', 'missing'],
      ]),
    );
    expect(rules.map((rule) => rule.id)).toEqual(['w/resolved', 'w/missing']);
    expect(rules.map((rule) => rule.targets)).toEqual([['b'], ['a', 'c']]);
    expect(rules[1] !== undefined && rules[1].priority > (rules[0]?.priority ?? 0)).toBe(true);
  });
});

describe('a workflow result', () => {
  const exceptions = [missingException(['a'], 'width', 'not-measured')];
  const rules = outcomeRules('w', groupByOutcome([[keyOf(fixtureModel, 'a'), 'missing']]));
  const result = workflowResult({
    id: 'w',
    title: 'W',
    model: fixtureModel,
    tables: [resultTable('rows', 'Rows', [{ objectId: 'a' }])],
    exceptions,
    rules,
    sets: [],
    overlays: [marker('m', 'a is unmeasured', 'missing', onObject(keyOf(fixtureModel, 'a')))],
    view: suggestedView('w', 'W', [keyOf(fixtureModel, 'a')], rules),
    selectSetId: 'w/exceptions',
  });

  it('carries its own exceptions table alongside its result tables', () => {
    expect(result.tables.map((table) => table.id)).toEqual(['rows', 'exceptions']);
    expect(resultRows(result, 'rows')).toEqual([{ objectId: 'a' }]);
    expect(exceptionRows(result)).toEqual([
      { subjects: ['a'], field: 'width', kind: 'missing', reason: 'not-measured' },
    ]);
  });

  it('has an empty summary when the workflow states no scalars', () => {
    expect(result.summary).toEqual({});
  });

  it('writes an overlay as a plain record a command input can carry', () => {
    expect(result.overlays.map(overlayRecord)).toEqual([
      {
        kind: 'marker',
        id: 'm',
        text: 'a is unmeasured',
        outcome: 'missing',
        at: { kind: 'object', key: keyOf(fixtureModel, 'a') },
      },
    ]);
  });
});
