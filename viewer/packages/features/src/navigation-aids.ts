// Navigation aids: the storey list a building offers, saved views, framing, and level navigation.
//
// The feature owns the view state, because moving the camera is what its commands do and a feature
// owns exactly one slice. `navigationHook` hands each new view to whatever applies it — interact's
// session in a live viewer, a recording target in a test. Nothing here touches a DOM or a renderer.
//
// Levels are derived from `ModelData` by a pure function rather than stored, so the list is always
// the model's own and never a stale copy in a document. What a command carries is the one level it
// is asked to go to, which is also what the HUD shows.

import {
  array,
  boolean,
  boundsOf,
  command,
  coordinateContextSchema,
  defaultView,
  diagnostic,
  disposable,
  failure,
  feature,
  findSavedView,
  frameBoundsInViewport,
  literal,
  normalizeVec3,
  number,
  object,
  objectKey,
  onSlices,
  optional,
  panBy,
  putSavedView,
  record,
  savedView,
  stateSlice,
  string,
  success,
  tuple,
  union,
  upVector,
  viewDirection,
  type Bounds,
  type Command,
  type Disposable,
  type Feature,
  type Migration,
  type ModelData,
  type ObjectKey,
  type Projection,
  type SavedView,
  type Schema,
  type Session,
  type StateSlice,
  type StyleRule,
  type UpAxis,
  type Vec3,
  type ViewState,
} from '@bim-open-toolkit/model';

// One storey of a building: where its floor sits and how far up the next floor is.
// `height` is absent for the topmost storey, where the model says nothing about what is above it.
export type Level = {
  readonly id: string;
  readonly name: string;
  readonly elevation: number;
  readonly height?: number | undefined;
};

// The view, the views a user saved, and the level the camera was last sent to.
export type NavigationState = {
  readonly view: ViewState;
  readonly views: readonly SavedView[];
  readonly level?: Level | undefined;
};

// What applies a view: interact's navigation session in a live viewer, a recorder in a test.
export type ViewTarget = {
  readonly setView: (view: ViewState) => void;
};

const vec3Schema = tuple(number(), number(), number());

const boundsSchema: Schema<Bounds> = object({ min: vec3Schema, max: vec3Schema });

const cameraSchema = object({ position: vec3Schema, target: vec3Schema, up: vec3Schema });

const projectionSchema = union<Projection>(
  object({ kind: literal('perspective'), fieldOfViewDegrees: number(), near: number(), far: number() }),
  object({ kind: literal('orthographic'), height: number(), near: number(), far: number() }),
);

const viewStateSchema: Schema<ViewState> = object({
  camera: cameraSchema,
  projection: projectionSchema,
  coordinates: coordinateContextSchema,
});

const extrasSchema = record(union<string | number | boolean>(string(), number(), boolean()));

const appearanceChangeSchema = object({
  color: optional(vec3Schema),
  opacity: optional(number()),
  visible: optional(boolean()),
  extras: optional(extrasSchema),
});

const styleRuleSchema: Schema<StyleRule> = object({
  id: string(),
  name: string(),
  enabled: boolean(),
  priority: number(),
  targets: array(string()),
  change: appearanceChangeSchema,
});

const savedViewSchema: Schema<SavedView> = object({
  id: string(),
  name: string(),
  view: viewStateSchema,
  selection: array(string()),
  rules: array(styleRuleSchema),
  filter: optional(array(string())),
  savedAt: optional(string()),
});

// The shape of a level, so a command that carries one is checked like anything else.
export const levelSchema: Schema<Level> = object({
  id: string(),
  name: string(),
  elevation: number(),
  height: optional(number()),
});

// The shape of the navigation slice.
export const navigationSchema: Schema<NavigationState> = object({
  view: viewStateSchema,
  views: array(savedViewSchema),
  level: optional(levelSchema),
});

// The view a scene starts from, no saved views, no level chosen.
export const defaultNavigation: NavigationState = { view: defaultView, views: [] };

