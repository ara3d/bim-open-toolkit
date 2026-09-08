import { describe, expect, it } from 'vitest';
import {
  defaultDeliveryOptions,
  eventTypes,
  generateDeliverySchedule,
  type DeliverySchedule,
} from '@bim-open-toolkit/synthetic';
import { rowOf, type CellValue } from '@bim-open-toolkit/model';
import {
  runDeliveryTimeline,
  type DeliveryEventType,
  type DeliveryTimelineInput,
  type TimelineEvent,
  type TimelineObject,
} from '../src/05-delivery-timeline.js';
import { missingReasons, type ObservationJson } from '../src/observation.js';
import { keyOf } from '../src/keys.js';
import { exceptionRows } from '../src/result.js';
import { valueOfResult } from './fixtures.js';

// `deliveries.ts` reports its event dates as plain schedule columns (dates are text, not numbers),
// so the observation is rebuilt from those columns rather than read off a fact index.
const textAt = (value: unknown): string => (typeof value === 'string' ? value : '');

const reasonAt = (value: unknown): (typeof missingReasons)[number] => {
  const text = textAt(value);
  const found = missingReasons.find((reason) => reason === text);
  return found ?? 'not-provided';
};

const textObservationOf = (cells: Readonly<Record<string, CellValue>>, name: string): ObservationJson => {
  const state = textAt(cells[`${name}State`]);
  if (state === 'known') return { kind: 'known', value: textAt(cells[name]) };
  if (state === 'conflicting') return { kind: 'conflicting', values: textAt(cells[`${name}Conflict`]).split(' vs ') };
  return { kind: 'missing', reason: reasonAt(cells[`${name}MissingReason`]) };
};

const eventTypeAt = (value: unknown): DeliveryEventType => {
  const text = textAt(value);
  const found = eventTypes.find((type) => type === text);
  if (found === undefined) throw new Error(`unexpected event type "${text}"`);
  return found;
};

const objectsOf = (schedule: DeliverySchedule): readonly TimelineObject[] =>
  Array.from({ length: schedule.objects.rowCount }, (_, row) => {
    const cells = rowOf(schedule.objects, row);
    return { objectId: textAt(cells['objectId']), name: textAt(cells['name']) };
  });

const eventsOf = (schedule: DeliverySchedule): readonly TimelineEvent[] =>
  Array.from({ length: schedule.events.rowCount }, (_, row) => {
    const cells = rowOf(schedule.events, row);
    return {
      id: textAt(cells['id']),
      objectId: textAt(cells['objectId']),
      eventType: eventTypeAt(cells['eventType']),
      date: textObservationOf(cells, 'date'),
    };
  });

const timelineInputOf = (schedule: DeliverySchedule): DeliveryTimelineInput => ({
  model: schedule.model.ref,
  asOfDate: schedule.asOfDate,
  objects: objectsOf(schedule),
  events: eventsOf(schedule),
});

const schedule = generateDeliverySchedule(defaultDeliveryOptions);
const input = timelineInputOf(schedule);
const result = valueOfResult('generated delivery timeline', runDeliveryTimeline(input));

const trackedIds = new Set(input.events.map((event) => event.objectId));
const untrackedIds = input.objects.filter((object) => !trackedIds.has(object.objectId)).map((object) => object.objectId);
const conflictingIds = [
  ...new Set(input.events.filter((event) => event.date.kind === 'conflicting').map((event) => event.objectId)),
];

describe('the delivery timeline on a generated procurement record', () => {
  it('reports exactly the disputed dates and untracked items the generator documents, as exceptions', () => {
    // A disputed date and an object with no events at all never coincide: an item with no events
    // pushes no rows to disagree over, so the two counts never double up.
    expect(schedule.dateCoverage.conflicting).toBeGreaterThan(0);
    expect(untrackedIds.length).toBeGreaterThan(0);
    expect(exceptionRows(result)).toHaveLength(schedule.dateCoverage.conflicting + untrackedIds.length);
  });

  it('collects into its exceptions set only the objects an exception was actually raised for', () => {
    const exceptionSet = result.sets.find((item) => item.id === 'delivery-timeline/exceptions');
    expect(exceptionSet).toBeDefined();
    if (exceptionSet === undefined) return;
    const expectedKeys = new Set([...conflictingIds, ...untrackedIds].map((id) => keyOf(input.model, id)));
    expect(exceptionSet.members).toEqual(expectedKeys);
  });

  it('reports no disputed date once the generator is asked for a complete schedule', () => {
    const complete = generateDeliverySchedule({ ...defaultDeliveryOptions, gapScale: 0 });
    expect(complete.dateCoverage.missing).toBe(0);
    expect(complete.dateCoverage.conflicting).toBe(0);
    const completeResult = valueOfResult(
      'generated delivery timeline (complete)',
      runDeliveryTimeline(timelineInputOf(complete)),
    );
    // `gapScale` only governs the date-quality states; whether an item has any event recorded yet at
    // all is a separate chance the generator's own comment calls a normal state rather than an
    // exceptional one. So the only exceptions a complete schedule can still report are those.
    expect(exceptionRows(completeResult).every((row) => row['field'] === 'events')).toBe(true);
  });
});
