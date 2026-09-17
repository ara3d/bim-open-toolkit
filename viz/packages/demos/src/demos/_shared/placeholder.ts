// The gallery's first pixels: the synthetic building drawn, the doors with no agreed fire rating
// painted red, and one of them tagged with a leader line that follows it as the camera moves.
//
// It is registered only when no real demo has been written yet, so it disappears the moment Track
// D1 lands `point-and-read`. It exists to prove the host end to end - discovery, the viewer, the
// feature host, a command, a style pass and the world-to-canvas projection - with nothing in it
// that a demo would not also do.
//
// The tag is a positioned DOM element rather than the Gratify `Tag` widget, because `ui-gratify`
// has not published `hostPanel` yet. When it does, this becomes a `HudPanel` at a `world` place and
// the reprojection below goes away.

import {
  boolean,
  command,
  diagnostic,
  failure,
  feature,
  number,
  object,
  objectKey,
  resolveStyles,
  setOf,
  stateSlice,
  string,
  styleComposition,
  styleRule,
  success,
  type AnyFeature,
  type Appearance,
  type Coverage,
  type Disposable,
  type ModelData,
  type ObjectKey,
  type ObjectRecord,
  type ResolvedStyles,
  type Result,
  type Session,
  type Vec3,
} from '@bim-open-toolkit/model';
import { defaultBuildingOptions, generateBuilding, type Building } from '@bim-open-toolkit/synthetic';
import type { Demo, DemoFixture, GalleryViewer, ModelSource } from '../../gallery/contracts.js';

// The name the building generator records a door's fire rating under.
const fireRatingName = 'fireRating';

// The category that stands between a viewer and the doors: a door leaf is modelled inside its wall
// with no opening cut, so nothing painted on it can be seen while the wall is drawn.
const enclosureCategory = 'Wall';

// What the demo shows, and the one thing a person can change about it.
type PlaceholderState = {
  readonly drawn: boolean;
  readonly hideWalls: boolean;
  readonly doors: number;
  readonly unratedDoors: number;
  // The object key the tag is pinned to, or the empty string while nothing is tagged.
  readonly taggedDoor: string;
};

const emptyState: PlaceholderState = {
  drawn: false,
  hideWalls: true,
  doors: 0,
  unratedDoors: 0,
  taggedDoor: '',
};

const placeholderSlice = stateSlice<PlaceholderState>(
  'demos/placeholder',
  1,
  object({
    drawn: boolean(),
    hideWalls: boolean(),
    doors: number(),
    unratedDoors: number(),
    taggedDoor: string(),
  }),
  emptyState,
);

// The one thing a person can change: whether the walls are drawn. The command writes state; the
// demo's own subscription repaints, so nothing about the renderer is in the command.
const hideWallsCommand = command<{ readonly hidden: boolean }>({
  name: 'placeholder/hide-walls',
  title: 'Hide the walls',
  description: 'Hides the walls so the doors inside them can be seen, or draws them again.',
  input: object({ hidden: boolean() }),
  run: (session, input) => {
    session.write(placeholderSlice, { ...session.read(placeholderSlice), hideWalls: input.hidden });
    return success(input.hidden);
  },
});

export const placeholderFeature: AnyFeature = feature('demos/placeholder', placeholderSlice, [hideWallsCommand]);

// The building, generated once. It is seeded, so the fixture and the demo see the same data.
let held: Building | undefined;
const building = (): Building => {
  held ??= generateBuilding(defaultBuildingOptions);
  return held;
};

// The doors a reviewer has to chase: no fire rating was recorded, or the sources disagree.
export const unratedDoorKeys = (source: Building): readonly ObjectKey[] =>
  source.facts
    .filter((fact) => fact.name === fireRatingName && fact.observation.kind !== 'known')
    .map((fact) => objectKey(fact.subject));

// The objects that hide the doors.
export const enclosureKeys = (model: ModelData): readonly ObjectKey[] =>
  model.objects.filter((record) => record.category === enclosureCategory).map((record) => objectKey(record.ref));

// Where an object sits, taken from the translation of its placement.
export const originOf = (record: ObjectRecord): Vec3 => [
  record.transform[12],
  record.transform[13],
  record.transform[14],
];

