// The synthetic building the four Inspect demos open, and the derivations all four read: the
// object record and the facts of each object, the box each object occupies, the storey each object
// belongs to, and one table of the columns a colouring can use.
//
// It lives in this demo directory because the Inspect chapter has no shared module of its own:
// `demos/src/demos/_shared` belongs to Track GAL. Moving it there is a request in CHECKPOINT-D1.md;
// the other three demos import it from here until that happens.
//
// Generation is deterministic, so the building is generated once and kept. A demo's inspector runs
// after every change event and cannot afford to generate it again.

import {
  boundsCenter,
  emptyBounds,
  expandBounds,
  f64Column,
  failure,
  indexFacts,
  instanceTransform,
  isEmptyBounds,
  objectKey,
  stringColumn,
  styleRule,
  success,
  table,
  transformBounds,
  transformPoint,
  unionBounds,
  type Bounds,
  type Fact,
  type FactIndex,
  type Geometry,
  type ModelData,
  type ObjectKey,
  type ObjectRecord,
  type Result,
  type Session,
  type StyleRule,
  type Table,
  type Vec3,
} from '@bim-open-toolkit/model';
import {
  defaultBuildingOptions,
  generateBuilding,
  type Building,
  type BuildingOptions,
} from '@bim-open-toolkit/synthetic';
import type { DemoFixture, ModelSource } from '../../gallery/contracts.js';

// The building every Inspect demo opens: the generator's own default, three storeys of eight rooms
// with the documented share of missing and disputed door facts.
export const inspectBuildingOptions: BuildingOptions = defaultBuildingOptions;

// One storey and everything that belongs to it.
export type Storey = {
  readonly key: ObjectKey;
  readonly objectId: string;
  readonly name: string;
  readonly members: readonly ObjectKey[];
  readonly bounds: Bounds;
};

// The building with the lookups the demos read. Every map is addressed by object key, which is what
// sets, style rules and picks all speak.
export type InspectIndex = {
  readonly building: Building;
  // Object keys in the order `ModelData.objects` holds them.
  readonly keys: readonly ObjectKey[];
  readonly records: ReadonlyMap<ObjectKey, ObjectRecord>;
  readonly facts: FactIndex;
  // The box an object occupies, or the point it sits at when it draws nothing.
  readonly bounds: ReadonlyMap<ObjectKey, Bounds>;
  // The storey an object belongs to, absent when nothing links it to one.
  readonly storeyOf: ReadonlyMap<ObjectKey, ObjectKey>;
  readonly storeys: readonly Storey[];
};

// A command a demo dispatches, as plain data, so an opening sequence can be read and tested before
// anything is drawn.
export type CommandCall = { readonly command: string; readonly input: unknown };

// The name the generator records a door's nominal and clear width and fire rating under.
export const doorFactNames: readonly string[] = ['nominalWidth', 'clearWidth', 'fireRating'];

// The category that stands between a viewer and the doors: the generator cuts no opening, so a door
// leaf sits entirely inside its wall.
export const enclosureCategory = 'Wall';

const objectRowsByObjectId = (model: ModelData): ReadonlyMap<string, ObjectRecord> =>
  new Map(model.objects.map((record) => [record.ref.objectId, record]));

// The storey a record belongs to, found by walking parent links. The walk is bounded by the number
// of objects, so a cycle in the data cannot hang the gallery.
const storeyIdOf = (
  byObjectId: ReadonlyMap<string, ObjectRecord>,
  record: ObjectRecord,
  limit: number,
): string | undefined => {
  let current: ObjectRecord | undefined = record;
  for (let step = 0; step < limit && current !== undefined; step += 1) {
    if (current.category === 'Storey') return current.ref.objectId;
    const parentId: string | undefined = current.parentId;
    current = parentId === undefined ? undefined : byObjectId.get(parentId);
  }
  return undefined;
};

// The box each object occupies, unioned over every instance row that draws it. An object that draws
// nothing gets the point its transform places it at, which is where a tag anchors.
const boundsByKey = (model: ModelData, geometry: Geometry): ReadonlyMap<ObjectKey, Bounds> => {
  const boxes = model.objects.map(() => emptyBounds);
  const instances = geometry.instances;
  for (let row = 0; row < instances.count; row += 1) {
    const meshIndex = instances.meshIndex[row] ?? -1;
    const objectIndex = instances.objectIndex[row] ?? -1;
    const source = geometry.meshes[meshIndex];
    const held = boxes[objectIndex];
    if (source === undefined || held === undefined) continue;
    boxes[objectIndex] = unionBounds(held, transformBounds(instanceTransform(instances, row), source.bounds));
  }
  return new Map(
    model.objects.map((record, index) => {
      const box = boxes[index] ?? emptyBounds;
      const origin: Vec3 = transformPoint(record.transform, [0, 0, 0]);
      return [objectKey(record.ref), isEmptyBounds(box) ? expandBounds(emptyBounds, origin) : box];
    }),
  );
};

const storeysOf = (
  model: ModelData,
  storeyOf: ReadonlyMap<ObjectKey, ObjectKey>,
  bounds: ReadonlyMap<ObjectKey, Bounds>,
): readonly Storey[] =>
  model.objects
    .filter((record) => record.category === 'Storey')
    .map((record) => {
      const key = objectKey(record.ref);
      const members = [...storeyOf].filter(([, storey]) => storey === key).map(([member]) => member);
      const box = members.reduce(
        (whole, member) => unionBounds(whole, bounds.get(member) ?? emptyBounds),
        bounds.get(key) ?? emptyBounds,
      );
      return { key, objectId: record.ref.objectId, name: record.name ?? record.ref.objectId, members, bounds: box };
    });

