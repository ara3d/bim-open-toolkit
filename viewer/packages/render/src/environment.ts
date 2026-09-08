// Environment: background, a simple light rig, a scale-aware grid, a ground plane and axes.
//
// All of it is settings plus generated line segments. The grid picks its spacing from the model's
// size, so the same settings look right on a door handle and on a city block. Nothing generated
// here is model geometry: it is not in the instance table, so it cannot enter an object inventory
// or a fit-to-selection bound.
//
// `EnvironmentTarget` is the seam a renderer implements. Everything above it is tested in Node.

import {
  boundsSize,
  diagnostic,
  disposable,
  failure,
  isEmptyBounds,
  success,
  type Bounds,
  type Color,
  type Disposable,
  type Result,
  type Vec3,
} from '@bim-open-toolkit/model';

// A straight line to draw, in world coordinates.
export type LineSegment = {
  readonly from: Vec3;
  readonly to: Vec3;
  readonly color: Color;
};

// The light setup. One sky light and one sun, which is enough for review and cheap enough to leave
// on; shadows and ambient occlusion are separate features with their own cost.
export type LightRig = {
  readonly ambientIntensity: number;
  readonly sunIntensity: number;
  readonly sunDirection: Vec3;
  // 0 is neutral white, 1 is a warm daylight tint.
  readonly warmth: number;
};

// The grid: whether it is drawn, how far it reaches and how fine it is. Spacing of zero means the
// spacing is chosen from the model's size.
export type GridSettings = {
  readonly enabled: boolean;
  readonly spacing: number;
  readonly color: Color;
  readonly emphasisColor: Color;
  // Every nth line is drawn in the emphasis colour.
  readonly emphasisEvery: number;
};

// Everything the environment holds.
export type EnvironmentSettings = {
  readonly background: Color;
  readonly rig: LightRig;
  readonly grid: GridSettings;
  readonly groundPlane: boolean;
  readonly axes: boolean;
  // Which axis points up, which decides the plane the grid lies in.
  readonly up: 'y' | 'z';
};

// A neutral review environment: a light grey background, a soft sky, one sun and an automatic grid.
export const defaultEnvironment: EnvironmentSettings = {
  background: [0.9, 0.91, 0.93],
  rig: { ambientIntensity: 0.6, sunIntensity: 1.2, sunDirection: [0.4, 0.8, 0.45], warmth: 0.15 },
  grid: {
    enabled: true,
    spacing: 0,
    color: [0.78, 0.79, 0.81],
    emphasisColor: [0.62, 0.63, 0.66],
    emphasisEvery: 5,
  },
  groundPlane: true,
  axes: true,
  up: 'z',
};

const inRange = (value: number, least: number, most: number): boolean =>
  Number.isFinite(value) && value >= least && value <= most;

const isColor = (color: Color): boolean => color.every((channel) => inRange(channel, 0, 1));

// Checks settings before a renderer is asked to apply them, so a bad value is a diagnostic rather
// than a black screen.
export const checkEnvironment = (settings: EnvironmentSettings): Result<EnvironmentSettings> => {
  if (!isColor(settings.background))
    return failure([diagnostic('bad-color', 'Background channels must be between 0 and 1', ['background'])]);
  if (!isColor(settings.grid.color) || !isColor(settings.grid.emphasisColor))
    return failure([diagnostic('bad-color', 'Grid channels must be between 0 and 1', ['grid'])]);
  const { ambientIntensity, sunIntensity, sunDirection, warmth } = settings.rig;
  if (!inRange(ambientIntensity, 0, 100) || !inRange(sunIntensity, 0, 100))
    return failure([diagnostic('bad-intensity', 'Light intensity must be between 0 and 100', ['rig'])]);
  if (!inRange(warmth, 0, 1))
    return failure([diagnostic('bad-warmth', 'Warmth must be between 0 and 1', ['rig', 'warmth'])]);
  if (!sunDirection.every(Number.isFinite) || sunDirection.every((value) => value === 0))
    return failure([diagnostic('bad-direction', 'The sun needs a direction', ['rig', 'sunDirection'])]);
  if (!inRange(settings.grid.spacing, 0, Number.MAX_SAFE_INTEGER))
    return failure([diagnostic('bad-spacing', 'Grid spacing must be zero or positive', ['grid', 'spacing'])]);
  if (!Number.isInteger(settings.grid.emphasisEvery) || settings.grid.emphasisEvery < 1)
    return failure([diagnostic('bad-emphasis', 'Grid emphasis must be a whole number of lines', ['grid'])]);
  return success(settings);
};

// A spacing that puts between ten and fifty lines across the model, rounded to 1, 2 or 5 times a
// power of ten so the numbers on it are ones a person reads easily.
export const gridSpacingFor = (bounds: Bounds): number => {
  const size = boundsSize(bounds);
  if (size === undefined) return 1;
  const widest = Math.max(size[0] ?? 0, size[1] ?? 0, size[2] ?? 0);
  if (!Number.isFinite(widest) || widest <= 0) return 1;
  const rough = widest / 20;
  const power = 10 ** Math.floor(Math.log10(rough));
  const step = rough / power;
  const nice = step < 1.5 ? 1 : step < 3.5 ? 2 : step < 7.5 ? 5 : 10;
  return nice * power;
};

