// A camera path a benchmark replays, as camera states with timestamps.
//
// Frame-time percentiles only mean something against a stated camera path: the same scene is cheap
// looking at one room and expensive looking down the length of a building. A path here is a list of
// views, each stamped with the time it was reached. Playing it back means drawing each view in
// turn, so no interpolation is needed and the frames measured are exactly the frames recorded.
//
// Two ways to get one: record what a session actually did, or generate a repeatable orbit around a
// box. The generated one is what a gate uses, because it is the same on every machine.

import {
  addVec3,
  boundsCenter,
  boundsSize,
  cameraPose,
  metresZUpLocal,
  normalizeVec3,
  perspective,
  scaleVec3,
  vec3Length,
  viewState,
  type Bounds,
  type CoordinateContext,
  type Projection,
  type Vec3,
  type ViewState,
} from '@bim-open-toolkit/model';

// One view of a path and the time it was reached, in milliseconds from the start.
export type CameraKey = {
  readonly timeMs: number;
  readonly view: ViewState;
};

// A named path. Times never go backwards, and there is always at least one key.
export type CameraPath = {
  readonly name: string;
  readonly keys: readonly CameraKey[];
};

// A path from keys already in order. Rejects an empty path or one whose times go backwards, so a
// benchmark cannot report a duration it did not measure.
export function cameraPath(name: string, keys: readonly CameraKey[]): CameraPath {
  if (keys.length === 0) throw new Error(`camera path "${name}" has no keys`);
  keys.forEach((key, index) => {
    const previous = keys[index - 1];
    if (!Number.isFinite(key.timeMs)) throw new Error(`camera path "${name}" key ${index} has time ${key.timeMs}`);
    if (previous !== undefined && key.timeMs < previous.timeMs) {
      throw new Error(`camera path "${name}" goes back in time at key ${index}: ${key.timeMs} after ${previous.timeMs}`);
    }
  });
  return { name, keys };
}

// How long the path covers, from its first key to its last.
export const pathDurationMs = (path: CameraPath): number => {
  const first = path.keys[0];
  const last = path.keys[path.keys.length - 1];
  return first === undefined || last === undefined ? 0 : last.timeMs - first.timeMs;
};

// The last key reached at or before a time; the first key for a time before the path starts.
export function keyAtMs(path: CameraPath, timeMs: number): CameraKey {
  const first = path.keys[0];
  if (first === undefined) throw new Error(`camera path "${path.name}" has no keys`);
  let found = first;
  for (const key of path.keys) if (key.timeMs <= timeMs) found = key;
  return found;
}

// Collects a path while something is running.
export type CameraPathRecorder = {
  readonly record: (timeMs: number, view: ViewState) => void;
  readonly finish: () => CameraPath;
};

// A recorder for a path built as a session moves. Feed it a clock's time and the view it showed.
export function recordCameraPath(name: string): CameraPathRecorder {
  const keys: CameraKey[] = [];
  return {
    record: (timeMs, view) => { keys.push({ timeMs, view }); },
    finish: () => cameraPath(name, keys),
  };
}

// How a generated orbit is shaped.
export type OrbitPathOptions = {
  // Views the path holds. Each one is a frame the benchmark draws.
  readonly frames: number;
  // Milliseconds between views, which is the frame budget the path is written for.
  readonly intervalMs: number;
  // Full turns around the box across the whole path.
  readonly turns: number;
  // Camera distance from the centre, as a multiple of the box's own radius.
  readonly radiusScale: number;
  // Camera height above the centre, as a multiple of the box's radius.
  readonly heightScale: number;
  readonly up: Vec3;
  readonly projection: Projection;
  readonly coordinates: CoordinateContext;
};

// A full turn of sixty frames at a thirty-a-second budget, from outside a metre-scale box.
export const defaultOrbitPathOptions: OrbitPathOptions = {
  frames: 60,
  intervalMs: 1000 / 30,
  turns: 1,
  radiusScale: 2,
  heightScale: 0.6,
  up: [0, 0, 1],
  projection: perspective(),
  coordinates: metresZUpLocal,
};

// The cross product. Written here because the model package has no three-dimensional cross product
// and this package must not depend on interact, which does; both are recorded as findings.
const cross = (a: Vec3, b: Vec3): Vec3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];

// Two unit directions at right angles to the up axis, chosen the same way for a given up axis.
const orbitPlane = (up: Vec3): readonly [Vec3, Vec3] => {
  const axis = normalizeVec3(up) ?? [0, 0, 1];
  const helper: Vec3 = Math.abs(axis[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
  const first = normalizeVec3(cross(axis, helper)) ?? [1, 0, 0];
  return [first, cross(axis, first)];
};

// A repeatable orbit around a box: the same views on every machine, so two runs are comparable.
export function orbitCameraPath(
  name: string,
  bounds: Bounds,
  options: Partial<OrbitPathOptions> = {},
): CameraPath {
  const settings: OrbitPathOptions = { ...defaultOrbitPathOptions, ...options };
  if (!Number.isInteger(settings.frames) || settings.frames < 1) {
    throw new Error(`frames must be a positive integer, got ${settings.frames}`);
  }
  const centre = boundsCenter(bounds);
  const size = boundsSize(bounds);
  if (centre === undefined || size === undefined) throw new Error(`camera path "${name}" was given empty bounds`);
  const radius = Math.max(vec3Length(size) / 2, 1e-6);
  const axis = normalizeVec3(settings.up) ?? [0, 0, 1];
  const [first, second] = orbitPlane(settings.up);
  const height = scaleVec3(axis, radius * settings.heightScale);
  const keys = Array.from({ length: settings.frames }, (_unused, frame): CameraKey => {
    const angle = (2 * Math.PI * settings.turns * frame) / settings.frames;
    const offset = addVec3(
      scaleVec3(first, Math.cos(angle) * radius * settings.radiusScale),
      scaleVec3(second, Math.sin(angle) * radius * settings.radiusScale),
    );
    return {
      timeMs: frame * settings.intervalMs,
      view: viewState(
        cameraPose(addVec3(centre, addVec3(offset, height)), centre, axis),
        settings.projection,
        settings.coordinates,
      ),
    };
  });
  return cameraPath(name, keys);
}
