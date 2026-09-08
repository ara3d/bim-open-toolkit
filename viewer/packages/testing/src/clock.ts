// A clock a test winds by hand, so an animation test has no timers, no frames and no waiting.
//
// Anything that moves over time — a camera flight, a progress report, a debounced command — needs
// a time source and a way to be told a frame happened. Given the real ones, a test either sleeps
// (slow and flaky) or reaches inside the thing it is testing. Given this one, it advances time by
// an exact number of milliseconds and asserts on what ran.
//
// `frames` matches the shape the interact package's `FrameScheduler` requires, so
// `attachNavigation` and anything else that draws on animation frames can be driven from here
// without this package depending on that one.

// What a scheduled callback is told: the clock's time when it runs, in milliseconds.
export type ScheduledCallback = (timeMs: number) => void;

// Undoes a scheduling call. Calling it after the callback ran, or twice, does nothing.
export type Cancel = () => void;

// A one-shot request for the next frame, which is the shape interact's `FrameScheduler` has.
export type FrameRequest = (run: ScheduledCallback) => Cancel;

// A clock under the test's control.
export type FakeClock = {
  // The time now, in milliseconds since the clock started.
  readonly now: () => number;
  // Moves time forward, running everything that comes due in time order. Returns how many
  // callbacks ran. A negative or non-finite step is rejected: time only goes forward.
  readonly advance: (deltaMs: number) => number;
  // Moves time forward to an absolute time. Going backwards is rejected.
  readonly advanceTo: (timeMs: number) => number;
  // Runs everything still scheduled, however far ahead, moving time to the last one. Returns how
  // many ran. Use it to finish an animation without knowing its duration. A loop that always asks
  // for another frame never finishes, so this throws once past `maxCallbacksPerAdvance`.
  readonly runPending: () => number;
  // Schedules a callback for an absolute time. A time already past runs at the next advance.
  readonly at: (timeMs: number, run: ScheduledCallback) => Cancel;
  // Schedules a callback a delay from now.
  readonly after: (delayMs: number, run: ScheduledCallback) => Cancel;
  // Requests the next frame: a callback one frame interval from now. Re-requesting from inside a
  // frame callback is how an animation loop runs, and terminates because each frame is later.
  readonly frames: FrameRequest;
  // How many callbacks are still scheduled.
  readonly pending: () => number;
  // When the next callback is due, or undefined when nothing is scheduled.
  readonly nextDueMs: () => number | undefined;
};

// How the clock behaves where a test has not said.
export type ClockOptions = {
  readonly startMs: number;
  // Milliseconds between frames, sixty a second by default.
  readonly frameIntervalMs: number;
  // A single advance running more callbacks than this throws instead of hanging the test, which is
  // what a callback rescheduling itself at no delay would otherwise do.
  readonly maxCallbacksPerAdvance: number;
};

// Sixty frames a second, from a clock that starts at zero, with a runaway guard.
export const defaultClockOptions: ClockOptions = {
  startMs: 0,
  frameIntervalMs: 1000 / 60,
  maxCallbacksPerAdvance: 100_000,
};

// One thing waiting to run. `sequence` breaks ties so callbacks due at the same time run in the
// order they were scheduled.
type Entry = {
  readonly dueMs: number;
  readonly sequence: number;
  readonly run: ScheduledCallback;
};

// Rejects a step that is not a number of milliseconds forward.
const checkForward = (label: string, value: number): void => {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label} must be a finite number of at least 0, got ${value}`);
};

// A clock nobody advances but the test.
export function fakeClock(options: Partial<ClockOptions> = {}): FakeClock {
  const settings: ClockOptions = { ...defaultClockOptions, ...options };
  if (!(settings.frameIntervalMs > 0)) throw new Error(`frameIntervalMs must be more than 0, got ${settings.frameIntervalMs}`);
  let current = settings.startMs;
  let sequence = 0;
  let entries: Entry[] = [];

  const schedule = (dueMs: number, run: ScheduledCallback): Cancel => {
    const entry: Entry = { dueMs, sequence: (sequence += 1), run };
    entries.push(entry);
    return () => {
      entries = entries.filter((candidate) => candidate !== entry);
    };
  };

  // The earliest entry, or undefined when nothing is scheduled.
  const earliest = (): Entry | undefined =>
    entries.reduce<Entry | undefined>(
      (best, entry) =>
        best === undefined || entry.dueMs < best.dueMs || (entry.dueMs === best.dueMs && entry.sequence < best.sequence)
          ? entry
          : best,
      undefined,
    );

  // Runs everything due at or before `limitMs`, moving the clock to each callback's own time.
  // Entries scheduled by a callback are picked up by the same loop when they are due in range.
  const drain = (limitMs: number): number => {
    let ran = 0;
    for (;;) {
      const next = earliest();
      if (next === undefined || next.dueMs > limitMs) return ran;
      entries = entries.filter((candidate) => candidate !== next);
      current = Math.max(current, next.dueMs);
      next.run(current);
      ran += 1;
      if (ran > settings.maxCallbacksPerAdvance) {
        throw new Error(`more than ${settings.maxCallbacksPerAdvance} callbacks in one advance: something reschedules itself without delay`);
      }
    }
  };

  const advanceTo = (timeMs: number): number => {
    if (!Number.isFinite(timeMs) || timeMs < current) {
      throw new Error(`advanceTo ${timeMs} would move the clock back from ${current}`);
    }
    const ran = drain(timeMs);
    current = timeMs;
    return ran;
  };

  return {
    now: () => current,
    advance: (deltaMs) => {
      checkForward('advance', deltaMs);
      return advanceTo(current + deltaMs);
    },
    advanceTo,
    runPending: () => {
      let ran = 0;
      for (;;) {
        const next = earliest();
        if (next === undefined) return ran;
        ran += advanceTo(Math.max(next.dueMs, current));
        if (ran > settings.maxCallbacksPerAdvance) {
          throw new Error(`more than ${settings.maxCallbacksPerAdvance} callbacks while running pending work: something reschedules itself for ever`);
        }
      }
    },
    at: (timeMs, run) => schedule(timeMs, run),
    after: (delayMs, run) => {
      checkForward('after', delayMs);
      return schedule(current + delayMs, run);
    },
    frames: (run) => schedule(current + settings.frameIntervalMs, run),
    pending: () => entries.length,
    nextDueMs: () => earliest()?.dueMs,
  };
}
