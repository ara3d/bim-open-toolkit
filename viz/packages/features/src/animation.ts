// Animation: a timeline of state changes per object, and playback over it.
//
// The timeline is events, not keyframes: an object is delivered, then accepted, then installed, and
// each of those happened at a time somebody recorded. Its state at any moment is therefore read
// from the events rather than stored, so seeking anywhere is the same operation as playing, and no
// interpolation invents a state nobody observed. An object with no event is pending, which is not
// the same as "not delivered" and is why `pending` is a state of its own.
//
// Playback is driven by an injected clock. Nothing schedules a frame while the timeline is paused
// or finished: an idle viewer costs nothing, and a test winds the clock by hand instead of waiting.

import {
  array,
  boolean,
  command,
  diagnostic,
  disposable,
  enumeration,
  failure,
  feature,
  note,
  number,
  object,
  onSlices,
  optional,
  refine,
  stateSlice,
  string,
  styleRule,
  success,
  type Color,
  type Command,
  type Disposable,
  type Feature,
  type Migration,
  type ObjectKey,
  type Result,
  type Schema,
  type Session,
  type StateSlice,
  type StyleRule,
} from '@bim-open-toolkit/model';

// The states an object passes through, in the order they rank. `pending` is what an object with no
// recorded event is in; it is an absence of evidence, not a delivery that failed.
export const timelineStates = ['pending', 'delivered', 'accepted', 'installed'] as const;

// One of the four states.
export type TimelineState = (typeof timelineStates)[number];

// How far along a state is, so two events at the same instant order the way the process does.
export const stateRank = (state: TimelineState): number => timelineStates.indexOf(state);

// One recorded change: an object reached a state at a time.
export type TimelineEvent = {
  readonly objectKey: ObjectKey;
  readonly state: TimelineState;
  readonly timeMs: number;
};

// The timeline, where playback is now, and how it runs.
export type AnimationState = {
  readonly events: readonly TimelineEvent[];
  readonly startMs: number;
  readonly endMs: number;
  readonly currentMs: number;
  readonly playing: boolean;
  readonly rate: number;
  readonly loop: boolean;
};

// One recorded change.
export const timelineEventSchema: Schema<TimelineEvent> = object({
  objectKey: string(),
  state: enumeration(timelineStates),
  timeMs: number(),
});

// The whole slice, refusing a window that ends before it starts and a rate that cannot advance it.
export const animationSchema: Schema<AnimationState> = refine(
  object({
    events: array(timelineEventSchema),
    startMs: number(),
    endMs: number(),
    currentMs: number(),
    playing: boolean(),
    rate: number(),
    loop: boolean(),
  }),
  (value) => value.endMs >= value.startMs && value.rate > 0,
  'animation/window',
  'A timeline ends at or after it starts, and its rate is more than zero.',
);

// An empty timeline, paused at time zero.
export const noAnimation: AnimationState = {
  events: [],
  startMs: 0,
  endMs: 0,
  currentMs: 0,
  playing: false,
  rate: 1,
  loop: false,
};

// Version 1 has no earlier versions to read; a later version adds its step here.
export const animationMigrations: readonly Migration[] = [];

// The slice the animation feature owns.
export const animationSlice: StateSlice<AnimationState> = stateSlice(
  'animation',
  1,
  animationSchema,
  noAnimation,
  animationMigrations,
);

// The events in time order, ranked within one instant, which is the order a state is read in.
export const orderedEvents = (events: readonly TimelineEvent[]): readonly TimelineEvent[] =>
  [...events].sort((a, b) => a.timeMs - b.timeMs || stateRank(a.state) - stateRank(b.state));

// The window the events cover, or a zero-length window at zero when there are none.
export const eventWindow = (
  events: readonly TimelineEvent[],
): { readonly startMs: number; readonly endMs: number } => {
  const times = events.map((item) => item.timeMs);
  return times.length === 0
    ? { startMs: 0, endMs: 0 }
    : { startMs: Math.min(...times), endMs: Math.max(...times) };
};

// The state one object is in at a time: the furthest state it had reached by then.
export const stateAt = (
  events: readonly TimelineEvent[],
  key: ObjectKey,
  timeMs: number,
): TimelineState =>
  events.reduce<TimelineState>(
    (best, item) =>
      item.objectKey === key && item.timeMs <= timeMs && stateRank(item.state) > stateRank(best)
        ? item.state
        : best,
    'pending',
  );

