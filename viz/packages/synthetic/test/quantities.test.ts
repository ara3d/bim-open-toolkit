// The takeoff: determinism, supplied measurements that are not the geometry, and every gap a
// subtotal has to leave out.

import { describe, expect, it } from 'vitest';
import { columnOf, triangleCount, type Table } from '@bim-open-toolkit/model';
import { defaultQuantityOptions, generateQuantities } from '../src/quantities.js';

const strings = (source: Table, name: string): readonly string[] => {
  const column = columnOf(source, name);
  return column === undefined || column.type !== 'string' ? [] : [...column.values];
};

const numbers = (source: Table, name: string): readonly number[] => {
  const column = columnOf(source, name);
  return column === undefined || column.type !== 'f64' ? [] : [...column.values];
};

const quantities = generateQuantities(defaultQuantityOptions);
const faces = defaultQuantityOptions.rooms * defaultQuantityOptions.facesPerRoom + defaultQuantityOptions.roofFaces;

describe('generateQuantities', () => {
  it('is a function of its options alone', () => {
    const again = generateQuantities(defaultQuantityOptions);
    expect(numbers(again.surfaces, 'areaM2')).toEqual(numbers(quantities.surfaces, 'areaM2'));
    expect(strings(again.surfaces, 'finishType')).toEqual(strings(quantities.surfaces, 'finishType'));
  });

  it('produces one row per face, roof faces included', () => {
    expect(quantities.surfaces.rowCount).toBe(faces);
    expect(strings(quantities.surfaces, 'scope').filter((scope) => scope === 'roof').length).toBe(
      defaultQuantityOptions.roofFaces,
    );
  });

  it('reports an unmeasured area as NaN beside a state column, never as zero', () => {
    const values = numbers(quantities.surfaces, 'areaM2');
    const states = strings(quantities.surfaces, 'areaM2State');
    values.forEach((value, row) => {
      if (states[row] === 'known') expect(value).toBeGreaterThan(0);
      else expect(Number.isNaN(value)).toBe(true);
    });
  });

  it('produces unassigned, disputed and unmeasured faces', () => {
    const finishes = strings(quantities.surfaces, 'finishTypeState');
    const areas = strings(quantities.surfaces, 'areaM2State');
    expect(finishes.filter((state) => state === 'missing').length).toBeGreaterThan(0);
    expect(finishes.filter((state) => state === 'conflicting').length).toBeGreaterThan(0);
    expect(areas.filter((state) => state === 'missing').length).toBeGreaterThan(0);
    expect(areas.filter((state) => state === 'conflicting').length).toBeGreaterThan(0);
  });

  it('names two different finishes in a conflict', () => {
    const states = strings(quantities.surfaces, 'finishTypeState');
    const conflicts = strings(quantities.surfaces, 'finishTypeConflict');
    states.forEach((state, row) => {
      if (state !== 'conflicting') return;
      const parts = (conflicts[row] ?? '').split(' vs ');
      expect(parts.length).toBe(2);
      expect(parts[0]).not.toBe(parts[1]);
    });
  });

  it('measures unit m2 wherever an area is known', () => {
    const states = strings(quantities.surfaces, 'areaM2State');
    const units = strings(quantities.surfaces, 'areaM2Unit');
    states.forEach((state, row) => {
      expect(units[row]).toBe(state === 'known' ? 'm2' : '');
    });
  });

  it('supplies a measurement close to the geometry but not equal to it', () => {
    // Each face is one unit plane scaled by its size, so the geometric area is the product of the
    // lengths of the transform's first and third columns. The supplied measurement is drawn
    // separately: close enough to be the same face, never the same number.
    const values = numbers(quantities.surfaces, 'areaM2');
    const states = strings(quantities.surfaces, 'areaM2State');
    let differing = 0;
    quantities.model.objects.forEach((record, row) => {
      if (states[row] !== 'known') return;
      const width = Math.hypot(record.transform[0], record.transform[1], record.transform[2]);
      const depth = Math.hypot(record.transform[8], record.transform[9], record.transform[10]);
      const geometric = width * depth;
      const supplied = values[row] ?? Number.NaN;
      expect(Math.abs(supplied - geometric) / geometric).toBeLessThan(0.1);
      if (Math.abs(supplied - geometric) / geometric > 0.005) differing += 1;
    });
    expect(differing).toBeGreaterThan(0);
    for (const group of quantities.meshGroups) expect(triangleCount(group.mesh)).toBe(2);
  });

  it('leaves a roof face with no room and marks it as such', () => {
    const scopes = strings(quantities.surfaces, 'scope');
    const rooms = strings(quantities.surfaces, 'roomId');
    scopes.forEach((scope, row) => {
      if (scope === 'roof') expect(rooms[row]).toBe('');
    });
  });

  it('has coverages that agree with the state columns', () => {
    const areas = strings(quantities.surfaces, 'areaM2State');
    expect(quantities.areaCoverage.total).toBe(faces);
    expect(quantities.areaCoverage.known).toBe(areas.filter((state) => state === 'known').length);
    expect(quantities.finishCoverage.total).toBe(faces);
  });

  it('records two facts per face', () => {
    expect(quantities.facts.length).toBe(faces * 2);
  });

  it('knows everything at gapScale zero', () => {
    const complete = generateQuantities({ ...defaultQuantityOptions, gapScale: 0 });
    expect(strings(complete.surfaces, 'areaM2State').every((state) => state === 'known')).toBe(true);
    expect(strings(complete.surfaces, 'finishTypeState').every((state) => state === 'known')).toBe(true);
    // A roof face still belongs to no room: that is what a roof is, not a gap in the data.
    expect(strings(complete.surfaces, 'roomId').filter((roomId) => roomId === '').length).toBe(
      defaultQuantityOptions.roofFaces,
    );
  });

  it('refuses options it cannot build', () => {
    expect(() => generateQuantities({ ...defaultQuantityOptions, rooms: 0 })).toThrow(/rooms/);
    expect(() => generateQuantities({ ...defaultQuantityOptions, roofFaces: -1 })).toThrow(/roofFaces/);
  });
});
