import { describe, expect, it } from 'vitest';
import { DEFAULT_FIXTURE_DIRS, parseFixtureDirs, parsePort } from '../../src/server/config.js';

describe('parseFixtureDirs', () => {
  it('splits on semicolons and trims', () => {
    expect(parseFixtureDirs(' C:/a ; C:/b ')).toEqual(['C:/a', 'C:/b']);
  });

  it('drops blank entries', () => {
    expect(parseFixtureDirs('C:/a;;C:/b;')).toEqual(['C:/a', 'C:/b']);
  });

  it('falls back when nothing is configured', () => {
    expect(parseFixtureDirs(null)).toEqual(DEFAULT_FIXTURE_DIRS);
    expect(parseFixtureDirs('  ')).toEqual(DEFAULT_FIXTURE_DIRS);
    expect(parseFixtureDirs('', ['C:/fallback'])).toEqual(['C:/fallback']);
  });

  it('keeps Windows paths with drive letters intact', () => {
    expect(parseFixtureDirs('C:/models;D:/other models')).toEqual(['C:/models', 'D:/other models']);
  });
});

describe('parsePort', () => {
  it('reads a whole port number', () => {
    expect(parsePort('5175', 0)).toBe(5175);
    expect(parsePort('0', 5175)).toBe(0);
  });

  it('falls back for anything that is not a port', () => {
    for (const value of [null, '', ' ', 'abc', '-1', '65536', '80.5'])
      expect(parsePort(value, 5175), String(value)).toBe(5175);
  });
});
