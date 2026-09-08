// Clipping: half-space planes, a section box, and a cut at one storey.
//
// The region is part of the saved slice, so a scene reopens sectioned the way it was left; the
// alpha kept the section outside the document and lost it on reload. Every command validates
// through render's own plane arithmetic, so a region that reaches the slice is one a renderer can
// apply. Identity on the visible side is untouched: picking rejects clipped points with render's
// `isClipped`, and nothing here hides or removes an object.

import {
  array,
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
  onSlices,
  optional,
  stateSlice,
  success,
  tuple,
  union,
  type Command,
  type Disposable,
  type Feature,
  type Migration,
  type Result,
  type Schema,
  type Session,
  type StateSlice,
  type Vec3,
} from '@bim-open-toolkit/model';
import {
  applyClipping,
  boxPlanes,
  noClipping,
  planesOf,
  type ClipPlane,
  type ClipRegion,
  type ClippingTarget,
} from '@bim-open-toolkit/render';
import type { Level } from './navigation-aids.js';

// The section in force and whether it is applied. Clearing keeps the slice and empties the region,
// so a document always says what the section is rather than leaving a renderer to remember.
export type ClippingState = {
  readonly enabled: boolean;
  readonly region: ClipRegion;
};

// Which axis a horizontal cut is measured along. A storey section is measured along the up axis.
export type SectionAxis = 'x' | 'y' | 'z';

// Which side of a cut without a thickness is kept.
export type SectionSide = 'below' | 'above';

const vec3Schema = tuple(number(), number(), number());

const planeSchema: Schema<ClipPlane> = object({ normal: vec3Schema, constant: number() });

const regionSchema = union<ClipRegion>(
  object({ kind: literal('planes'), planes: array(planeSchema) }),
  object({ kind: literal('box'), min: vec3Schema, max: vec3Schema }),
);

// The shape of the clipping slice.
export const clippingSchema: Schema<ClippingState> = object({
  enabled: boolean(),
  region: regionSchema,
});

// Nothing clipped, with an empty region rather than an absent one.
export const defaultClipping: ClippingState = { enabled: false, region: noClipping };

// Steps that read a clipping slice written at an older version. Version 1 has no history yet.
export const clippingMigrations: readonly Migration[] = [];

// The saved section: the region and whether it is in force.
export const clippingSlice: StateSlice<ClippingState> = stateSlice(
  'clipping',
  1,
  clippingSchema,
  defaultClipping,
  clippingMigrations,
);

// The unit normal along an axis, pointing the way the sign says.
const axisNormal = (axis: SectionAxis, sign: number): Vec3 =>
  axis === 'x' ? [sign, 0, 0] : axis === 'y' ? [0, sign, 0] : [0, 0, sign];

// A horizontal cut: a slab of the given thickness starting at the elevation, or, with no thickness,
// everything on one side of it. Zero or negative thickness is refused rather than read as no cut.
export const sectionRegion = (
  elevation: number,
  thickness: number | undefined,
  axis: SectionAxis = 'z',
  keep: SectionSide = 'below',
): Result<ClipRegion> => {
  if (!Number.isFinite(elevation))
    return failure([diagnostic('clipping/elevation', 'A section needs a finite elevation.', ['elevation'])]);
  if (thickness === undefined)
    return success({
      kind: 'planes',
      planes: [
        keep === 'below'
          ? { normal: axisNormal(axis, -1), constant: elevation }
          : { normal: axisNormal(axis, 1), constant: -elevation },
      ],
    });
  if (!Number.isFinite(thickness) || thickness <= 0)
    return failure([diagnostic('clipping/thickness', 'A section slab needs a thickness above zero.', ['thickness'])]);
  return success({
    kind: 'planes',
    planes: [
      { normal: axisNormal(axis, 1), constant: -elevation },
      { normal: axisNormal(axis, -1), constant: elevation + thickness },
    ],
  });
};

