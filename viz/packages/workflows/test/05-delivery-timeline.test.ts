import { describe, expect, it } from 'vitest';
import {
  deliveryTimelineInputSchema,
  runDeliveryTimeline,
  type TimelineEvent,
} from '../src/05-delivery-timeline.js';
import { exceptionRows, resultRows } from '../src/result.js';
import { fixtureInput, fixtureModel, loadFixture, valueOfResult } from './fixtures.js';

const fixture = loadFixture('05-delivery-timeline');
const input = fixtureInput(deliveryTimelineInputSchema, fixture, { model: fixtureModel });
const result = valueOfResult('delivery timeline', runDeliveryTimeline(input));

describe('delivery timeline', () => {
  it('produces the expected timeline rows', () => {
    expect(resultRows(result, 'timeline')).toEqual(fixture.expected['timeline']);
  });

  it('produces the expected exception rows', () => {
    expect(exceptionRows(result)).toEqual(fixture.expected['exceptions']);
  });

  it('does not demote a known installed state for a missing accepted event', () => {
    const row = resultRows(result, 'timeline').find((item) => item['objectId'] === 'EQ-4');
    expect(row?.['state']).toBe('installed');
    expect(row?.['coverageNote']).toBe('delivered, accepted not observed');
  });

  it('keeps a future-dated known event out of the current state', () => {
    const row = resultRows(result, 'timeline').find((item) => item['objectId'] === 'EQ-7');
    expect(row?.['state']).toBe('accepted');
    expect(row?.['futureDates']).toEqual({ installed: '2026-07-01' });
  });

  it('reads two records of one event type that disagree as a conflict', () => {
    const second: TimelineEvent = {
      id: 'e13',
      objectId: 'EQ-1',
      eventType: 'delivered',
      date: { kind: 'known', value: '2026-01-11' },
    };
    const merged = valueOfResult(
      'delivery timeline',
      runDeliveryTimeline({ ...input, events: [...input.events, second] }),
    );
    expect(exceptionRows(merged)[0]).toEqual({
      subjects: ['EQ-1'],
      field: 'delivered',
      kind: 'conflicting',
      values: ['2026-01-10', '2026-01-11'],
    });
    const row = resultRows(merged, 'timeline').find((item) => item['objectId'] === 'EQ-1');
    expect(row?.['state']).toBe('installed');
    expect(row?.['knownDates']).toEqual({ accepted: '2026-01-20', installed: '2026-02-01' });
    expect(row?.['coverageNote']).toBe('delivered not observed');
  });

  it('refuses an objects table that repeats an id rather than losing a row', () => {
    const repeated = runDeliveryTimeline({ ...input, objects: [...input.objects, ...input.objects.slice(0, 1)] });
    expect(repeated.ok).toBe(false);
    expect(repeated.diagnostics.map((item) => item.code)).toEqual(['workflow/duplicate-id']);
  });
});
