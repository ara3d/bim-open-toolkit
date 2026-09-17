// The models the page offers. Pure, and free of any renderer, canvas or DOM.
//
// Three synthetic scenes at three scales, because the one setting the pass has to get right is its
// radius, and a radius chosen from the model's bounds is only shown to be right by trying it on
// models of different sizes. The stress scene is cut down from the generator's default so that a
// software renderer can draw it inside a test's patience.

import { objectKey, type Geometry, type ModelData, type ObjectKey } from '@bim-open-toolkit/model';
import {
  defaultBuildingOptions,
  defaultCityOptions,
  defaultStressOptions,
  generateBuilding,
  generateCity,
  generateStressScene,
} from '@bim-open-toolkit/synthetic';

// The names the fixture picker offers, in the order it lists them. The first is the default.
export const fixtureNames = ['building', 'city', 'stress'] as const;

// One of the page's fixtures.
export type FixtureName = (typeof fixtureNames)[number];

// What the page needs to draw a fixture: the geometry, the key of each object ordinal, and the id
// the scene binding files the model under.
export type DemoFixture = {
  readonly name: FixtureName;
  readonly title: string;
  readonly modelId: string;
  readonly geometry: Geometry;
  readonly keys: readonly ObjectKey[];
};

// The object key of each object ordinal, in the order `Geometry.instances.objectIndex` counts.
export const objectKeys = (model: ModelData): readonly ObjectKey[] =>
  model.objects.map((record) => objectKey(record.ref));

const fixtureOf = (name: FixtureName, title: string, model: ModelData, geometry: Geometry): DemoFixture => ({
  name,
  title,
  modelId: model.ref.id,
  geometry,
  keys: objectKeys(model),
});

// The stress scene the page draws: two thousand instances inside a million triangles, which a
// software renderer draws in seconds rather than minutes.
export const demoStressOptions = {
  ...defaultStressOptions,
  instances: 2000,
  triangleBudget: 1_000_000,
  maxMeshTriangles: 2048,
};

// Builds one fixture by name. Each is deterministic, so the page is the same on every run.
export const demoFixture = (name: FixtureName): DemoFixture => {
  switch (name) {
    case 'building': {
      const building = generateBuilding(defaultBuildingOptions);
      return fixtureOf(name, 'One building, 150 objects', building.model, building.geometry);
    }
    case 'city': {
      const city = generateCity(defaultCityOptions);
      return fixtureOf(name, 'A city of six buildings', city.model, city.geometry);
    }
    case 'stress': {
      const stress = generateStressScene(demoStressOptions);
      return fixtureOf(name, 'Stress, 2,000 instances', stress.model, stress.geometry);
    }
  }
};

// The fixture the page opens with.
export const defaultFixtureName: FixtureName = 'building';

// Whether a string names one of the page's fixtures.
export const isFixtureName = (value: string): value is FixtureName =>
  fixtureNames.some((name) => name === value);
