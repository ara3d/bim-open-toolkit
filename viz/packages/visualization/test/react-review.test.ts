import { describe, expect, it, vi } from 'vitest';
import { SelectionStore } from '../src/selection.js';
import { identityMatrix, type ObjectRecord } from '../src/contracts.js';
import type { DoorSchedule, DoorScheduleRow } from '../src/building-model.js';
import { filterDoorRows, ReviewController } from '../examples/react-review/controller.js';

const ref = { modelId: 'model', objectId: 'door' };
const base: readonly ObjectRecord[] = [{ ref, transform: identityMatrix, appearance: { color: [1, 1, 1], opacity: 1, visible: true } }];
const missing = { state: 'missing', reason: 'NotObserved', explanation: 'Unavailable', unit: 'm', evidenceIds: [] } as const;
const rows: readonly DoorScheduleRow[] = [
  { id: 'b', name: 'Door B', ref, nominalWidth: missing, clearWidth: missing, evidenceIds: [] },
  { id: 'a', name: 'Door A', nominalWidth: { state: 'known', value: 0.9, unit: 'm', assurance: 'Observed', evidenceIds: [] }, clearWidth: missing, evidenceIds: [] },
];
const count = { total: 2, known: 1, missing: 1, conflicting: 0, invalid: 0, inapplicable: 0 };
const schedule: DoorSchedule = { snapshotId: 'snapshot', sourceFingerprint: 'hash', rows, evidence: [], coverage: { nominalWidth: count, clearWidth: { ...count, known: 0, missing: 2 } } };
describe('React review host bridge', () => {
  it('filters/sorts immutable fact rows and keeps unavailable widths last', () => {
    expect(filterDoorRows(rows, 'door', 'name').map(row => row.id)).toEqual(['a', 'b']);
    expect(filterDoorRows(rows, '', 'width').map(row => row.id)).toEqual(['a', 'b']);
    expect(filterDoorRows(rows, ' door b ', 'width').map(row => row.id)).toEqual(['b']);
    expect(rows.map(row => row.id)).toEqual(['b', 'a']);
  });
  it('provides stable external-store snapshots, one event/update per actual selection change and cleanup', () => {
    const selection = new SelectionStore(), update = vi.fn(), listener = vi.fn();
    const controller = new ReviewController(selection, base, update);
    expect(controller.getSnapshot()).toBe(controller.getSnapshot());
    const before = controller.getSnapshot();
    const stop = controller.subscribe(listener);
    controller.select(ref); controller.select(ref);
    expect(controller.getSnapshot()).not.toBe(before);
    expect(listener).toHaveBeenCalledTimes(1); expect(update).toHaveBeenCalledTimes(1);
    stop(); controller.dispose(); controller.dispose(); selection.replace([]);
    expect(listener).toHaveBeenCalledTimes(1); expect(update).toHaveBeenCalledTimes(1);
    selection.dispose();
  });
  it('composes coverage/selection through public APIs without mutating model data', () => {
    const selection = new SelectionStore(), update = vi.fn(), controller = new ReviewController(selection, base, update);
    controller.setSchedule(schedule);
    expect(update.mock.lastCall![0][0].appearance.color).toEqual([0.95, 0.4, 0.05]);
    controller.select(ref); expect(update.mock.lastCall![0][0].appearance.color).toEqual([0.1, 1, 0.35]);
    controller.clear(); controller.setCoverage(false);
    expect(update.mock.lastCall![0][0].appearance.color).toEqual([1, 1, 1]);
    expect(base[0]!.appearance.color).toEqual([1, 1, 1]);
    controller.dispose(); selection.dispose();
  });
});
