// Frame timing and scene statistics, as data a HUD reads.
//
// Nothing here draws anything and nothing here reads a clock: `mark` is given the timestamp, so the
// whole thing is tested with a made-up sequence of times. GPU timing is an interface because the
// extension that provides it may not exist; when it does not, the reading says so rather than
// substituting a number from the CPU side, which would be a misleading answer to a different
// question.
//
// The measurements a HUD needs are percentiles, not averages: brief section 8 asks for the median
// and the 95th percentile of frame time against a 33.3 ms budget.

import type { ObjectKey } from '@bim-open-toolkit/model';
import { renderedTriangles, visibleRows, type InstanceTable } from './instance-table.js';
import type { Geometry } from '@bim-open-toolkit/model';

// What a run of durations came to. Times are milliseconds.
export type DurationStats = {
  readonly count: number;
  readonly medianMs: number;
  readonly p95Ms: number;
  readonly minMs: number;
  readonly maxMs: number;
};

// Nothing measured yet.
export const noDurations: DurationStats = { count: 0, medianMs: 0, p95Ms: 0, minMs: 0, maxMs: 0 };

// The percentile of a sorted run, by nearest rank, so the value reported is one that was measured.
export const percentileOf = (sorted: readonly number[], fraction: number): number => {
  if (sorted.length === 0) return 0;
  const rank = Math.ceil(fraction * sorted.length);
  return sorted[Math.min(sorted.length - 1, Math.max(0, rank - 1))] ?? 0;
};

// A fixed-size run of the most recent durations. Old values fall off the end, so a HUD reports what
// is happening now rather than an average over the whole session.
export class DurationLog {
  private readonly values: Float64Array;
  private at = 0;
  private filled = 0;

  constructor(capacity = 240) {
    this.values = new Float64Array(Math.max(1, Math.floor(capacity)));
  }

  // How many durations are held.
  get size(): number {
    return this.filled;
  }

  // How many the log holds before it starts forgetting.
  get capacity(): number {
    return this.values.length;
  }

  // Records one duration. Values that are not finite or are negative are ignored, which is what a
  // stalled timer produces.
  add(milliseconds: number): void {
    if (!Number.isFinite(milliseconds) || milliseconds < 0) return;
    this.values[this.at] = milliseconds;
    this.at = (this.at + 1) % this.values.length;
    if (this.filled < this.values.length) this.filled++;
  }

  // Forgets everything measured.
  reset(): void {
    this.at = 0;
    this.filled = 0;
  }

  // What has been measured.
  stats(): DurationStats {
    if (this.filled === 0) return noDurations;
    const held: number[] = [];
    for (let i = 0; i < this.filled; i++) held.push(this.values[i] ?? 0);
    const sorted = [...held].sort((a, b) => a - b);
    return {
      count: this.filled,
      medianMs: percentileOf(sorted, 0.5),
      p95Ms: percentileOf(sorted, 0.95),
      minMs: sorted[0] ?? 0,
      maxMs: sorted[sorted.length - 1] ?? 0,
    };
  }
}

// Frames per second implied by a frame time, or zero when nothing was measured.
export const framesPerSecond = (milliseconds: number): number =>
  milliseconds > 0 ? 1000 / milliseconds : 0;

// The frame budget for the 30 frames a second the brief asks for.
export const frameBudgetMs = 1000 / 30;

// Intervals between frames, built from timestamps the caller supplies.
export class FrameTimer {
  private readonly log: DurationLog;
  private previous: number | undefined;

  constructor(capacity = 240) {
    this.log = new DurationLog(capacity);
  }

  // Records that a frame was presented at this timestamp, and returns the interval since the last
  // one. The first frame has no interval, so it returns undefined and records nothing.
  mark(nowMs: number): number | undefined {
    if (!Number.isFinite(nowMs)) return undefined;
    const last = this.previous;
    this.previous = nowMs;
    if (last === undefined) return undefined;
    const interval = nowMs - last;
    if (interval < 0) return undefined;
    this.log.add(interval);
    return interval;
  }

  // Drops the intervals and the last timestamp, which is what a resize or a model change calls for.
  reset(): void {
    this.log.reset();
    this.previous = undefined;
  }