// The section that shows one storey: the slab it occupies, or everything above it when the model
// does not say how far up the topmost storey reaches.
export const sectionForLevel = (level: Level, axis: SectionAxis = 'z'): Result<ClipRegion> =>
  sectionRegion(level.elevation, level.height, axis, 'above');

// The state with a region in force, normalised so a renderer copies it across without reading it.
const enabledWith = (region: ClipRegion): Result<ClippingState> => {
  const planes = planesOf(region);
  if (!planes.ok) return failure(planes.diagnostics);
  return success({
    enabled: true,
    region: region.kind === 'box' ? region : { kind: 'planes', planes: planes.value },
  });
};

// Writes the state and reports it, so a caller sees the region that was actually stored.
const put = (session: Session, next: Result<ClippingState>): Result<ClippingState> => {
  if (!next.ok) return next;
  session.write(clippingSlice, next.value);
  return next;
};

// Sections with an explicit list of half-spaces; each plane keeps the side its normal points to.
const setPlanes = command({
  name: 'clipping.setPlanes',
  title: 'Set clipping planes',
  description: 'Section the model with half-spaces, keeping the side each normal points towards.',
  input: object({ planes: array(planeSchema) }),
  run: (session: Session, input) => put(session, enabledWith({ kind: 'planes', planes: input.planes })),
});

// Sections with a box, keeping its interior.
const setBox = command({
  name: 'clipping.setBox',
  title: 'Set section box',
  description: 'Section the model with a box, keeping what is inside it.',
  input: object({ min: vec3Schema, max: vec3Schema }),
  run: (session: Session, input) => {
    const planes = boxPlanes(input.min, input.max);
    if (!planes.ok) return failure(planes.diagnostics);
    return put(session, enabledWith({ kind: 'box', min: input.min, max: input.max }));
  },
});

// Cuts at a height: a slab of the given thickness, or everything on one side of the cut.
const sectionAt = command({
  name: 'clipping.sectionAt',
  title: 'Section at a height',
  description: 'Cut at an elevation, keeping a slab of the given thickness or one side of the cut.',
  input: object({
    elevation: number(),
    thickness: optional(number()),
    axis: optional(enumeration<SectionAxis>(['x', 'y', 'z'])),
    keep: optional(enumeration<SectionSide>(['below', 'above'])),
  }),
  run: (session: Session, input) =>
    put(
      session,
      (() => {
        const region = sectionRegion(input.elevation, input.thickness, input.axis ?? 'z', input.keep ?? 'below');
        return region.ok ? enabledWith(region.value) : failure(region.diagnostics);
      })(),
    ),
});

// Removes the section, leaving the whole model drawn.
const clear = command({
  name: 'clipping.clear',
  title: 'Clear the section',
  description: 'Remove the section so the whole model is drawn again.',
  input: object({}),
  run: (session: Session) => {
    session.write(clippingSlice, defaultClipping);
    return success(defaultClipping);
  },
});

// The commands that set and clear the section.
export const clippingCommands: readonly Command[] = [setPlanes, setBox, sectionAt, clear];

// Puts the slice's section in force on a renderer, and again whenever a command changes it. A new
// section replaces the one in force rather than lifting it first, so nothing is drawn unsectioned
// in between. Disposing lifts the section, which is what `applyClipping` does on its own disposal.
export const clippingHook =
  (target: ClippingTarget) =>
  (session: Session): Disposable => {
    let lift: Disposable | undefined;
    const apply = (): void => {
      const state = session.read(clippingSlice);
      const applied = applyClipping(target, state.enabled ? state.region : noClipping);
      lift = applied.ok ? applied.value : undefined;
    };
    apply();
    const subscription = session.subscribe(onSlices([clippingSlice.id], apply));
    return disposable(() => {
      subscription.dispose();
      lift?.dispose();
      lift = undefined;
    });
  };

// Sections as a feature: the region is saved state, and a renderer applies it through the hook.
export const clippingFeature: Feature<ClippingState> = feature('clipping', clippingSlice, clippingCommands);
