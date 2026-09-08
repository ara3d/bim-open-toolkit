// Step one of the slice: build the data. Pure, and free of any renderer, canvas or DOM.
//
// Everything the page draws and reports comes from one seeded building. The three derived pieces -
// the object key of each object ordinal, the appearance each object starts with, and the doors
// whose fire rating is missing or disputed - are what the render and style packages need next, and
// none of them is produced by the packages that own the inputs.

import {
  defaultAppearance,
  objectKey,
  type Appearance,
  type Coverage,
  type Fact,
  type ModelData,
  type ObjectKey,
} from '@bim-open-toolkit/model';
import {
  defaultBuildingOptions,
  generateBuilding,
  type Building,
  type BuildingOptions,
} from '@bim-open-toolkit/synthetic';

// The name the building generator records a door's fire rating under.
export const fireRatingName = 'fireRating';

// The building the page shows: the generator's own default, so the page is the same on every run.
export const sliceOptions: BuildingOptions = defaultBuildingOptions;

// A building with the three derived pieces the rest of the slice reads.
export type SliceData = {
  readonly building: Building;
  // Object key of each object ordinal, which is what `buildInstanceTable` addresses rows by.
  readonly keys: readonly ObjectKey[];
  // The appearance each object starts with, so resolving styles restores it rather than the grey
  // fallback.
  readonly base: ReadonlyMap<ObjectKey, Appearance>;
  // The fire-rating fact of each door, by object key.
  readonly fireRatings: ReadonlyMap<ObjectKey, Fact>;
  // Doors whose fire rating is missing or disputed, in schedule order.
  readonly unratedDoors: readonly ObjectKey[];
  // The walls a door is set into. The generator cuts no opening, so a door leaf is
  // entirely inside its wall and cannot be seen until these are taken away.
  readonly enclosure: readonly ObjectKey[];
  // How complete the fire ratings are, over every door.
  readonly coverage: Coverage;
};

// The object key of each object ordinal, in the order `Geometry.instances.objectIndex` counts.
export const objectKeys = (model: ModelData): readonly ObjectKey[] =>
  model.objects.map((record) => objectKey(record.ref));

// The appearance each object carries in the model, or the grey fallback where it carries none.
export const baseAppearances = (model: ModelData): ReadonlyMap<ObjectKey, Appearance> =>
  new Map(model.objects.map((record) => [objectKey(record.ref), record.appearance ?? defaultAppearance]));

// The fire-rating fact of each door, by the key of the door it is about.
export const fireRatingFacts = (building: Building): ReadonlyMap<ObjectKey, Fact> =>
  new Map(
    building.facts
      .filter((item) => item.name === fireRatingName)
      .map((item) => [objectKey(item.subject), item]),
  );

// The doors a reviewer has to chase: no fire rating was recorded, or the sources disagree.
// A rating that does not apply is still counted here, because the observation is `missing`; the
// page reports how many of them there are so that the two cases are told apart.
export const unratedDoorKeys = (facts: ReadonlyMap<ObjectKey, Fact>): readonly ObjectKey[] =>
  [...facts].filter(([, item]) => item.observation.kind !== 'known').map(([key]) => key);

// The category that stands between a viewer and the doors: a door leaf is modelled inside its
// wall, with no opening cut. Slabs are left alone, so the storeys stay readable.
export const enclosureCategories: readonly string[] = ['Wall'];

// The objects that hide the doors, by object key.
export const enclosureKeys = (model: ModelData): readonly ObjectKey[] =>
  model.objects
    .filter((record) => record.category !== undefined && enclosureCategories.includes(record.category))
    .map((record) => objectKey(record.ref));

// The building and everything derived from it.
export const sliceData = (options: BuildingOptions = sliceOptions): SliceData => {
  const building = generateBuilding(options);
  const fireRatings = fireRatingFacts(building);
  return {
    building,
    keys: objectKeys(building.model),
    base: baseAppearances(building.model),
    fireRatings,
    unratedDoors: unratedDoorKeys(fireRatings),
    enclosure: enclosureKeys(building.model),
    coverage: building.doorCoverage.fireRating,
  };
};
