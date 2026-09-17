import { emptyDocument, getSlice, putSlice, stringOf, type AnyFeature, type StyleRule } from '@bim-open-toolkit/model';
import { createSession, featureHost } from '@bim-open-toolkit/viewer';
import { defaultDeliveryOptions, generateDeliverySchedule } from '@bim-open-toolkit/synthetic';
import { fakeClock } from '@bim-open-toolkit/testing';
import { describe, expect, it } from 'vitest';
import {
  animationCommands,
  animationFeature,
  animationFeatureWith,
  animationRules,
  animationSlice,
  currentRules,
  dateMs,
  eventWindow,
  noAnimation,
  seekTo,
  stateAt,
  statesAt,
  timelineFromDates,
  timelineStates,
  type AnimationState,
  type DatedStateChange,
  type TimelineEvent,
  type TimelineState,
} from '../src/animation.js';
import { fakeSession } from './support/fake-session.js';

const events: readonly TimelineEvent[] = [
  { objectKey: 'a', state: 'delivered', timeMs: 100 },
  { objectKey: 'a', state: 'accepted', timeMs: 200 },
  { objectKey: 'a', state: 'installed', timeMs: 300 },
  { objectKey: 'b', state: 'delivered', timeMs: 250 },
];

const loaded: AnimationState = { ...noAnimation, events, startMs: 100, endMs: 300, currentMs: 100 };

// The state a schedule column names, or undefined when it is not one of the four.
const stateNamed = (value: string): TimelineState | undefined =>
  timelineStates.find((name) => name === value);

describe('animation slice', () => {
  it('round trips through a document', () => {
    const document = putSlice(emptyDocument(), animationSlice, loaded);
    const read = getSlice(document, animationSlice);
    expect(read.ok && read.value).toEqual(loaded);
  });

  it('refuses a window that ends before it starts', () => {
    const broken = { ...noAnimation, startMs: 10, endMs: 5 };
    const document = { ...emptyDocument(), slices: { animation: { version: 1, value: broken } } };
    expect(getSlice(document, animationSlice).ok).toBe(false);
  });
});

describe('reading a state from the events', () => {
  it('is pending before anything was recorded', () => {
    expect(stateAt(events, 'a', 50)).toBe('pending');
    expect(statesAt(events, 50).size).toBe(0);
  });

  it('is the furthest state reached by the time', () => {
    expect(stateAt(events, 'a', 250)).toBe('accepted');
    expect(stateAt(events, 'a', 300)).toBe('installed');
    expect(stateAt(events, 'b', 300)).toBe('delivered');
  });

  it('reports the window the events cover', () => {
    expect(eventWindow(events)).toEqual({ startMs: 100, endMs: 300 });
    expect(eventWindow([])).toEqual({ startMs: 0, endMs: 0 });
  });
});

describe('colouring by state', () => {
  const namesOf = (rules: readonly StyleRule[]): readonly string[] => rules.map((rule) => rule.id);

  it('makes one rule per state anything is in, and none for pending', () => {
    expect(namesOf(animationRules(loaded, 250))).toEqual(['animation-delivered', 'animation-accepted']);
    expect(animationRules(loaded, 50)).toEqual([]);
  });

  it('targets exactly the objects in that state', () => {
    const rules = animationRules(loaded, 250);
    expect(rules.find((rule) => rule.id === 'animation-delivered')?.targets).toEqual(['b']);
    expect(rules.find((rule) => rule.id === 'animation-accepted')?.targets).toEqual(['a']);
  });

  it('reads the rules for where playback is now', () => {
    expect(currentRules({ ...loaded, currentMs: 300 }).map((rule) => rule.id)).toEqual([
      'animation-delivered',
      'animation-installed',
    ]);
  });
});

