import { describe, expect, it } from 'vitest';
import { conflicting, quantity, stringOf, type ModelRef } from '@bim-open-toolkit/model';
import {
  missingException,
  namedObjectSet,
  resultTable,
  suggestedView,
  workflowException,
  workflowResult,
  type WorkflowResult,
} from '@bim-open-toolkit/workflows';
import {
  cellText,
  exceptionsFirst,
  exceptionsSheet,
  exceptionSubjects,
  orderedColumns,
} from '../../../src/demos/_workflows/exceptions.js';

const model: ModelRef = { id: 'test-model', revision: 'r1' };

const result: WorkflowResult = workflowResult({
  id: 'test-workflow',
  title: 'Test workflow',
  model,
  tables: [resultTable('rows', 'Rows', [])],
  exceptions: [
    missingException(['b'], 'fireRating', 'not-provided', { detail: 'nobody recorded one' }),
    workflowException(['c'], 'clearWidth', conflicting([quantity(900, 'mm'), quantity(920, 'mm')]), {
      related: ['d'],
    }),
  ],
  rules: [],
  sets: [namedObjectSet('test/exceptions', 'Exceptions', model, ['b', 'c'])],
  view: suggestedView('test-workflow', 'Test exceptions', [], []),
  selectSetId: 'test/exceptions',
});

describe('a workflow result\'s exceptions as a sheet table', () => {
  it('prints a list, a record and nothing at all as one cell each', () => {
    expect(cellText(['a', 'b'])).toBe('a, b');
    expect(cellText({ source: 'drawing', reference: 'A-101' })).toBe('source: drawing; reference: A-101');
    expect(cellText(undefined)).toBe('');
    expect(cellText(null)).toBe('');
    expect(cellText(3)).toBe('3');
  });

  it('puts the columns a reader reads first, in that order', () => {
    expect(orderedColumns([{ detail: 'x', field: 'a', subjects: ['b'] }])).toEqual(['subjects', 'field', 'detail']);
  });

  it('carries every exception as a row of text, missing and conflicting alike', () => {
    const sheet = exceptionsSheet(result);
    expect(sheet.title).toBe('Exceptions (2)');
    expect(sheet.table.rowCount).toBe(2);
    expect(stringOf(sheet.table, 'subjects', 0)).toBe('b');
    expect(stringOf(sheet.table, 'kind', 0)).toBe('missing');
    expect(stringOf(sheet.table, 'reason', 0)).toBe('not-provided');
    expect(stringOf(sheet.table, 'kind', 1)).toBe('conflicting');
    expect(stringOf(sheet.table, 'values', 1)).toBe('900, 920');
    expect(stringOf(sheet.table, 'related', 1)).toBe('d');
  });

  it('names every object an exception was raised about, without repeats', () => {
    expect(exceptionSubjects(result)).toEqual(['b', 'c']);
  });

  it('orders the rows that raised an exception first, each group as it was given', () => {
    expect(exceptionsFirst(['a', 'b', 'c', 'd'], (item) => item === 'b' || item === 'd')).toEqual([
      'b',
      'd',
      'a',
      'c',
    ]);
  });

  it('gives a row the action the demo chose', () => {
    const sheet = exceptionsSheet(result, (row) => ({ command: 'sets.selectSet', input: { id: `row-${row}` } }));
    expect(sheet.rowAction?.(1)).toEqual({ command: 'sets.selectSet', input: { id: 'row-1' } });
  });
});
