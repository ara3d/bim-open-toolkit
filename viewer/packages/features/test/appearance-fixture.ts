// The scene and the session every Track FA test runs against.
//
// The scene is a real `SceneBinding` over a real viewer-core `ViewerScene`: typed-array buffers,
// counts and version numbers, none of which needs a WebGL context. A render-hook assertion can
// therefore read the colour and the visibility a feature actually wrote into the group buffers,
// rather than trusting a double that records calls.

import { ViewerScene } from '@ara3d/viewer-core';
import {
  instanceRecords,
  mesh,
  modelIdentity,
  objectKey,
  objectRef,
  stringColumn,
  table,
  translation,
  type Geometry,
  type InstanceRecord,
  type ModelRef,
  type ObjectKey,
  type Table,
} from '@bim-open-toolkit/model';
import {
  SceneBinding,
  alphaChannel,
  colorOfRow,
  representationRegistry,
  representation,
  type DrawnRepresentation,
  type InstanceTable,
  type RepresentationRegistry,
  type RepresentationTarget,
} from '@bim-open-toolkit/render';
import { appearanceCommands } from '../src/appearance.js';
import { sceneRenderTarget, type RenderTarget } from '../src/appearance-render.js';
import { editsCommands } from '../src/edits.js';
import { replacementCommands } from '../src/replacement.js';
import { setsCommands } from '../src/sets.js';
import { fakeSession, type FakeSession } from './support/fake-session.js';

// The model every fixture object belongs to.
export const fixtureModel: ModelRef = modelIdentity({ id: 'fa-fixture', revision: '1' });

// Object key of the nth fixture object.
export const key = (index: number): ObjectKey => objectKey(objectRef(fixtureModel, `object-${index}`));

// The three fixture objects, in ordinal order.
export const fixtureKeys: readonly ObjectKey[] = [key(0), key(1), key(2)];

// The id the fixture model is bound under.
export const fixtureModelId = 'fa-fixture';

const unitCube = () => {
  const corners: readonly (readonly [number, number, number])[] = [
    [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
    [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1],
  ];
  const faces = [
    0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6, 0, 4, 5, 0, 5, 1,
    1, 5, 6, 1, 6, 2, 2, 6, 7, 2, 7, 3, 3, 7, 4, 3, 4, 0,
  ];
  return mesh(new Float32Array(corners.flatMap((corner) => [...corner])), Uint32Array.from(faces));
};

// Three objects, one instance each, one shared cube prototype: the smallest scene that can show a
// replacement leaving the other instances of the same mesh alone.
export const fixtureGeometry = (): Geometry => {
  const rows: readonly InstanceRecord[] = fixtureKeys.map((_unused, index) => ({
    meshIndex: 0,
    transform: translation([index * 2, 0, 0]),
    color: [1, 1, 1],
    opacity: 1,
    objectIndex: index,
  }));
  return { meshes: [unitCube()], instances: instanceRecords(rows) };
};

// A bound scene and the render target over it.
export type BoundScene = {
  readonly binding: SceneBinding;
  readonly instances: InstanceTable;
  readonly target: RenderTarget;
  // The stored red, green, blue and alpha of one object's single row.
  readonly colorOf: (index: number) => readonly number[];
  // Whether the object's row is drawn: the stored alpha, which hiding writes to zero.
  readonly shown: (index: number) => boolean;
};

// A scene with the three fixture objects in it.
export const boundScene = (): BoundScene => {
  const binding = new SceneBinding(new ViewerScene());
  const built = binding.addModel(fixtureModelId, fixtureGeometry(), fixtureKeys);
  if (!built.ok) throw new Error('the fixture model did not bind');
  const instances = built.value;
  const colorOf = (index: number): readonly number[] => colorOfRow(instances, index);
  return {
    binding,
    instances,
    target: sceneRenderTarget(binding),
    colorOf,
    shown: (index) => (colorOf(index)[alphaChannel] ?? 0) > 0,
  };
};

// A colour as a Float32Array holds it, which is what a comparison with a stored value needs.
export const stored = (color: readonly number[]): readonly number[] => color.map((value) => Math.fround(value));

// A session holding every Track FA command, so a test dispatches across features as a UI would.
export const featureSession = (): FakeSession =>
  fakeSession([...editsCommands, ...setsCommands, ...appearanceCommands, ...replacementCommands]);

// A representation target that keeps what it was last handed.
export type RecordingRepresentations = RepresentationTarget & {
  readonly drawn: () => readonly DrawnRepresentation[];
};

// A representation target a test reads back.
export const recordingRepresentations = (): RecordingRepresentations => {
  let held: readonly DrawnRepresentation[] = [];
  return {
    setDrawn: (items) => {
      held = items;
    },
    drawn: () => held,
  };
};

// A registry holding one named box-sized stand-in.
export const fixtureRegistry = (id = 'box'): RepresentationRegistry => {
  const built = representationRegistry([representation(id, unitCube())]);
  if (!built.ok) throw new Error('the fixture registry did not build');
  return built.value;
};

// A one-column table of object keys and their category, which is what a category colouring reads.
export const categoryTable = (values: readonly (readonly [ObjectKey, string])[]): Table =>
  table([
    ['key', stringColumn(values.map(([held]) => held))],
    ['category', stringColumn(values.map(([, value]) => value))],
  ]);