describe('a timeline from dated rows', () => {
  it('reads a date and leaves an undated event off the timeline, saying so', () => {
    const rows: readonly DatedStateChange[] = [
      { objectKey: 'a', state: 'delivered', date: '2026-01-05' },
      { objectKey: 'b', state: 'accepted', date: '' },
    ];
    const built = timelineFromDates(rows);
    expect(built.ok && built.value).toHaveLength(1);
    expect(built.diagnostics.map((item) => item.code)).toEqual(['animation/undated']);
  });

  it('reads the delivery schedule fixture', () => {
    const schedule = generateDeliverySchedule(defaultDeliveryOptions);
    const rows: DatedStateChange[] = [];
    for (let row = 0; row < schedule.events.rowCount; row += 1) {
      const state = stateNamed(stringOf(schedule.events, 'eventType', row) ?? '');
      const objectKey = stringOf(schedule.events, 'objectId', row);
      if (state === undefined || objectKey === undefined) continue;
      rows.push({ objectKey, state, date: stringOf(schedule.events, 'date', row) ?? '' });
    }
    expect(rows.length).toBeGreaterThan(0);
    const built = timelineFromDates(rows);
    expect(built.ok).toBe(true);
    const timeline = built.ok ? built.value : [];
    expect(timeline.length).toBeGreaterThan(0);
    expect(timeline.length).toBeLessThan(rows.length);
    const window = eventWindow(timeline);
    expect(window.endMs).toBeGreaterThan(window.startMs);
  });

  it('reads only a whole date', () => {
    expect(dateMs('2026-01-05')).toBe(Date.parse('2026-01-05T00:00:00Z'));
    expect(dateMs('not a date')).toBeUndefined();
    expect(dateMs('2026-01')).toBeUndefined();
  });
});

describe('seeking', () => {
  it('clamps inside the window and stops at the end', () => {
    expect(seekTo({ ...loaded, playing: true }, 50).currentMs).toBe(100);
    expect(seekTo({ ...loaded, playing: true }, 250).currentMs).toBe(250);
    const past = seekTo({ ...loaded, playing: true }, 400);
    expect(past.currentMs).toBe(300);
    expect(past.playing).toBe(false);
  });

  it('wraps instead of stopping when it loops', () => {
    const wrapped = seekTo({ ...loaded, playing: true, loop: true }, 350);
    expect(wrapped.currentMs).toBe(150);
    expect(wrapped.playing).toBe(true);
  });
});

describe('animation commands through a session', () => {
  it('loads a timeline and takes its window from the events', () => {
    const session = fakeSession(animationCommands);
    expect(session.dispatch('animation.load', { events }).ok).toBe(true);
    const state = session.read(animationSlice);
    expect(state.startMs).toBe(100);
    expect(state.endMs).toBe(300);
    expect(state.currentMs).toBe(100);
    expect(state.playing).toBe(false);
  });

  it('refuses a rate that cannot advance anything', () => {
    const session = fakeSession(animationCommands);
    expect(session.dispatch('animation.load', { events, rate: 0 }).ok).toBe(false);
  });

  it('refuses to play a timeline with nothing on it', () => {
    const session = fakeSession(animationCommands);
    expect(session.dispatch('animation.play', {}).diagnostics.map((item) => item.code)).toEqual(['animation/empty']);
  });

  it('plays again from the front once it has finished', () => {
    const session = fakeSession(animationCommands);
    session.dispatch('animation.load', { events });
    session.dispatch('animation.seek', { timeMs: 999 });
    expect(session.read(animationSlice).currentMs).toBe(300);
    session.dispatch('animation.play', {});
    expect(session.read(animationSlice).currentMs).toBe(100);
    expect(session.read(animationSlice).playing).toBe(true);
  });
});

