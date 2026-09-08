// Environment: background, light rig, grid, axes and a bounding-box display.
//
// The settings are render's own `EnvironmentSettings`, saved in the slice and checked by render's
// `checkEnvironment` before they are written, so a bad value is a diagnostic rather than a black
// screen. `environment.set` is a patch: what it does not mention keeps the value it had.
//
// The bounding-box display is this feature's own addition, because render's environment draws a
// grid, a ground plane and axes but not the box around the model. It is line segments like the
// rest, handed to the host separately so a renderer draws it without the axes changing meaning.

import {
  boolean,
  command,
  disposable,
  failure,
  feature,
  isEmptyBounds,
  number,
  object,
  onSlices,
  optional,
  stateSlice,
  success,
  tuple,
  upAxisSchema,
  type Bounds,
  type Color,
  type Command,
  type Disposable,
  type Feature,
  type Migration,
  type Schema,
  type Session,
  type StateSlice,
  type Vec3,
} from '@bim-open-toolkit/model';
import {
  applyEnvironment,
  checkEnvironment,
  defaultEnvironment,
  type EnvironmentSettings,
  type EnvironmentTarget,
  type LineSegment,
} from '@bim-open-toolkit/render';

// The environment settings plus whether the model's bounding box is drawn.
export type EnvironmentState = {
  readonly settings: EnvironmentSettings;
  readonly boundsDisplay: boolean;
};

// What draws an environment: render's target, plus the seam for the bounding box and the bounds to
// size everything by. `setBoundsDisplay` is optional, so a host that draws no box costs nothing.
export type EnvironmentHost = {
  readonly target: EnvironmentTarget;
  readonly bounds: () => Bounds;
  readonly setBoundsDisplay?: ((lines: readonly LineSegment[]) => void) | undefined;
};

const vec3Schema = tuple(number(), number(), number());

const rigSchema = object({
  ambientIntensity: number(),
  sunIntensity: number(),
  sunDirection: vec3Schema,
  warmth: number(),
});

const gridSchema = object({
  enabled: boolean(),
  spacing: number(),
  color: vec3Schema,
  emphasisColor: vec3Schema,
  emphasisEvery: number(),
});

const settingsSchema: Schema<EnvironmentSettings> = object({
  background: vec3Schema,
  rig: rigSchema,
  grid: gridSchema,
  groundPlane: boolean(),
  axes: boolean(),
  up: upAxisSchema,
});

// The shape of the environment slice.
export const environmentSchema: Schema<EnvironmentState> = object({
  settings: settingsSchema,
  boundsDisplay: boolean(),
});

// Render's neutral review environment, with no bounding box drawn.
export const defaultEnvironmentState: EnvironmentState = {
  settings: defaultEnvironment,
  boundsDisplay: false,
};

// Steps that read an environment slice written at an older version. Version 1 has no history yet.
export const environmentMigrations: readonly Migration[] = [];

// The saved environment: settings and the bounding-box display.
export const environmentSlice: StateSlice<EnvironmentState> = stateSlice(
  'environment',
  1,
  environmentSchema,
  defaultEnvironmentState,
  environmentMigrations,
);

// The colour the bounding box is drawn in: a muted orange that reads against the default grid.
export const boundsDisplayColor: Color = [0.6, 0.4, 0.19];

// The twelve edges of a box, for a host that draws the model's extent. An empty box has no edges.
export const boundsLines = (bounds: Bounds, color: Color = boundsDisplayColor): readonly LineSegment[] => {
  if (isEmptyBounds(bounds)) return [];
  const corner = (index: number): Vec3 => [
    (index & 1) === 0 ? bounds.min[0] : bounds.max[0],
    (index & 2) === 0 ? bounds.min[1] : bounds.max[1],
    (index & 4) === 0 ? bounds.min[2] : bounds.max[2],
  ];
  const edges: readonly (readonly [number, number])[] = [
    [0, 1], [2, 3], [4, 5], [6, 7],
    [0, 2], [1, 3], [4, 6], [5, 7],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];
  return edges.map(([from, to]) => ({ from: corner(from), to: corner(to), color }));
};