// The state of every object the timeline mentions, at a time. An object absent from the map is
// pending, which is why the map is not padded with them.
export const statesAt = (
  events: readonly TimelineEvent[],
  timeMs: number,
): ReadonlyMap<ObjectKey, TimelineState> => {
  const states = new Map<ObjectKey, TimelineState>();
  for (const item of events) {
    if (item.timeMs > timeMs) continue;
    const held = states.get(item.objectKey) ?? 'pending';
    if (stateRank(item.state) > stateRank(held)) states.set(item.objectKey, item.state);
  }
  return states;
};

// The colour of each state. A display convention, not domain meaning.
export const timelineColors: Readonly<Record<TimelineState, Color>> = {
  pending: [0.62, 0.62, 0.62],
  delivered: [0.25, 0.5, 0.85],
  accepted: [0.98, 0.7, 0.1],
  installed: [0.2, 0.65, 0.32],
};

// One style rule per state that any object is in at the time, in state order so a later state wins.
// Pending objects get no rule: they keep whatever the scene already gives them.
export const animationRules = (state: AnimationState, timeMs: number): readonly StyleRule[] => {
  const states = statesAt(state.events, timeMs);
  return timelineStates
    .filter((name) => name !== 'pending')
    .flatMap((name) => {
      const targets = [...states.entries()].flatMap(([key, held]) => (held === name ? [key] : []));
      return targets.length === 0
        ? []
        : [styleRule(`animation-${name}`, `Timeline: ${name}`, targets, { color: timelineColors[name] }, stateRank(name))];
    });
};

// The rules for where playback is now.
export const currentRules = (state: AnimationState): readonly StyleRule[] => animationRules(state, state.currentMs);

// The milliseconds a `YYYY-MM-DD` date names, or undefined when it is not one.
export const dateMs = (date: string): number | undefined => {
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(date) ? Date.parse(`${date}T00:00:00Z`) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : undefined;
};

// One row of a schedule as it is read from a table: a date somebody may not have written down.
export type DatedStateChange = {
  readonly objectKey: ObjectKey;
  readonly state: TimelineState;
  readonly date: string;
};

// The events a dated schedule describes. A row with no usable date is left out and reported: the
// event happened, but an undated event cannot be placed on a timeline and guessing one would be a
// fabrication. `pending` rows are dropped the same way; nothing reaches pending, it starts there.
export const timelineFromDates = (rows: readonly DatedStateChange[]): Result<readonly TimelineEvent[]> => {
  const events: TimelineEvent[] = [];
  const undated: string[] = [];
  for (const row of rows) {
    const at = dateMs(row.date);
    if (row.state === 'pending') continue;
    if (at === undefined) {
      undated.push(row.objectKey);
      continue;
    }
    events.push({ objectKey: row.objectKey, state: row.state, timeMs: at });
  }
  return success(
    orderedEvents(events),
    undated.length === 0
      ? []
      : [note('animation/undated', `${undated.length} recorded events have no usable date and are not on the timeline.`)],
  );
};

// The state with playback moved to a time: clamped inside the window, wrapped when it loops, and
// stopped at the end when it does not. A timeline of no length never plays.
export const seekTo = (state: AnimationState, timeMs: number): AnimationState => {
  const span = state.endMs - state.startMs;
  if (span <= 0) return { ...state, currentMs: state.startMs, playing: false };
  if (!Number.isFinite(timeMs) || timeMs <= state.startMs) return { ...state, currentMs: state.startMs };
  if (timeMs <= state.endMs) return { ...state, currentMs: timeMs };
  return state.loop
    ? { ...state, currentMs: state.startMs + ((timeMs - state.startMs) % span) }
    : { ...state, currentMs: state.endMs, playing: false };
};

// Loads a timeline. The window defaults to what the events cover, and playback starts at its front.
const loadCommand: Command = command({
  name: 'animation.load',
  title: 'Load timeline',
  description: 'Replaces the timeline with the given events and moves playback to its start.',
  input: object({
    events: array(timelineEventSchema),
    startMs: optional(number()),
    endMs: optional(number()),
    rate: optional(number()),
    loop: optional(boolean()),
  }),
  run: (session: Session, input) => {
    const events = orderedEvents(input.events);
    const window = eventWindow(events);
    const startMs = input.startMs ?? window.startMs;
    const endMs = input.endMs ?? window.endMs;
    const rate = input.rate ?? 1;
    if (endMs < startMs)
      return failure([diagnostic('animation/window', `A timeline cannot end at ${endMs} and start at ${startMs}.`)]);
    if (!(rate > 0)) return failure([diagnostic('animation/rate', `A playback rate must be more than zero, not ${rate}.`)]);
    const state: AnimationState = {
      events,
      startMs,
      endMs,
      currentMs: startMs,
      playing: false,
      rate,
      loop: input.loop ?? false,
    };
    session.write(animationSlice, state);
    return success(state);
  },
});