const groundAxes = (up: 'y' | 'z'): readonly [number, number] => (up === 'y' ? [0, 2] : [0, 1]);

const at = (first: number, second: number, height: number, up: 'y' | 'z'): Vec3 =>
  up === 'y' ? [first, height, second] : [first, second, height];

// The grid lines for a model of these bounds, on the ground plane, centred on the model.
//
// The grid reaches one spacing past the model on every side, so an object at the edge still has
// ground under it. An empty or absent bounds gives a default twenty-by-twenty grid at the origin.
export const gridLines = (
  settings: EnvironmentSettings,
  bounds: Bounds,
  height = 0,
): readonly LineSegment[] => {
  if (!settings.grid.enabled) return [];
  const spacing = settings.grid.spacing > 0 ? settings.grid.spacing : gridSpacingFor(bounds);
  const [firstAxis, secondAxis] = groundAxes(settings.up);
  const empty = isEmptyBounds(bounds);
  const low = (axis: number): number => (empty ? -10 * spacing : bounds.min[axis] ?? 0);
  const high = (axis: number): number => (empty ? 10 * spacing : bounds.max[axis] ?? 0);
  const start = (axis: number): number => Math.floor(low(axis) / spacing) * spacing - spacing;
  const end = (axis: number): number => Math.ceil(high(axis) / spacing) * spacing + spacing;
  const firstFrom = start(firstAxis);
  const firstTo = end(firstAxis);
  const secondFrom = start(secondAxis);
  const secondTo = end(secondAxis);
  const lines: LineSegment[] = [];
  const emphasised = (value: number): boolean =>
    Math.round(value / spacing) % settings.grid.emphasisEvery === 0;
  for (let value = firstFrom; value <= firstTo + spacing / 2; value += spacing) {
    const color = emphasised(value) ? settings.grid.emphasisColor : settings.grid.color;
    lines.push({
      from: at(value, secondFrom, height, settings.up),
      to: at(value, secondTo, height, settings.up),
      color,
    });
  }
  for (let value = secondFrom; value <= secondTo + spacing / 2; value += spacing) {
    const color = emphasised(value) ? settings.grid.emphasisColor : settings.grid.color;
    lines.push({
      from: at(firstFrom, value, height, settings.up),
      to: at(firstTo, value, height, settings.up),
      color,
    });
  }
  return lines;
};

// The three axis indicators from an origin: x red, y green, z blue.
export const axisLines = (settings: EnvironmentSettings, length: number, origin: Vec3 = [0, 0, 0]): readonly LineSegment[] => {
  if (!settings.axes || !(length > 0)) return [];
  const [x, y, z] = origin;
  return [
    { from: origin, to: [x + length, y, z], color: [0.85, 0.2, 0.2] },
    { from: origin, to: [x, y + length, z], color: [0.2, 0.7, 0.25] },
    { from: origin, to: [x, y, z + length], color: [0.2, 0.4, 0.9] },
  ];
};

// The size the axis indicator should be for a model of these bounds: one grid spacing.
export const axisLengthFor = (settings: EnvironmentSettings, bounds: Bounds): number =>
  settings.grid.spacing > 0 ? settings.grid.spacing : gridSpacingFor(bounds);

// Everything a renderer draws for the environment, ready to hand over.
export type EnvironmentDrawing = {
  readonly background: Color;
  readonly rig: LightRig;
  readonly grid: readonly LineSegment[];
  readonly axes: readonly LineSegment[];
  readonly groundPlane: boolean;
  // The height of the ground plane and the grid, taken from the bottom of the model.
  readonly groundHeight: number;
};

// The height the ground sits at: the bottom of the model on the up axis, or zero when it is empty.
export const groundHeight = (settings: EnvironmentSettings, bounds: Bounds): number => {
  if (isEmptyBounds(bounds)) return 0;
  return (settings.up === 'y' ? bounds.min[1] : bounds.min[2]) ?? 0;
};

// What to draw for a model of these bounds.
export const environmentDrawing = (
  settings: EnvironmentSettings,
  bounds: Bounds,
): Result<EnvironmentDrawing> => {
  const checked = checkEnvironment(settings);
  if (!checked.ok) return failure(checked.diagnostics);
  const height = groundHeight(settings, bounds);
  return success({
    background: settings.background,
    rig: settings.rig,
    grid: gridLines(settings, bounds, height),
    axes: axisLines(settings, axisLengthFor(settings, bounds), at(0, 0, height, settings.up)),
    groundPlane: settings.groundPlane,
    groundHeight: height,
  });
};

// What a renderer has to provide for the environment.
export type EnvironmentTarget = {
  readonly setEnvironment: (drawing: EnvironmentDrawing | undefined) => void;
};

// Puts an environment in place and hands back the way to take it away again. Disposing clears it,
// which is what returns the host's own background and lighting.
export const applyEnvironment = (
  target: EnvironmentTarget,
  settings: EnvironmentSettings,
  bounds: Bounds,
): Result<Disposable> => {
  const drawing = environmentDrawing(settings, bounds);
  if (!drawing.ok) return failure(drawing.diagnostics);
  target.setEnvironment(drawing.value);
  return success(disposable(() => target.setEnvironment(undefined)));
};
