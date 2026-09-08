import { describe, expect, it } from 'vitest';
import { defaultAssetOptions, generateAssets, type Assets } from '@bim-open-toolkit/synthetic';
import { indexFacts, objectRef, observationAt, rowOf } from '@bim-open-toolkit/model';
import {
  runAssetHandover,
  type AssetHandoverInput,
  type HandoverAsset,
  type MaintenanceEvent,
  type ServiceHistoryStatus,
  type ServiceHistoryTracking,
} from '../src/08-asset-handover.js';
import { observationJson } from '../src/observation.js';
import { exceptionRows, resultRows } from '../src/result.js';
import { valueOfResult } from './fixtures.js';

// `assets.ts` states its install dates as facts, like the door schedule's building does, so the
// observation comes from the fact index rather than from raw schedule columns.
const textAt = (value: unknown): string => (typeof value === 'string' ? value : '');

const trackingAt = (value: unknown): ServiceHistoryTracking => {
  const text = textAt(value);
  if (text === 'recorded' || text === 'not-recorded') return text;
  throw new Error(`unexpected service history status "${text}"`);
};

const handoverAssetsOf = (assets: Assets): readonly HandoverAsset[] => {
  const index = indexFacts(assets.facts);
  return Array.from({ length: assets.assets.rowCount }, (_, row) => {
    const cells = rowOf(assets.assets, row);
    const objectId = textAt(cells['objectId']);
    return {
      objectId,
      name: textAt(cells['name']),
      category: textAt(cells['category']),
      installDate: observationJson(observationAt(index, objectRef(assets.model.ref, objectId), 'installDate')),
    };
  });
};

const maintenanceEventsOf = (assets: Assets): readonly MaintenanceEvent[] =>
  Array.from({ length: assets.maintenanceEvents.rowCount }, (_, row) => {
    const cells = rowOf(assets.maintenanceEvents, row);
    return {
      id: textAt(cells['id']),
      assetId: textAt(cells['assetId']),
      date: textAt(cells['date']),
      note: textAt(cells['note']),
    };
  });

const serviceHistoryStatusOf = (assets: Assets): readonly ServiceHistoryStatus[] =>
  Array.from({ length: assets.serviceHistoryStatus.rowCount }, (_, row) => {
    const cells = rowOf(assets.serviceHistoryStatus, row);
    return { assetId: textAt(cells['assetId']), status: trackingAt(cells['status']) };
  });

const handoverInputOf = (assets: Assets): AssetHandoverInput => ({
  model: assets.model.ref,
  assets: handoverAssetsOf(assets),
  maintenanceEvents: maintenanceEventsOf(assets),
  serviceHistoryStatus: serviceHistoryStatusOf(assets),
});

const assets = generateAssets(defaultAssetOptions);
const input = handoverInputOf(assets);
const result = valueOfResult('generated asset handover', runAssetHandover(input));

describe('asset handover on a generated equipment register', () => {
  it('reports exactly the install-date gaps and untracked histories the generator documents, as exceptions', () => {
    const untrackedCount = input.serviceHistoryStatus.filter((item) => item.status === 'not-recorded').length;
    const dateGaps = assets.installDateCoverage.missing + assets.installDateCoverage.conflicting;
    expect(dateGaps).toBeGreaterThan(0);
    expect(untrackedCount).toBeGreaterThan(0);
    expect(exceptionRows(result)).toHaveLength(dateGaps + untrackedCount);
  });

  it('never confuses a genuinely empty tracked history with one nobody tracked', () => {
    const eventCountOf = (assetId: string): number =>
      input.maintenanceEvents.filter((event) => event.assetId === assetId).length;
    const trackedZero = input.assets.find(
      (asset) =>
        eventCountOf(asset.objectId) === 0 &&
        input.serviceHistoryStatus.some((item) => item.assetId === asset.objectId && item.status === 'recorded'),
    );
    const untrackedZero = input.assets.find(
      (asset) =>
        eventCountOf(asset.objectId) === 0 &&
        input.serviceHistoryStatus.some((item) => item.assetId === asset.objectId && item.status === 'not-recorded'),
    );
    expect(trackedZero).toBeDefined();
    expect(untrackedZero).toBeDefined();
    if (trackedZero === undefined || untrackedZero === undefined) return;

    const rows = resultRows(result, 'handover');
    const rowFor = (objectId: string): (typeof rows)[number] | undefined =>
      rows.find((row) => row['objectId'] === objectId);
    // Both read as a plain zero in the handover table: the table never guesses which kind of zero it is.
    expect(rowFor(trackedZero.objectId)?.['eventCount']).toBe(0);
    expect(rowFor(untrackedZero.objectId)?.['eventCount']).toBe(0);

    const hasServiceHistoryException = (objectId: string): boolean =>
      exceptionRows(result).some((row) => {
        const subjects = row['subjects'];
        return row['field'] === 'serviceHistoryStatus' && Array.isArray(subjects) && subjects.includes(objectId);
      });
    // Only the exceptions table tells the two apart.
    expect(hasServiceHistoryException(trackedZero.objectId)).toBe(false);
    expect(hasServiceHistoryException(untrackedZero.objectId)).toBe(true);
  });

  it('leaves no exception when every asset is tracked with a known install date', () => {
    const complete = generateAssets({ ...defaultAssetOptions, gapScale: 0 });
    const completeResult = valueOfResult(
      'generated asset handover (complete)',
      runAssetHandover(handoverInputOf(complete)),
    );
    expect(exceptionRows(completeResult)).toEqual([]);
  });
});