describe('playback on an injected clock', () => {
  it('schedules nothing while idle, one frame while playing, and nothing again once paused', () => {
    const clock = fakeClock();
    const played = animationFeatureWith(clock);
    const session = fakeSession(played.commands);
    const installed = played.install?.(session);
    expect(clock.pending()).toBe(0);

    session.dispatch('animation.load', { events });
    expect(clock.pending()).toBe(0);

    session.dispatch('animation.play', {});
    expect(clock.pending()).toBe(1);

    clock.advance(50);
    expect(session.read(animationSlice).currentMs).toBeGreaterThan(100);
    expect(clock.pending()).toBe(1);

    session.dispatch('animation.pause', {});
    expect(clock.pending()).toBe(0);
    installed?.dispose();
  });

  it('advances twice as far at twice the rate over the same frames', () => {
    const run = (rate: number): number => {
      const clock = fakeClock();
      const played = animationFeatureWith(clock);
      const session = fakeSession(played.commands);
      const installed = played.install?.(session);
      session.dispatch('animation.load', { events, rate });
      session.dispatch('animation.play', {});
      clock.advance(50);
      const advanced = session.read(animationSlice).currentMs - 100;
      installed?.dispose();
      return advanced;
    };
    const single = run(1);
    expect(single).toBeGreaterThan(0);
    expect(run(2)).toBeCloseTo(single * 2, 9);
  });

  it('stops scheduling once the timeline reaches its end', () => {
    const clock = fakeClock();
    const played = animationFeatureWith(clock);
    const session = fakeSession(played.commands);
    const installed = played.install?.(session);
    session.dispatch('animation.load', { events });
    session.dispatch('animation.play', {});
    clock.advance(1000);
    expect(session.read(animationSlice).currentMs).toBe(300);
    expect(session.read(animationSlice).playing).toBe(false);
    expect(clock.pending()).toBe(0);
    installed?.dispose();
  });

  it('colours by state at every step through a sink', () => {
    const clock = fakeClock();
    const shown: string[][] = [];
    const played = animationFeatureWith(clock, {
      showTimeline: (rules) => void shown.push(rules.map((rule) => rule.id)),
    });
    const session = fakeSession(played.commands);
    const installed = played.install?.(session);
    session.dispatch('animation.load', { events });
    session.dispatch('animation.seek', { timeMs: 300 });
    expect(shown[0]).toEqual([]);
    expect(shown[shown.length - 1]).toEqual(['animation-delivered', 'animation-installed']);
    installed?.dispose();
  });

  it('drops its frame when it is disposed', () => {
    const clock = fakeClock();
    const played = animationFeatureWith(clock);
    const session = fakeSession(played.commands);
    const installed = played.install?.(session);
    session.dispatch('animation.load', { events });
    session.dispatch('animation.play', {});
    expect(clock.pending()).toBe(1);
    installed?.dispose();
    expect(clock.pending()).toBe(0);
  });
});

describe('the feature', () => {
  it('names its commands and drives playback', () => {
    expect(animationFeature.id).toBe('animation');
    expect(animationFeature.commands.map((item) => item.name)).toEqual([
      'animation.load',
      'animation.seek',
      'animation.play',
      'animation.pause',
    ]);
    expect(animationFeature.install).toBeTypeOf('function');
  });
});

// A real viewer session with the feature installed, or a thrown error saying why there is none.
const installed = (item: AnyFeature) => {
  const created = createSession();
  if (!created.ok) throw new Error(created.diagnostics.map((entry) => entry.message).join('; '));
  const host = featureHost(created.value);
  const done = host.install([item]);
  if (!done.ok) throw new Error(done.diagnostics.map((entry) => entry.message).join('; '));
  return { session: created.value, host };
};

describe('through the viewer session', () => {
  it('installs, plays on the injected clock, and stops scheduling when it is disposed', () => {
    const clock = fakeClock();
    const { session: live, host } = installed(animationFeatureWith(clock));
    expect(live.dispatch('animation.load', { events }).ok).toBe(true);
    expect(clock.pending()).toBe(0);
    expect(live.dispatch('animation.play', {}).ok).toBe(true);
    expect(clock.pending()).toBe(1);
    clock.advance(50);
    expect(live.read(animationSlice).currentMs).toBeGreaterThan(100);
    host.dispose();
    expect(clock.pending()).toBe(0);
    expect(live.diagnostics()).toEqual([]);
  });
});