  // How many intervals are held.
  get size(): number {
    return this.log.size;
  }

  // The intervals measured so far.
  stats(): DurationStats {
    return this.log.stats();
  }
}

// Whether GPU timing can be had at all, and why not when it cannot.
export type GpuAvailability =
  | { readonly state: 'available' }
  | { readonly state: 'unavailable'; readonly reason: string };

// GPU timing is not available, and here is why. A HUD shows the reason rather than a zero.
export const gpuUnavailable = (reason: string): GpuAvailability => ({ state: 'unavailable', reason });

// The seam a renderer implements when the timing extension exists. `poll` returns a completed
// measurement in milliseconds, or undefined while none has finished; results arrive some frames
// after the work they describe, which is why it is polled rather than returned from `end`.
export type GpuFrameTimer = {
  readonly availability: GpuAvailability;
  readonly begin: () => void;
  readonly end: () => void;
  readonly poll: () => number | undefined;
};

// A timer for a renderer with no timing extension. Every reading is unavailable.
export const noGpuTimer = (reason = 'the GPU timing extension is not present'): GpuFrameTimer => ({
  availability: gpuUnavailable(reason),
  begin: () => undefined,
  end: () => undefined,
  poll: () => undefined,
});

// What GPU timing came to, or the reason there is none.
export type GpuReading =
  | { readonly state: 'available'; readonly stats: DurationStats }
  | { readonly state: 'unavailable'; readonly reason: string };

// Drains everything a GPU timer has finished measuring into a log, and reports it.
export const readGpuTimer = (timer: GpuFrameTimer, log: DurationLog): GpuReading => {
  if (timer.availability.state === 'unavailable')
    return { state: 'unavailable', reason: timer.availability.reason };
  for (let drained = timer.poll(); drained !== undefined; drained = timer.poll()) log.add(drained);
  return { state: 'available', stats: log.stats() };
};

// What is in the scene, counted the three ways the brief distinguishes.
export type SceneStatistics = {
  // Objects the model addresses, including any with no geometry.
  readonly sourceObjects: number;
  // Instanced groups, which is roughly the draw call count before batching.
  readonly groups: number;
  // Rendered instances, which is one per row of the instance table.
  readonly renderedInstances: number;
  // Rendered instances that are currently shown.
  readonly visibleInstances: number;
  // Triangles summed over instances: what the scene actually draws.
  readonly renderedTriangles: number;
};

// Counts the scene. Visible instances and triangles are counted, not cached, because keeping a
// running total would make every bulk update pay for a number most frames never read.
export const sceneStatistics = (table: InstanceTable, geometry: Geometry): SceneStatistics => ({
  sourceObjects: table.keys.length,
  groups: table.groups.length,
  renderedInstances: table.rowCount,
  visibleInstances: visibleRows(table),
  renderedTriangles: renderedTriangles(table, geometry),
});

// Which camera is drawing, which a HUD reports alongside the timings.
export type CameraKind = 'perspective' | 'orthographic';

// Everything a HUD shows. Plain data: a HUD reads it, it never reads a HUD.
export type HudData = {
  readonly frames: DurationStats;
  readonly framesPerSecond: number;
  readonly withinBudget: boolean;
  readonly gpu: GpuReading;
  readonly scene: SceneStatistics;
  readonly camera: CameraKind;
  // The object under the pointer, or undefined when nothing is.
  readonly pointedAt?: ObjectKey | undefined;
};

// Assembles a HUD reading. `withinBudget` compares the 95th percentile frame time with the 30
// frames a second target, so an occasional long frame is visible rather than averaged away.
export const hudData = (
  frames: DurationStats,
  gpu: GpuReading,
  scene: SceneStatistics,
  camera: CameraKind,
  pointedAt?: ObjectKey,
): HudData => ({
  frames,
  framesPerSecond: framesPerSecond(frames.medianMs),
  withinBudget: frames.count > 0 && frames.p95Ms <= frameBudgetMs,
  gpu,
  scene,
  camera,
  ...(pointedAt === undefined ? {} : { pointedAt }),
});