// Moves playback to a time.
const seekCommand: Command = command({
  name: 'animation.seek',
  title: 'Seek timeline',
  description: 'Moves the current time, clamped to the timeline or wrapped when it loops.',
  input: object({ timeMs: number() }),
  run: (session: Session, input) => {
    const next = seekTo(session.read(animationSlice), input.timeMs);
    session.write(animationSlice, next);
    return success(next);
  },
});

// Starts playing, from the front again when the timeline had already finished.
const playCommand: Command = command({
  name: 'animation.play',
  title: 'Play timeline',
  description: 'Starts playback, optionally at a new rate.',
  input: object({ rate: optional(number()) }),
  run: (session: Session, input) => {
    const state = session.read(animationSlice);
    const rate = input.rate ?? state.rate;
    if (state.endMs <= state.startMs)
      return failure([diagnostic('animation/empty', 'There is no timeline to play.')]);
    if (!(rate > 0)) return failure([diagnostic('animation/rate', `A playback rate must be more than zero, not ${rate}.`)]);
    const restart = !state.loop && state.currentMs >= state.endMs;
    const next: AnimationState = {
      ...state,
      rate,
      playing: true,
      currentMs: restart ? state.startMs : state.currentMs,
    };
    session.write(animationSlice, next);
    return success(next);
  },
});

// Stops playing, leaving the current time where it is.
const pauseCommand: Command = command({
  name: 'animation.pause',
  title: 'Pause timeline',
  description: 'Stops playback without moving the current time.',
  input: object({}),
  run: (session: Session) => {
    const state = session.read(animationSlice);
    const next: AnimationState = { ...state, playing: false };
    session.write(animationSlice, next);
    return success(next);
  },
});

// The commands the animation feature registers, in the order a registry lists them.
export const animationCommands: readonly Command[] = [loadCommand, seekCommand, playCommand, pauseCommand];

// The time source playback runs on: what time it is, and a one-shot request for the next frame.
// It is the shape testing's `FakeClock` already has, so a test drives playback without waiting.
export type AnimationClock = {
  readonly now: () => number;
  readonly frames: (run: (timeMs: number) => void) => () => void;
};

// The real clock: wall time, and a frame roughly sixty times a second.
export const systemAnimationClock: AnimationClock = {
  now: () => Date.now(),
  frames: (run) => {
    const handle = setTimeout(() => run(Date.now()), 1000 / 60);
    return () => clearTimeout(handle);
  },
};

// What a renderer is handed at each step: the rules that colour by state, and the time they are for.
export type TimelineSink = {
  readonly showTimeline: (rules: readonly StyleRule[], timeMs: number) => void;
};

// Playback: one frame at a time while playing, nothing at all while paused.
//
// Every frame dispatches `animation.seek`, so what playback does is exactly what a user dragging
// the time slider does, and the timeline has one way to move rather than two.
const playback = (clock: AnimationClock, sink?: TimelineSink) => (session: Session): Disposable => {
  let cancel: (() => void) | undefined;
  let lastMs = clock.now();
  const stop = (): void => {
    if (cancel === undefined) return;
    cancel();
    cancel = undefined;
  };
  const tick = (nowMs: number): void => {
    cancel = undefined;
    const state = session.read(animationSlice);
    if (!state.playing) return;
    const elapsed = Math.max(0, nowMs - lastMs) * state.rate;
    session.dispatch(seekCommand.name, { timeMs: state.currentMs + elapsed });
    schedule();
  };
  function schedule(): void {
    const state = session.read(animationSlice);
    if (!state.playing) {
      stop();
      return;
    }
    if (cancel !== undefined) return;
    lastMs = clock.now();
    cancel = clock.frames(tick);
  }
  const show = (): void => {
    if (sink === undefined) return;
    const state = session.read(animationSlice);
    sink.showTimeline(currentRules(state), state.currentMs);
  };
  show();
  schedule();
  const stopListening = session.subscribe(
    onSlices([animationSlice.id], () => {
      show();
      schedule();
    }),
  );
  return disposable(() => {
    stop();
    stopListening.dispose();
  });
};

// A timeline over object states, played on the real clock.
export const animationFeature: Feature<AnimationState> = feature(
  'animation',
  animationSlice,
  animationCommands,
  [],
  playback(systemAnimationClock),
);

// A timeline played on a given clock, colouring by state through a sink when there is one.
export const animationFeatureWith = (clock: AnimationClock, sink?: TimelineSink): Feature<AnimationState> =>
  feature('animation', animationSlice, animationCommands, [], playback(clock, sink));
