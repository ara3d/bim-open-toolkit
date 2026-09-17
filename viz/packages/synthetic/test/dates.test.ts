// Calendar arithmetic: the round trip, the leap-year cases and the failures.

import { describe, expect, it } from 'vitest';
import { addDays, dayOf, daysFromCivil, isoDate } from '../src/dates.js';
import { joinIds, splitIds } from '../src/arrays.js';

describe('day numbers', () => {
  it('puts the epoch at zero', () => {
    expect(daysFromCivil(1970, 1, 1)).toBe(0);
    expect(isoDate(0)).toBe('1970-01-01');
  });

  it('agrees with the known day number of a later date', () => {
    expect(daysFromCivil(2026, 9, 7)).toBe(20703);
    expect(isoDate(20703)).toBe('2026-09-07');
  });

  it('handles the leap day and the day after it', () => {
    expect(isoDate(daysFromCivil(2024, 2, 29))).toBe('2024-02-29');
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29');
    expect(addDays('2024-02-29', 1)).toBe('2024-03-01');
  });

  it('skips the leap day in a century that is not a leap year', () => {
    expect(addDays('2100-02-28', 1)).toBe('2100-03-01');
    expect(addDays('2000-02-28', 1)).toBe('2000-02-29');
  });

  it('round trips every day of four years', () => {
    const start = daysFromCivil(2024, 1, 1);
    for (let day = start; day < start + 1461; day++) {
      expect(dayOf(isoDate(day))).toBe(day);
    }
  });

  it('crosses a year boundary in both directions', () => {
    expect(addDays('2025-12-31', 1)).toBe('2026-01-01');
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('refuses a month out of range and a malformed date', () => {
    expect(() => daysFromCivil(2026, 13, 1)).toThrow(/month must be 1 to 12/);
    expect(() => daysFromCivil(2026.5, 1, 1)).toThrow(/three integers/);
    expect(() => dayOf('7 September 2026')).toThrow(/YYYY-MM-DD/);
    expect(() => dayOf('2026-9-7')).toThrow(/YYYY-MM-DD/);
    expect(() => isoDate(0.5)).toThrow(/integer/);
  });
});

describe('id lists in one cell', () => {
  it('round trips a list', () => {
    expect(splitIds(joinIds(['a', 'b', 'c']))).toEqual(['a', 'b', 'c']);
  });

  it('reads an empty cell as no ids rather than one empty id', () => {
    expect(joinIds([])).toBe('');
    expect(splitIds('')).toEqual([]);
  });
});