// How complete the fire ratings are, over every door.
const coverage = (source: Building): Coverage => source.doorCoverage.fireRating;

const fixture: DemoFixture = {
  id: 'building',
  title: 'Synthetic building, three storeys',
  basis: 'synthetic',
  source: (): Promise<Result<ModelSource>> =>
    Promise.resolve(
      success<ModelSource>({
        kind: 'data',
        id: 'building',
        data: building().model,
        geometry: building().geometry,
      }),
    ),
};

// Every object as it looks now: the unrated doors red, the walls optionally taken away, nothing
// selected. The base map is what stops `resolveStyles` painting the whole model grey.
const paint = (base: ReadonlyMap<ObjectKey, Appearance>, hideWalls: boolean): ResolvedStyles => {
  const source = building();
  const rules = [
    ...(hideWalls
      ? [styleRule('hide-enclosure', 'Walls hidden so the doors show', enclosureKeys(source.model), { visible: false })]
      : []),
    styleRule('unrated-doors', 'Doors with no agreed fire rating', unratedDoorKeys(source), { color: [1, 0, 0] }),
  ];
  return resolveStyles(styleComposition(base, [], rules, setOf([])), [...base.keys()]);
};

// The tag: a label and a leader line, put over the viewport and moved to the projected point on
// every frame. `undefined` from `project` means the point is behind the camera, and the tag hides.
const pinTag = (viewer: GalleryViewer, point: Vec3, text: string): Disposable => {
  const tag = document.createElement('div');
  tag.className = 'gallery-tag';
  tag.textContent = text;
  viewer.viewport.append(tag);
  const frames = viewer.onFrame(() => {
    const at = viewer.project(point);
    if (at === undefined) {
      tag.hidden = true;
      return;
    }
    tag.hidden = false;
    tag.style.transform = `translate(${String(Math.round(at[0]))}px, ${String(Math.round(at[1]))}px)`;
  });
  return {
    dispose: () => {
      frames.dispose();
      tag.remove();
    },
  };
};

export const demo: Demo = {
  id: 'placeholder',
  chapter: 'inspect',
  title: 'The building, and one door nobody rated',
  question: 'Does the gallery draw a model, navigate it and point at something inside it?',
  briefIds: ['F27'],
  features: [placeholderFeature],
  fixtures: [fixture],
  panels: [],
  start: async (viewer: GalleryViewer) => {
    const model = viewer.opened()[0];
    if (model === undefined)
      return failure([
        diagnostic('placeholder/no-model', 'No model was opened before the demo started', ['fixtures']),
      ]);
    const source = building();
    const unrated = unratedDoorKeys(source);
    const repaint = (): void => {
      const state = viewer.read(placeholderSlice);
      viewer.applyStyles(model.modelId, paint(model.base, state.hideWalls));
    };

    const tagged = unrated[0];
    const record = source.model.objects.find((one) => objectKey(one.ref) === tagged);
    viewer.write(placeholderSlice, {
      drawn: true,
      hideWalls: true,
      doors: coverage(source).total,
      unratedDoors: unrated.length,
      taggedDoor: tagged ?? '',
    });
    repaint();
    const repaints = viewer.subscribe((event) => {
      if (event.changed.includes(placeholderSlice.id)) repaint();
    });
    const tag =
      record === undefined
        ? undefined
        : pinTag(viewer, originOf(record), `${record.name ?? 'Door'} · no agreed fire rating`);
    return success<Disposable>({
      dispose: () => {
        tag?.dispose();
        repaints.dispose();
      },
    });
  },
  ready: (session: Session) => session.read(placeholderSlice).drawn,
  report: (session: Session) => {
    const state = session.read(placeholderSlice);
    return {
      drawn: state.drawn,
      hideWalls: state.hideWalls,
      doors: state.doors,
      unratedDoors: state.unratedDoors,
      taggedDoor: state.taggedDoor,
    };
  },
  source: 'viewer/packages/demos/src/demos/_shared/placeholder.ts',
  verify: 'npx vitest run --root packages/demos test/gallery',
};
