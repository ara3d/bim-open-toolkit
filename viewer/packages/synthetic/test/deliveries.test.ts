// The procurement record: determinism, the states staying apart, and every gap the timeline has to
// show.

import { describe, expect, it } from 'vitest';
import { columnOf, type Table } from '@bim-open-toolkit/model';
import { defaultDeliveryOptions, eventTypes, generateDeliverySchedule } from '../src/deliveries.js';

// The three states in rank order, as plain strings, so a row's event type can be looked up.
const order: readonly string[] = eventTypes;

const strings = (source: Table, name: string): readonly string[] => {
  const column = columnOf(source, name);
  return column === undefined || column.type !== 'string' ? [] : [...column.values];
};

// The highest-ranked state an item reaches by the as-of date, read the way a timeline would: only
// a known date that has already passed counts.
function stateOf(events: Table, objectId: string, asOfDate: string): string {
  const owners = strings(events, 'objectId');
  const types = strings(events, 'eventType');
  const dates = strings(events, 'date');
  const states = strings(events, 'dateState');
  let best = -1;
  owners.forEach((owner, row) => {
    if (owner !== objectId || states[row] !== 'known') return;
    if ((dates[row] ?? '') > asOfDate) return;
    best = Math.max(best, order.indexOf(types[row] ?? ''));
  });
  return best < 0 ? 'scheduled' : (order[best] ?? 'scheduled');
}

const schedule = generateDeliverySchedule(defaultDeliveryOptions);

describe('generateDeliverySchedule', () => {
  it('is a function of its options alone', () => {
    const again = generateDeliverySchedule(defaultDeliveryOptions);
    expect(strings(again.events, 'id')).toEqual(strings(schedule.events, 'id'));
    expect(strings(again.events, 'date')).toEqual(strings(schedule.events, 'date'));
  });

  it('produces one row per item and events that all name an item', () => {
    expect(schedule.objects.rowCount).toBe(defaultDeliveryOptions.items);
    const items = new Set(strings(schedule.objects, 'objectId'));
    for (const objectId of strings(schedule.events, 'objectId')) expect(items.has(objectId)).toBe(true);
  });

  it('only uses the three event types', () => {
    for (const type of strings(schedule.events, 'eventType')) {
      expect(order).toContain(type);
    }
  });

  it('never repeats an event type for one item', () => {
    const seen = new Set<string>();
    const owners = strings(schedule.events, 'objectId');
    const types = strings(schedule.events, 'eventType');
    owners.forEach((owner, row) => {
      const key = `${owner}/${String(types[row])}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    });
  });

  it('dates acceptance after delivery and installation after acceptance', () => {
    const owners = strings(schedule.events, 'objectId');
    const types = strings(schedule.events, 'eventType');
    const dates = strings(schedule.events, 'date');
    const states = strings(schedule.events, 'dateState');
    const byItem = new Map<string, Map<string, string>>();
    owners.forEach((owner, row) => {
      if (states[row] !== 'known') return;
      const known = byItem.get(owner) ?? new Map<string, string>();
      known.set(types[row] ?? '', dates[row] ?? '');
      byItem.set(owner, known);
    });
    for (const known of byItem.values()) {
      const delivered = known.get('delivered');
      const accepted = known.get('accepted');
      const installed = known.get('installed');
      if (delivered !== undefined && accepted !== undefined) expect(accepted > delivered).toBe(true);
      if (accepted !== undefined && installed !== undefined) expect(installed > accepted).toBe(true);
    }
  });

  it('leaves an unrecorded date empty beside a state column, never as a guessed date', () => {
    const dates = strings(schedule.events, 'date');
    const states = strings(schedule.events, 'dateState');
    states.forEach((state, row) => {
      if (state === 'known') expect(dates[row]).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      else expect(dates[row]).toBe('');
    });
    expect(states.filter((state) => state === 'missing').length).toBeGreaterThan(0);
    expect(states.filter((state) => state === 'conflicting').length).toBeGreaterThan(0);
  });

  it('records both disputed dates of a conflicting event', () => {
    const states = strings(schedule.events, 'dateState');
    const conflicts = strings(schedule.events, 'dateConflict');
    states.forEach((state, row) => {
      if (state === 'conflicting') expect(conflicts[row]).toMatch(/^\d{4}-\d{2}-\d{2} vs \d{4}-\d{2}-\d{2}$/);
      else expect(conflicts[row]).toBe('');
    });
  });

  it('leaves some items with no events at all and some events in the future', () => {
    const owners = new Set(strings(schedule.events, 'objectId'));
    const silent = strings(schedule.objects, 'objectId').filter((objectId) => !owners.has(objectId));
    expect(silent.length).toBeGreaterThan(0);

    const dates = strings(schedule.events, 'date');
    const states = strings(schedule.events, 'dateState');
    const future = dates.filter((date, row) => states[row] === 'known' && date > schedule.asOfDate);
    expect(future.length).toBeGreaterThan(0);
  });

  it('leaves at least one item whose installation is known but whose acceptance is not recorded', () => {
    const owners = strings(schedule.events, 'objectId');
    const types = strings(schedule.events, 'eventType');
    const gaps = strings(schedule.objects, 'objectId').filter((objectId) => {
      const rows = owners.map((owner, row) => (owner === objectId ? types[row] : undefined));
      return rows.includes('installed') && !rows.includes('accepted');
    });
    expect(gaps.length).toBeGreaterThan(0);
  });

  it('reaches every timeline state across the fixture', () => {
    const states = strings(schedule.objects, 'objectId').map((objectId) =>
      stateOf(schedule.events, objectId, schedule.asOfDate),
    );
    for (const expected of ['scheduled', 'delivered', 'accepted', 'installed']) {
      expect(states).toContain(expected);
    }
  });

  it('has a coverage that agrees with the state columns', () => {
    const states = strings(schedule.events, 'dateState');
    expect(schedule.dateCoverage.total).toBe(states.length);
    expect(schedule.dateCoverage.known).toBe(states.filter((state) => state === 'known').length);
  });

  // gapScale governs what nobody recorded. It does not govern progress: an item that has not been
  // installed yet is not a gap, so events still legitimately go missing at gapScale zero.
  it('records every date it has at gapScale zero', () => {
    const complete = generateDeliverySchedule({ ...defaultDeliveryOptions, gapScale: 0 });
    expect(strings(complete.events, 'dateState').every((state) => state === 'known')).toBe(true);
  });

  it('draws one crate per item', () => {
    expect(schedule.model.objects.length).toBe(defaultDeliveryOptions.items);
    expect(schedule.geometry.instances.count).toBe(defaultDeliveryOptions.items);
  });

  it('refuses an as-of date before the start date', () => {
    expect(() => generateDeliverySchedule({ ...defaultDeliveryOptions, asOfDate: '2025-01-01' })).toThrow(/asOfDate/);
    expect(() => generateDeliverySchedule({ ...defaultDeliveryOptions, items: 0 })).toThrow(/items/);
  });
});
