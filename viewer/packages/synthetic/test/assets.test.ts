// Assets and clearances: the cases a handover and an access review have to tell apart.

import { describe, expect, it } from 'vitest';
import { columnOf, isRegistered, type Table } from '@bim-open-toolkit/model';
import { defaultAssetOptions, generateAssets } from '../src/assets.js';
import { boxesOverlap, defaultClearanceOptions, generateClearances } from '../src/clearances.js';

const strings = (source: Table, name: string): readonly string[] => {
  const column = columnOf(source, name);
  return column === undefined || column.type !== 'string' ? [] : [...column.values];
};

const numbers = (source: Table, name: string): readonly number[] => {
  const column = columnOf(source, name);
  return column === undefined || column.type !== 'f64' ? [] : [...column.values];
};

// How many maintenance events name each asset.
const eventCounts = (assets: ReturnType<typeof generateAssets>): ReadonlyMap<string, number> => {
  const counts = new Map<string, number>();
  for (const assetId of strings(assets.maintenanceEvents, 'assetId')) {
    counts.set(assetId, (counts.get(assetId) ?? 0) + 1);
  }
  return counts;
};

const assets = generateAssets(defaultAssetOptions);
const clearances = generateClearances(defaultClearanceOptions);

describe('generateAssets', () => {
  it('is a function of its options alone', () => {
    const again = generateAssets(defaultAssetOptions);
    expect(strings(again.maintenanceEvents, 'date')).toEqual(strings(assets.maintenanceEvents, 'date'));
    expect(strings(again.assets, 'installDate')).toEqual(strings(assets.assets, 'installDate'));
  });

  it('produces one row per asset in every table that is keyed by one', () => {
    expect(assets.assets.rowCount).toBe(defaultAssetOptions.assets);
    expect(assets.serviceHistoryStatus.rowCount).toBe(defaultAssetOptions.assets);
    expect(strings(assets.serviceHistoryStatus, 'assetId')).toEqual(strings(assets.assets, 'objectId'));
  });

  it('tells "never tracked" apart from "tracked, nothing recorded"', () => {
    const counts = eventCounts(assets);
    const ids = strings(assets.assets, 'objectId');
    const statuses = strings(assets.serviceHistoryStatus, 'status');
    const trackedEmpty = ids.filter((id, row) => statuses[row] === 'recorded' && (counts.get(id) ?? 0) === 0);
    const untrackedEmpty = ids.filter((id, row) => statuses[row] === 'not-recorded' && (counts.get(id) ?? 0) === 0);
    expect(trackedEmpty.length).toBeGreaterThan(0);
    expect(untrackedEmpty.length).toBeGreaterThan(0);
  });

  it('gives every recorded maintenance event a date and an asset that exists', () => {
    const ids = new Set(strings(assets.assets, 'objectId'));
    const dates = strings(assets.maintenanceEvents, 'date');
    strings(assets.maintenanceEvents, 'assetId').forEach((assetId, row) => {
      expect(ids.has(assetId)).toBe(true);
      expect(dates[row]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  it('carries a missing and a disputed install date', () => {
    const states = strings(assets.assets, 'installDateState');
    expect(states).toContain('missing');
    expect(states).toContain('conflicting');
    const values = strings(assets.assets, 'installDate');
    states.forEach((state, row) => {
      if (state !== 'known') expect(values[row]).toBe('');
    });
  });

  it('records a point of interest that names an asset that exists', () => {
    const ids = new Set(strings(assets.assets, 'objectId'));
    expect(assets.pointsOfInterest.rowCount).toBeGreaterThan(0);
    for (const assetId of strings(assets.pointsOfInterest, 'assetId')) expect(ids.has(assetId)).toBe(true);
    expect(numbers(assets.pointsOfInterest, 'z').every((value) => Number.isFinite(value))).toBe(true);
  });

  it('knows every install date and tracks every asset at gapScale zero', () => {
    const complete = generateAssets({ ...defaultAssetOptions, gapScale: 0 });
    expect(strings(complete.assets, 'installDateState').every((state) => state === 'known')).toBe(true);
    expect(strings(complete.serviceHistoryStatus, 'status').every((status) => status === 'recorded')).toBe(true);
  });

  it('refuses too few assets to carry the cases', () => {
    expect(() => generateAssets({ ...defaultAssetOptions, assets: 4 })).toThrow(/assets/);
  });
});

describe('generateClearances', () => {
  it('is a function of its options alone', () => {
    const again = generateClearances(defaultClearanceOptions);
    expect(numbers(again.penetrations, 'minX')).toEqual(numbers(clearances.penetrations, 'minX'));
  });

  it('reports one registered frame for both tables', () => {
    expect(isRegistered(clearances.coordinates)).toBe(true);
    expect(clearances.model.coordinates).toEqual(clearances.coordinates);
  });

  it('leaves an unregistered box as NaN rather than a box at the origin', () => {
    const states = strings(clearances.envelopes, 'bboxState');
    const minX = numbers(clearances.envelopes, 'minX');
    expect(states).toContain('missing');
    states.forEach((state, row) => {
      if (state === 'known') expect(Number.isFinite(minX[row] ?? Number.NaN)).toBe(true);
      else expect(Number.isNaN(minX[row] ?? 0)).toBe(true);
    });
  });

  it('leaves a disputed box untestable and shows both boxes', () => {
    const states = strings(clearances.penetrations, 'bboxState');
    const conflicts = strings(clearances.penetrations, 'bboxConflict');
    const disputed = states.indexOf('conflicting');
    expect(disputed).toBeGreaterThanOrEqual(0);
    expect(conflicts[disputed]).toContain(' vs ');
    expect(Number.isNaN(numbers(clearances.penetrations, 'minX')[disputed] ?? 0)).toBe(true);
  });

  it('produces candidate overlaps and boxes that overlap nothing', () => {
    expect(clearances.candidateOverlaps).toBeGreaterThan(0);
    expect(clearances.candidateOverlaps).toBeLessThan(defaultClearanceOptions.penetrations);
  });

  it('agrees with an overlap test read off the columns', () => {
    const read = (source: Table, row: number): { centre: [number, number, number]; size: [number, number, number] } => {
      const low: [number, number, number] = [
        numbers(source, 'minX')[row] ?? Number.NaN,
        numbers(source, 'minY')[row] ?? Number.NaN,
        numbers(source, 'minZ')[row] ?? Number.NaN,
      ];
      const high: [number, number, number] = [
        numbers(source, 'maxX')[row] ?? Number.NaN,
        numbers(source, 'maxY')[row] ?? Number.NaN,
        numbers(source, 'maxZ')[row] ?? Number.NaN,
      ];
      return {
        centre: [(low[0] + high[0]) / 2, (low[1] + high[1]) / 2, (low[2] + high[2]) / 2],
        size: [high[0] - low[0], high[1] - low[1], high[2] - low[2]],
      };
    };
    const envelopeStates = strings(clearances.envelopes, 'bboxState');
    const penetrationStates = strings(clearances.penetrations, 'bboxState');
    let found = 0;
    envelopeStates.forEach((envelopeState, envelope) => {
      if (envelopeState !== 'known') return;
      penetrationStates.forEach((penetrationState, penetration) => {
        if (penetrationState !== 'known') return;
        if (boxesOverlap(read(clearances.envelopes, envelope), read(clearances.penetrations, penetration))) found += 1;
      });
    });
    expect(found).toBe(clearances.candidateOverlaps);
  });

  it('registers every box at gapScale zero', () => {
    const complete = generateClearances({ ...defaultClearanceOptions, gapScale: 0 });
    expect(strings(complete.envelopes, 'bboxState').every((state) => state === 'known')).toBe(true);
    expect(strings(complete.penetrations, 'bboxState').every((state) => state === 'known')).toBe(true);
    expect(complete.candidateOverlaps).toBeGreaterThan(clearances.candidateOverlaps);
  });

  it('refuses too few participants', () => {
    expect(() => generateClearances({ ...defaultClearanceOptions, equipment: 1 })).toThrow(/equipment/);
  });
});