const buildIndex = (building: Building): InspectIndex => {
  const model = building.model;
  const byObjectId = objectRowsByObjectId(model);
  const limit = model.objects.length + 1;
  const storeyOf = new Map<ObjectKey, ObjectKey>();
  for (const record of model.objects) {
    const storeyId = storeyIdOf(byObjectId, record, limit);
    const storey = storeyId === undefined ? undefined : byObjectId.get(storeyId);
    if (storey !== undefined) storeyOf.set(objectKey(record.ref), objectKey(storey.ref));
  }
  const bounds = boundsByKey(model, building.geometry);
  return {
    building,
    keys: model.objects.map((record) => objectKey(record.ref)),
    records: new Map(model.objects.map((record) => [objectKey(record.ref), record])),
    facts: indexFacts(building.facts),
    bounds,
    storeyOf,
    storeys: storeysOf(model, storeyOf, bounds),
  };
};

let held: InspectIndex | undefined;

// The building and its lookups, generated on first use and kept for the life of the page.
export const inspectIndex = (): InspectIndex => {
  const already = held;
  if (already !== undefined) return already;
  const made = buildIndex(generateBuilding(inspectBuildingOptions));
  held = made;
  return made;
};

// The synthetic building as a fixture: nothing is generated until it is chosen.
export const buildingFixture: DemoFixture = {
  id: 'synthetic-building',
  title: 'Synthetic building, three storeys of eight rooms',
  basis: 'synthetic',
  source: () => {
    const index = inspectIndex();
    const source: ModelSource = {
      kind: 'data',
      id: index.building.model.ref.id,
      data: index.building.model,
      geometry: index.building.geometry,
    };
    return Promise.resolve(success(source));
  },
};

// The objects of one category, in model order.
export const keysOfCategory = (index: InspectIndex, category: string): readonly ObjectKey[] =>
  index.keys.filter((key) => index.records.get(key)?.category === category);

// The walls, which are what hides the doors.
export const wallKeys = (index: InspectIndex): readonly ObjectKey[] => keysOfCategory(index, enclosureCategory);

// The id of the rule that takes the walls away.
export const hideWallsRuleId = 'inspect/hide-walls';

// Takes the walls away so the doors inside them can be seen. Hiding rather than ghosting, because a
// wall drawn at low opacity still writes depth and hides the leaf behind it.
export const hideWallsRule = (index: InspectIndex): StyleRule =>
  styleRule(hideWallsRuleId, 'Walls hidden so the doors show', wallKeys(index), { visible: false }, 10);

// The centre of an object's box, or undefined when nothing is known about where it is.
export const centreOf = (index: InspectIndex, key: ObjectKey): Vec3 | undefined => {
  const box = index.bounds.get(key);
  return box === undefined ? undefined : boundsCenter(box);
};

// The name of the storey an object belongs to, or undefined when nothing links it to one. A room
// whose storey link was lost reads as undefined rather than as a guessed level.
export const storeyNameOf = (index: InspectIndex, key: ObjectKey): string | undefined => {
  const storey = index.storeyOf.get(key);
  return storey === undefined ? undefined : index.records.get(storey)?.name;
};

// Every fact recorded about an object, in the order the generator recorded them.
export const factsOf = (index: InspectIndex, key: ObjectKey): readonly Fact[] => [
  ...(index.facts.get(key)?.values() ?? []),
];

// The known nominal width of a door in millimetres, or NaN when it was never recorded or the
// sources disagree. NaN rather than zero, so a colouring paints it as missing instead of as narrow.
export const nominalWidthMm = (index: InspectIndex, key: ObjectKey): number => {
  const observation = index.facts.get(key)?.get('nominalWidth')?.observation;
  if (observation === undefined || observation.kind !== 'known') return Number.NaN;
  return observation.value.kind === 'quantity' ? observation.value.quantity.value : Number.NaN;
};

// The columns a colouring reads: one row per object, addressed by object key. A value nobody
// recorded is the empty string or NaN, never a substitute.
export const objectTable = (index: InspectIndex): Table =>
  table([
    ['key', stringColumn([...index.keys])],
    ['objectId', stringColumn(index.keys.map((key) => index.records.get(key)?.ref.objectId ?? ''))],
    ['category', stringColumn(index.keys.map((key) => index.records.get(key)?.category ?? ''))],
    ['name', stringColumn(index.keys.map((key) => index.records.get(key)?.name ?? ''))],
    ['storey', stringColumn(index.keys.map((key) => storeyNameOf(index, key) ?? ''))],
    ['nominalWidthMm', f64Column(index.keys.map((key) => nominalWidthMm(index, key)))],
  ]);

// Runs a sequence of commands, stopping at the first one the session refuses.
export const runCalls = (session: Session, calls: readonly CommandCall[]): Result<number> => {
  for (const call of calls) {
    const result = session.dispatch(call.command, call.input);
    if (!result.ok) return failure(result.diagnostics);
  }
  return success(calls.length);
};