// Steps that read a navigation slice written at an older version. Version 1 has no history yet.
export const navigationMigrations: readonly Migration[] = [];

// The saved navigation state: the view, the saved views, and the level last navigated to.
export const navigationSlice: StateSlice<NavigationState> = stateSlice(
  'navigation',
  1,
  navigationSchema,
  defaultNavigation,
  navigationMigrations,
);

// The categories a storey object is recorded under, compared without case or surrounding space.
//
// Both numbers of each name are listed rather than matched by a rule, because a rule loose enough
// to turn "Levels" into "level" also turns names that mean something else into names in this set.
// Revit writes the plural, IFC writes the singular, and both are here as themselves.
const storeyCategories: ReadonlySet<string> = new Set([
  'storey',
  'storeys',
  'story',
  'stories',
  'level',
  'levels',
  'floor level',
  'floor levels',
  'building storey',
  'building storeys',
  'buildingstorey',
  'ifcbuildingstorey',
]);

// The index of the up component inside a column-major transform's translation.
const upComponent = (up: UpAxis): number => (up === 'y' ? 13 : 14);

// The storeys of a model, lowest first: one level per object recorded as a storey, at the height its
// transform places it. `height` is the distance to the storey above, so the topmost storey has none.
// A model with no storey objects has no levels, which is a fact about the model rather than an error.
//
// `elevations` is for a model whose object records do not carry the placement - the height comes
// from wherever the caller found the objects instead. It is then the whole answer: a storey object
// it does not name is left out, because a caller that had to look elsewhere for the heights has
// found nothing that says how high that storey is, and reading zero off the record would put every
// such storey on the ground.
export const levelsOf = (
  model: ModelData,
  elevations?: ReadonlyMap<ObjectKey, number>,
): readonly Level[] => {
  const component = upComponent(model.coordinates.up);
  const found = model.objects
    .filter((record) => storeyCategories.has((record.category ?? '').trim().toLowerCase()))
    .map((record) => ({
      id: record.ref.objectId,
      name: record.name ?? record.ref.objectId,
      elevation:
        elevations === undefined
          ? record.transform[component] ?? 0
          : elevations.get(objectKey(record.ref)),
    }))
    .filter((level): level is Level => level.elevation !== undefined)
    .sort((a, b) => a.elevation - b.elevation);
  return found.map((level, index) => {
    const above = found[index + 1];
    return above === undefined ? level : { ...level, height: above.elevation - level.elevation };
  });
};

// The level a height falls on: the highest storey at or below it, or undefined when there is none.
export const levelAt = (levels: readonly Level[], height: number): Level | undefined =>
  levels.reduce<Level | undefined>(
    (found, level) => (level.elevation <= height ? level : found),
    undefined,
  );

// The middle of a level, which is the height a camera sent to it looks at. A level with no height
// is looked at from its own floor, because the model does not say how far up it reaches.
export const levelCenter = (level: Level): number => level.elevation + (level.height ?? 0) / 2;

// The view moved so it looks at the level, keeping its direction, distance and projection.
export const viewAtLevel = (view: ViewState, level: Level, up: UpAxis): ViewState => {
  const axis = up === 'y' ? 1 : 2;
  const rise = levelCenter(level) - (view.camera.target[axis] ?? 0);
  const offset: Vec3 = up === 'y' ? [0, rise, 0] : [0, 0, rise];
  return { ...view, camera: panBy(view.camera, offset) };
};

// The view that shows the box, looking from where the camera looks now, in the state's own frame.
// Undefined when the box is empty, so a fit of nothing never produces a camera at infinity.
export const viewFraming = (
  state: NavigationState,
  bounds: Bounds,
  direction: Vec3 | undefined,
  aspect: number,
): ViewState | undefined => {
  const along =
    normalizeVec3(direction ?? viewDirection(state.view.camera)) ??
    normalizeVec3(viewDirection(defaultView.camera)) ??
    [0, 1, 0];
  const up = upVector(state.view.coordinates.up);
  const framed = frameBoundsInViewport(bounds, along, state.view.projection, aspect, up);
  return framed === undefined ? undefined : { ...framed, coordinates: state.view.coordinates };
};

