// The scenes every track measures and tests against, by name.
//
// Three sizes, because three questions keep being asked: does it work at all (a small building a
// person can read in a debugger), does it work at the scale the product brief names (ten thousand
// addressable objects), and does it work at the triangle budget the brief names (a stress scene
// inside ten million triangles). Everything is generated from a seed, so a fixture is reproducible
// on any machine and carries no data anybody licensed.

import {
  defaultBuildingOptions,
  defaultStressOptions,
  generateBuilding,
  generateStressScene,
  type BuildingOptions,
  type StressOptions,
} from '@bim-open-toolkit/synthetic';
import { drawnTriangles, type SceneFixture } from './scene-fixture.js';

// A building fixture from any options: its objects, its geometry and its two schedules.
export const buildingFixture = (
  name: string,
  description: string,
  options: BuildingOptions,
): SceneFixture => {
  const built = generateBuilding(options);
  return {
    name,
    description,
    model: built.model,
    geometry: built.geometry,
    tables: [
      ['roomSchedule', built.roomSchedule],
      ['doorSchedule', built.doorSchedule],
    ],
    triangleCount: drawnTriangles(built.geometry),
  };
};

// A stress fixture from any options. It publishes no tables: it exists to be drawn, not read.
export const stressFixture = (
  name: string,
  description: string,
  options: StressOptions,
): SceneFixture => {
  const built = generateStressScene(options);
  return {
    name,
    description,
    model: built.model,
    geometry: built.geometry,
    tables: [],
    triangleCount: built.triangleCount,
  };
};

// Options for the small building: the synthetic package's own default, three storeys of eight rooms.
export const smallBuildingOptions: BuildingOptions = defaultBuildingOptions;

// Options that reach ten thousand addressable objects. Forty-five storeys of forty-five rooms is
// not a plausible building; it is the cheapest way this generator reaches the count the product
// brief's bulk-update target is stated against.
export const tenThousandObjectOptions: BuildingOptions = {
  ...defaultBuildingOptions,
  seed: 2,
  storeys: 45,
  roomsPerStorey: 45,
};

// Options for the stress scene: ten thousand instances over twenty-four meshes, inside the ten
// million triangle budget the brief names.
export const stressSceneOptions: StressOptions = defaultStressOptions;

// A building small enough to read in a debugger: 150 objects, both schedules with real gaps.
export const smallBuilding = (): SceneFixture =>
  buildingFixture(
    'small-building',
    'Three storeys of eight rooms, with room and door schedules that have gaps and a conflict.',
    smallBuildingOptions,
  );

// A building at the scale the bulk-update target is stated against: over ten thousand objects.
export const tenThousandObjects = (): SceneFixture =>
  buildingFixture(
    'ten-thousand-objects',
    'A building scaled past ten thousand addressable objects, for bulk update and selection work.',
    tenThousandObjectOptions,
  );

// Ten thousand instances inside a ten million triangle budget, with a realistic material mix.
export const stressScene = (): SceneFixture =>
  stressFixture(
    'stress',
    'Ten thousand instances over twenty-four meshes, inside a ten million triangle budget.',
    stressSceneOptions,
  );

// The named fixtures. Each entry is a function, so asking for one never builds the others.
export const sceneFixtures = {
  'small-building': smallBuilding,
  'ten-thousand-objects': tenThousandObjects,
  stress: stressScene,
} as const;

// The name of a fixture in the catalog.
export type SceneFixtureName = keyof typeof sceneFixtures;

// Every fixture name, smallest first. Written out rather than read back from the catalog, because
// reading the keys of an object gives `string`.
export const sceneFixtureNames: readonly SceneFixtureName[] = [
  'small-building',
  'ten-thousand-objects',
  'stress',
];

// Builds one fixture by name.
export const sceneFixture = (name: SceneFixtureName): SceneFixture => sceneFixtures[name]();
