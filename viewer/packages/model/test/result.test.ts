import { describe, expect, it } from 'vitest';
import {
  all, collect, diagnostic, failure, flatMap, formatPath, hasErrors, map, note, resultOf, success,
  underPath, valueOr, warning, type Result,
} from '../src/result.js';

const bad = diagnostic('x/bad', 'bad', ['a', 1]);

describe('result', () => {
  it('treats only errors as failures', () => {
    expect(hasErrors([warning('x/w', 'w'), note('x/n', 'n')])).toBe(false);
    expect(hasErrors([bad])).toBe(true);
  });

  it('fails a value when its diagnostics contain an error', () => {
    expect(resultOf(1, [warning('x/w', 'w')]).ok).toBe(true);
    expect(resultOf(1, [bad]).ok).toBe(false);
  });

  it('maps a success and passes a failure through', () => {
    expect(map(success(2), (n) => n * 3)).toEqual(success(6));
    expect(map(failure<number>([bad]), (n) => n * 3)).toEqual(failure([bad]));
  });

  it('concatenates diagnostics when chaining', () => {
    const first: Result<number> = success(2, [warning('a', 'a')]);
    const chained = flatMap(first, (n) => success(n + 1, [warning('b', 'b')]));
    expect(chained).toEqual(success(3, [warning('a', 'a'), warning('b', 'b')]));
  });

  it('succeeds with every value only when every result succeeded', () => {
    expect(all([success(1), success(2)])).toEqual(success([1, 2]));
    expect(all([success(1), failure<number>([bad])]).ok).toBe(false);
  });

  it('collects what succeeded and every diagnostic', () => {
    expect(collect([success(1), failure<number>([bad]), success(3)])).toEqual({
      values: [1, 3],
      diagnostics: [bad],
    });
  });

  it('falls back for a failure', () => {
    expect(valueOr(failure<number>([bad]), 7)).toBe(7);
    expect(valueOr(success(1), 7)).toBe(1);
  });

  it('reports a nested diagnostic under its parent path', () => {
    expect(underPath([bad], 'objects')).toEqual([{ ...bad, path: ['objects', 'a', 1] }]);
  });

  it('formats a path as a readable address', () => {
    expect(formatPath(['objects', 3, 'name'])).toBe('objects[3].name');
    expect(formatPath([])).toBe('');
  });
});