// Sends the camera to a storey without changing how it is looking, and records the level it is on.
const goToLevel = command({
  name: 'navigation.goToLevel',
  title: 'Go to level',
  description: 'Move the camera to look at one storey, keeping its direction and distance.',
  input: object({ level: levelSchema }),
  run: (session: Session, input) => {
    const state = session.read(navigationSlice);
    const next: NavigationState = {
      ...state,
      view: viewAtLevel(state.view, input.level, state.view.coordinates.up),
      level: input.level,
    };
    session.write(navigationSlice, next);
    return success(next);
  },
});

// Frames a box, or the box around a set of points, from where the camera is looking now.
const frame = command({
  name: 'navigation.frame',
  title: 'Frame',
  description: 'Move the camera so a box, or the box around a set of points, fills the view.',
  input: object({
    bounds: optional(boundsSchema),
    points: optional(array(vec3Schema)),
    direction: optional(vec3Schema),
    aspect: optional(number()),
  }),
  run: (session: Session, input) => {
    const state = session.read(navigationSlice);
    const bounds = input.bounds ?? (input.points === undefined ? undefined : boundsOf(input.points));
    if (bounds === undefined)
      return failure([diagnostic('navigation/nothing-to-frame', 'Framing needs bounds or points.')]);
    const framed = viewFraming(state, bounds, input.direction, input.aspect ?? 1);
    if (framed === undefined)
      return failure([diagnostic('navigation/empty-bounds', 'An empty box cannot be framed.')]);
    const next: NavigationState = { ...state, view: framed };
    session.write(navigationSlice, next);
    return success(next);
  },
});

// Saves the current view under a name, replacing any earlier view of the same id.
const saveView = command({
  name: 'navigation.saveView',
  title: 'Save view',
  description: 'Save the camera, the selection and the style rules under a name.',
  input: object({
    id: string(),
    name: string(),
    selection: optional(array(string())),
    rules: optional(array(styleRuleSchema)),
  }),
  run: (session: Session, input) => {
    const state = session.read(navigationSlice);
    const selection: readonly ObjectKey[] = input.selection ?? [];
    const view = savedView(input.id, input.name, state.view, selection, input.rules ?? []);
    const next: NavigationState = { ...state, views: putSavedView(state.views, view) };
    session.write(navigationSlice, next);
    return success(next);
  },
});

// Puts the camera back where a saved view left it.
const restoreView = command({
  name: 'navigation.restoreView',
  title: 'Restore view',
  description: 'Move the camera back to a saved view.',
  input: object({ id: string() }),
  run: (session: Session, input) => {
    const state = session.read(navigationSlice);
    const found = findSavedView(state.views, input.id);
    if (found === undefined)
      return failure([diagnostic('navigation/unknown-view', `There is no saved view "${input.id}".`)]);
    const next: NavigationState = { ...state, view: found.view };
    session.write(navigationSlice, next);
    return success(next);
  },
});

// The commands that move the camera and keep the saved views.
export const navigationCommands: readonly Command[] = [goToLevel, frame, saveView, restoreView];

// Hands the view to a target whenever a navigation command changes it, and once on installation.
export const navigationHook =
  (target: ViewTarget) =>
  (session: Session): Disposable => {
    const apply = (): void => target.setView(session.read(navigationSlice).view);
    apply();
    const subscription = session.subscribe(onSlices([navigationSlice.id], apply));
    return disposable(() => subscription.dispose());
  };

// Saved views, level navigation and framing, over the view state this feature owns.
export const navigationAidsFeature: Feature<NavigationState> = feature(
  'navigation-aids',
  navigationSlice,
  navigationCommands,
);
