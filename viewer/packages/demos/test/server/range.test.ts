import { describe, expect, it } from 'vitest';
import { parseByteRange } from '../../src/server/range.js';

const SIZE = 100;

describe('parseByteRange', () => {
  it('serves the whole file when no range is asked for', () => {
    expect(parseByteRange(null, SIZE)).toEqual({ kind: 'whole' });
  });

  it('reads a closed range', () => {
    expect(parseByteRange('bytes=10-19', SIZE)).toEqual({ kind: 'partial', range: { start: 10, end: 19 } });
  });

  it('reads an open range as running to the last byte', () => {
    expect(parseByteRange('bytes=90-', SIZE)).toEqual({ kind: 'partial', range: { start: 90, end: 99 } });
  });

  it('clamps an end past the last byte', () => {
    expect(parseByteRange('bytes=95-1000', SIZE)).toEqual({ kind: 'partial', range: { start: 95, end: 99 } });
  });

  it('reads a suffix range as the last bytes', () => {
    expect(parseByteRange('bytes=-4', SIZE)).toEqual({ kind: 'partial', range: { start: 96, end: 99 } });
    expect(parseByteRange('bytes=-1000', SIZE)).toEqual({ kind: 'partial', range: { start: 0, end: 99 } });
  });

  it('refuses a range that starts past the end, and a zero-length suffix', () => {
    expect(parseByteRange('bytes=100-', SIZE)).toEqual({ kind: 'unsatisfiable' });
    expect(parseByteRange('bytes=200-300', SIZE)).toEqual({ kind: 'unsatisfiable' });
    expect(parseByteRange('bytes=-0', SIZE)).toEqual({ kind: 'unsatisfiable' });
  });

  it('refuses any range of an empty file', () => {
    expect(parseByteRange('bytes=0-', 0)).toEqual({ kind: 'unsatisfiable' });
    expect(parseByteRange('bytes=-1', 0)).toEqual({ kind: 'unsatisfiable' });
  });

  it('ignores headers it cannot understand and serves the whole file', () => {
    for (const header of ['bytes=', 'bytes=abc', 'items=0-1', 'bytes=0-1, 5-6', 'bytes=19-10', ''])
      expect(parseByteRange(header, SIZE), header).toEqual({ kind: 'whole' });
  });

  it('tolerates surrounding whitespace', () => {
    expect(parseByteRange('  bytes=0-1 ', SIZE)).toEqual({ kind: 'partial', range: { start: 0, end: 1 } });
  });
});
