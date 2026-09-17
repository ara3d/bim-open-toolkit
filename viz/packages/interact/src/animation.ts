import {
  normalizeVec3,
  scaleVec3,
  subVec3,
  viewDirection,
  viewDistance,
  type CameraPose,
  type Projection,
  type Vec3,
  type ViewState,
} from '@bim-open-toolkit/model';
import { isDragging, type InputFrame } from './input.js';
import { clamp, finite } from './numbers.js';
import { lerpVec3, unitSlerp } from './vec.js';

// A curve shaping how an animation runs: it maps progress from 0 to 1 onto eased progress.
export type Ease = (t: number) => number;

// The curves an animation can be asked for by name, so a saved animation stays plain data.
export type EaseName = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut';

// The named curves. All of them map 0 to 0 and 1 to 1 and stay inside that range in between.
export const easings: Readonly<Record<EaseName, Ease>> = {
  linear: (t) => t,
  easeIn: (t) => t * t,
  easeOut: (t) => t * (2 - t),
  easeInOut: (t) => (t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) * (1 - t)),
};

// A camera flight from one view to another, as plain data that a clock steps.
// Nothing here runs on its own: a caller advances it and reads the view it is at.
export type CameraFlight = {
  readonly from: ViewState;
  readonly to: ViewState;
  readonly durationMs: number;
  readonly elapsedMs: number;
  readonly ease: EaseName;
};

// How long a flight lasts when the caller does not say.
export const defaultFlightMs = 600;

// A flight between two views. A duration of zero or less means the flight is over before it starts,
// which is how a caller asks to jump straight there without a special case.
export const flyTo = (
  from: ViewState,
  to: ViewState,
  durationMs: number = defaultFlightMs,
  ease: EaseName = 'easeInOut',
): CameraFlight => ({ from, to, durationMs: Math.max(finite(durationMs), 0), elapsedMs: 0, ease });

// How far through the flight the clock is, from 0 to 1, before easing.
export const flightFraction = (flight: CameraFlight): number =>
  flight.durationMs <= 0 ? 1 : clamp(flight.elapsedMs / flight.durationMs, 0, 1);

// True once the flight has run its full time; its view is then exactly the view it flew to.
export const isFlightDone = (flight: CameraFlight): boolean => flightFraction(flight) >= 1;

// The flight after that many milliseconds passed. Time never runs backwards and never overshoots
// the duration, so stepping a finished flight again changes nothing.
export const advanceFlight = (flight: CameraFlight, dtMs: number): CameraFlight => ({
  ...flight,
  elapsedMs: Math.min(flight.elapsedMs + Math.max(finite(dtMs), 0), flight.durationMs),
});

// The number a fraction of the way from one to the other.
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

// A ratio-preserving step from one positive number to another, so halving the distance takes the
// same time as halving it again. Values at or below zero fall back to an even step.
const geometric = (a: number, b: number, t: number): number =>
  a > 0 && b > 0 ? a * Math.pow(b / a, t) : lerp(a, b, t);

// The camera a fraction of the way between two poses: the target moves evenly, the view direction
// turns along the shorter arc, and the distance changes by ratio, which is what makes a flight
// that zooms a long way look steady rather than rushing at the end.
export const blendPose = (from: CameraPose, to: CameraPose, t: number): CameraPose => {
  const target = lerpVec3(from.target, to.target, t);
  const fallback: Vec3 = [0, 0, -1];
  const forward = unitSlerp(
    normalizeVec3(viewDirection(from)) ?? normalizeVec3(viewDirection(to)) ?? fallback,
    normalizeVec3(viewDirection(to)) ?? normalizeVec3(viewDirection(from)) ?? fallback,
    t,
  );
  const distance = geometric(viewDistance(from), viewDistance(to), t);
  return {
    position: subVec3(target, scaleVec3(forward, distance)),
    target,
    up: unitSlerp(from.up, to.up, t),
  };
};

// The projection a fraction of the way between two. Two of the same kind blend their numbers;
// two different kinds cannot be blended, so the destination applies from the start and the
// framing is left to `setProjectionKind`, which is what preserves the picture across a switch.
export const blendProjection = (from: Projection, to: Projection, t: number): Projection => {
  const near = lerp(from.near, to.near, t);
  const far = lerp(from.far, to.far, t);
  if (from.kind === 'perspective' && to.kind === 'perspective') {
    return {
      kind: 'perspective',
      fieldOfViewDegrees: lerp(from.fieldOfViewDegrees, to.fieldOfViewDegrees, t),
      near,
      far,
    };
  }
  if (from.kind === 'orthographic' && to.kind === 'orthographic') {
    return { kind: 'orthographic', height: geometric(from.height, to.height, t), near, far };
  }
  return to;
};

// The view the flight is showing right now. At the end it is exactly the view flown to, so a
// caller can drop the flight and keep that view without anything shifting.
export const flightView = (flight: CameraFlight): ViewState => {
  const t = easings[flight.ease](flightFraction(flight));
  return t >= 1
    ? flight.to
    : {
        camera: blendPose(flight.from.camera, flight.to.camera, t),
        projection: blendProjection(flight.from.projection, flight.to.projection, t),
        coordinates: flight.to.coordinates,
      };
};

// Whether the user did something that should hand the camera back: a press, a wheel turn or a held
// key. Hovering does not count, so a mouse crossing the picture never stops a flight.
export const interrupts = (input: InputFrame): boolean =>
  isDragging(input) || input.wheel !== 0 || input.keys.length > 0;
