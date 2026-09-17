// The heads-up display: what is in the scene, how fast it is drawing, and which storey the camera
// is on.
//
// The slice is read-only to commands except for `hud.toggle`: the reading itself is written by the
// render hook, which is the only thing that knows when a frame happened. It is written at a bounded
// rate, so a HUD costs one small object every `intervalMs` rather than one per frame.
//
// Nothing is invented. Counts come from render's `sceneStatistics` over the instance table, frame
// times from a `FrameTimer` the host marks, and GPU time from render's timer seam, which reports
// why it is unavailable rather than substituting a CPU number.

import {
  boolean,
  command,
  diagnostic,
  disposable,
  enumeration,
  failure,
  feature,
  literal,
  number,
  object,
  optional,
  stateSlice,
  string,
  success,
  union,
  type Command,
  type Disposable,
  type Feature,
  type Geometry,
  type Migration,
  type Schema,
  type Session,
  type StateSlice,
} from '@bim-open-toolkit/model';
import {
  DurationLog,
  hudData,
  readGpuTimer,
  sceneStatistics,
  type CameraKind,
  type DurationStats,
  type GpuFrameTimer,
  type GpuReading,
  type HudData,
  type InstanceTable,
  type SceneStatistics,
} from '@bim-open-toolkit/render';
import { navigationSlice } from './navigation-aids.js';

// One sample: render's own HUD data, when it was taken, and the storey the camera was sent to.
export type HudReading = {
  readonly at: number;
  readonly data: HudData;
  readonly level?: string | undefined;
};

// Whether the HUD is shown, how often it samples, and the last sample taken.
export type HudState = {
  readonly visible: boolean;
  readonly intervalMs: number;
  readonly reading?: HudReading | undefined;
};

// What the hook reads a sample from: the rows, the geometry behind them, the frame timer the host
// marks each frame, an optional GPU timer, and which camera is drawing.
export type HudSource = {
  readonly table: InstanceTable;
  readonly geometry: Geometry;
  readonly frames: { readonly stats: () => DurationStats; readonly mark: (nowMs: number) => number | undefined };
  readonly gpu?: GpuFrameTimer | undefined;
  readonly camera: () => CameraKind;
};

// A hook that also takes a frame mark. `sample` reports whether it wrote a reading this time.
export type HudSampler = Disposable & { readonly sample: (nowMs: number) => boolean };

const durationStatsSchema: Schema<DurationStats> = object({
  count: number(),
  medianMs: number(),
  p95Ms: number(),
  minMs: number(),
  maxMs: number(),
});

const gpuReadingSchema = union<GpuReading>(
  object({ state: literal('available'), stats: durationStatsSchema }),
  object({ state: literal('unavailable'), reason: string() }),
);

const sceneStatisticsSchema: Schema<SceneStatistics> = object({
  sourceObjects: number(),
  groups: number(),
  renderedInstances: number(),
  visibleInstances: number(),
  renderedTriangles: number(),
});

const hudDataSchema: Schema<HudData> = object({
  frames: durationStatsSchema,
  framesPerSecond: number(),
  withinBudget: boolean(),
  gpu: gpuReadingSchema,
  scene: sceneStatisticsSchema,
  camera: enumeration<CameraKind>(['perspective', 'orthographic']),
  pointedAt: optional(string()),
});

const readingSchema: Schema<HudReading> = object({
  at: number(),
  data: hudDataSchema,
  level: optional(string()),
});

// The shape of the HUD slice.
export const hudSchema: Schema<HudState> = object({
  visible: boolean(),
  intervalMs: number(),
  reading: optional(readingSchema),
});

// How often a reading is written when the HUD is shown, which is four times a second.
export const defaultHudIntervalMs = 250;

// The HUD hidden, sampling four times a second once it is shown, with nothing measured yet.
export const defaultHud: HudState = { visible: false, intervalMs: defaultHudIntervalMs };

// Steps that read a HUD slice written at an older version. Version 1 has no history yet.
export const hudMigrations: readonly Migration[] = [];

// The HUD slice: shown or hidden, the sampling rate, and the last reading the hook wrote.
export const hudSlice: StateSlice<HudState> = stateSlice('hud', 1, hudSchema, defaultHud, hudMigrations);

// Shows or hides the HUD, and sets how often it samples. With no arguments it flips the display.
const toggle = command({
  name: 'hud.toggle',
  title: 'Toggle the HUD',
  description: 'Show or hide the heads-up display, and set how often it samples.',
  input: object({ visible: optional(boolean()), intervalMs: optional(number()) }),
  run: (session: Session, input) => {
    const state = session.read(hudSlice);
    const interval = input.intervalMs ?? state.intervalMs;
    if (!(interval >= 0))
      return failure([diagnostic('hud/interval', 'The sampling interval cannot be negative.', ['intervalMs'])]);
    const next: HudState = { ...state, visible: input.visible ?? !state.visible, intervalMs: interval };
    session.write(hudSlice, next);
    return success(next);
  },
});

// The command that shows, hides and paces the HUD.
export const hudCommands: readonly Command[] = [toggle];

// True when a reading taken at `at` is old enough to be replaced.
export const isDue = (state: HudState, nowMs: number): boolean => {
  const last = state.reading?.at;
  return last === undefined || !(nowMs - last < state.intervalMs);
};

// A sampler over a live session: marks every frame, and writes a reading into the slice no more
// often than the interval asks for, and only while the HUD is shown. Marking a frame is always
// cheap; assembling a reading counts the instance table, which is why it is paced.
export const hudSampler = (session: Session, source: HudSource): HudSampler => {
  const gpuLog = new DurationLog();
  const sample = (nowMs: number): boolean => {
    source.frames.mark(nowMs);
    const state = session.read(hudSlice);
    if (!state.visible || !isDue(state, nowMs)) return false;
    const gpu: GpuReading =
      source.gpu === undefined
        ? { state: 'unavailable', reason: 'no GPU timer was supplied' }
        : readGpuTimer(source.gpu, gpuLog);
    const data = hudData(
      source.frames.stats(),
      gpu,
      sceneStatistics(source.table, source.geometry),
      source.camera(),
    );
    const level = session.read(navigationSlice).level?.name;
    const reading: HudReading = level === undefined ? { at: nowMs, data } : { at: nowMs, data, level };
    session.write(hudSlice, { ...state, reading });
    return true;
  };
  const stop = disposable(() => gpuLog.reset());
  return { sample, dispose: () => stop.dispose() };
};

// The HUD's render hook: a sampler the host calls once a frame.
export const hudHook =
  (source: HudSource) =>
  (session: Session): HudSampler =>
    hudSampler(session, source);

// Counts, frame timing, GPU timing and the level indicator, updated by the hook and shown by a UI.
// It depends on navigation aids because the level indicator is the storey that feature navigated to.
export const hudFeature: Feature<HudState> = feature('hud', hudSlice, hudCommands, ['navigation-aids']);