// A change to the environment: every part optional, down to the individual light and grid values.
export type EnvironmentPatch = {
  readonly background?: Color | undefined;
  readonly rig?:
    | {
        readonly ambientIntensity?: number | undefined;
        readonly sunIntensity?: number | undefined;
        readonly sunDirection?: Vec3 | undefined;
        readonly warmth?: number | undefined;
      }
    | undefined;
  readonly grid?:
    | {
        readonly enabled?: boolean | undefined;
        readonly spacing?: number | undefined;
        readonly color?: Color | undefined;
        readonly emphasisColor?: Color | undefined;
        readonly emphasisEvery?: number | undefined;
      }
    | undefined;
  readonly groundPlane?: boolean | undefined;
  readonly axes?: boolean | undefined;
  readonly up?: EnvironmentSettings['up'] | undefined;
};

// The settings with a patch applied over them: what the patch leaves out keeps the value it had.
export const withPatch = (settings: EnvironmentSettings, patch: EnvironmentPatch): EnvironmentSettings => ({
  background: patch.background ?? settings.background,
  rig: {
    ambientIntensity: patch.rig?.ambientIntensity ?? settings.rig.ambientIntensity,
    sunIntensity: patch.rig?.sunIntensity ?? settings.rig.sunIntensity,
    sunDirection: patch.rig?.sunDirection ?? settings.rig.sunDirection,
    warmth: patch.rig?.warmth ?? settings.rig.warmth,
  },
  grid: {
    enabled: patch.grid?.enabled ?? settings.grid.enabled,
    spacing: patch.grid?.spacing ?? settings.grid.spacing,
    color: patch.grid?.color ?? settings.grid.color,
    emphasisColor: patch.grid?.emphasisColor ?? settings.grid.emphasisColor,
    emphasisEvery: patch.grid?.emphasisEvery ?? settings.grid.emphasisEvery,
  },
  groundPlane: patch.groundPlane ?? settings.groundPlane,
  axes: patch.axes ?? settings.axes,
  up: patch.up ?? settings.up,
});

// Changes the environment. Everything is optional, and what is left out stays as it was.
const set = command({
  name: 'environment.set',
  title: 'Set the environment',
  description: 'Change the background, lighting, grid, ground plane, axes or bounding-box display.',
  input: object({
    background: optional(vec3Schema),
    rig: optional(
      object({
        ambientIntensity: optional(number()),
        sunIntensity: optional(number()),
        sunDirection: optional(vec3Schema),
        warmth: optional(number()),
      }),
    ),
    grid: optional(
      object({
        enabled: optional(boolean()),
        spacing: optional(number()),
        color: optional(vec3Schema),
        emphasisColor: optional(vec3Schema),
        emphasisEvery: optional(number()),
      }),
    ),
    groundPlane: optional(boolean()),
    axes: optional(boolean()),
    up: optional(upAxisSchema),
    boundsDisplay: optional(boolean()),
  }),
  run: (session: Session, input) => {
    const state = session.read(environmentSlice);
    const checked = checkEnvironment(withPatch(state.settings, input));
    if (!checked.ok) return failure(checked.diagnostics);
    const next: EnvironmentState = {
      settings: checked.value,
      boundsDisplay: input.boundsDisplay ?? state.boundsDisplay,
    };
    session.write(environmentSlice, next);
    return success(next);
  },
});

// The command that changes the environment.
export const environmentCommands: readonly Command[] = [set];

// Draws the slice's environment, and again whenever a command changes it. A change replaces the
// drawing rather than clearing it first, so nothing blinks between two environments. Disposing
// clears both the environment and the bounding box, which returns the host's own background.
export const environmentHook =
  (host: EnvironmentHost) =>
  (session: Session): Disposable => {
    let lift: Disposable | undefined;
    const apply = (): void => {
      const state = session.read(environmentSlice);
      const bounds = host.bounds();
      const applied = applyEnvironment(host.target, state.settings, bounds);
      lift = applied.ok ? applied.value : undefined;
      host.setBoundsDisplay?.(state.boundsDisplay ? boundsLines(bounds) : []);
    };
    apply();
    const subscription = session.subscribe(onSlices([environmentSlice.id], apply));
    return disposable(() => {
      subscription.dispose();
      lift?.dispose();
      lift = undefined;
      host.setBoundsDisplay?.([]);
    });
  };

// Background, lighting, grid, axes and bounding box as a feature.
export const environmentFeature: Feature<EnvironmentState> = feature(
  'environment',
  environmentSlice,
  environmentCommands,
);
