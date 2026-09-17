import type { Vec3 } from './contracts.js';

/** Seconds throughout. Host timestamps must be finite and monotonic. */
export type PlaybackState = {
  readonly duration: number;
  readonly time: number;
  readonly rate: number;
  readonly playing: boolean;
  readonly loop: boolean;
  readonly timestamp: number;
};

export function createPlayback(duration: number, options: { readonly loop?: boolean; readonly rate?: number; readonly timestamp?: number } = {}): PlaybackState {
  const { loop = false, rate = 1, timestamp = 0 } = options;
  if (!Number.isFinite(duration) || duration <= 0 || !Number.isFinite(rate) || rate <= 0 || !Number.isFinite(timestamp))
    throw new Error('Playback requires a positive finite duration/rate and finite timestamp');
  return { duration, time: 0, rate, playing: false, loop, timestamp };
}

export function advancePlayback(state: PlaybackState, timestamp: number): PlaybackState {
  if (!Number.isFinite(timestamp) || timestamp < state.timestamp) throw new Error('Playback timestamp must be finite and monotonic');
  const elapsed = state.playing ? (timestamp - state.timestamp) * state.rate : 0;
  const raw = state.time + elapsed;
  const time = state.loop && state.playing ? raw % state.duration : Math.min(state.duration, raw);
  return { ...state, time, timestamp, playing: state.playing && (state.loop || time < state.duration) };
}

export function playPlayback(state: PlaybackState, timestamp: number): PlaybackState {
  const current = advancePlayback(state, timestamp);
  return { ...current, time: current.time === current.duration ? 0 : current.time, playing: true };
}

export function pausePlayback(state: PlaybackState, timestamp: number): PlaybackState {
  return { ...advancePlayback(state, timestamp), playing: false };
}

export function seekPlayback(state: PlaybackState, time: number, timestamp: number): PlaybackState {
  if (!Number.isFinite(time)) throw new Error('Seek time must be finite');
  const current = advancePlayback(state, timestamp);
  const clamped = Math.max(0, Math.min(state.duration, time));
  return { ...current, time: clamped, playing: state.playing && (state.loop || clamped < state.duration) };
}

export function setPlaybackRate(state: PlaybackState, rate: number, timestamp: number): PlaybackState {
  if (!Number.isFinite(rate) || rate <= 0) throw new Error('Playback rate must be finite and positive');
  return { ...advancePlayback(state, timestamp), rate };
}

export function resetPlayback(state: PlaybackState, timestamp: number): PlaybackState {
  return { ...advancePlayback(state, timestamp), time: 0, playing: false };
}

/** Horizontal circle, starting at zero displacement; independent of playback history. */
export function sampleCircularTranslation(time: number, options: { readonly period: number; readonly radius: number }): Vec3 {
  if (!Number.isFinite(time) || !Number.isFinite(options.period) || options.period <= 0 || !Number.isFinite(options.radius) || options.radius < 0)
    throw new Error('Circle requires finite time, positive period and nonnegative radius');
  const angle = (time % options.period) / options.period * 2 * Math.PI;
  return [options.radius * (Math.cos(angle) - 1), 0, options.radius * Math.sin(angle)];
}
