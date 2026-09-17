// The two arrangements the layouts feature does not have yet: the storeys of a building laid side
// by side on the ground, and the rooms of one storey laid side by side.
//
// Both are pure functions of `ModelData` alone, in the same shape the feature uses - a translation
// per object key, measured from where the model placed it - so they go through `layoutTranslations`
// and `writeLayout` unchanged. `layouts.explode` and the model's own placement are delegated to the
// feature's `layoutOffsets`, so this module holds only what is missing.
//
// Track FB owns the real home for these: a `Layout` kind `row` by storey and `row` by room. When
// that lands, `separateOffsets` becomes one call to `layoutOffsets` and this file goes.

import {
  boundsSize,
  objectKey,
  type ModelData,
  type ObjectKey,
  type ObjectRecord,
  type UpAxis,
  type Vec3,
} from '@bim-open-toolkit/model';
import {
  layoutOffsets,
  levelAt,
  levelsOf,
  noLayout,
  placementBounds,
  placementsOf,
} from '@bim-open-toolkit/features';

// Which arrangement a page is showing.
export type SeparateLayout =
  | { readonly kind: 'as-placed' }
  | { readonly kind: 'stacked'; readonly spacing: number }
  | { readonly kind: 'storey-row'; readonly spacing: number }
  | { readonly kind: 'room-row'; readonly storeyId: string; readonly spacing: number };

// The name of an arrangement, which is what a picker and a report carry.
export type LayoutKind = SeparateLayout['kind'];

// Every arrangement, in the order a picker offers them.
export const layoutKinds: readonly LayoutKind[] = ['as-placed', 'stacked', 'storey-row', 'room-row'];

// The name of an arrangement, or undefined when the text is not one.
export const layoutKindOf = (value: string): LayoutKind | undefined =>
  layoutKinds.find((kind) => kind === value);

// The two ground axes and the up axis, for the frame the model reports in.
const axesFor = (up: UpAxis): { readonly first: number; readonly second: number; readonly up: number } =>
  up === 'y' ? { first: 0, second: 2, up: 1 } : { first: 0, second: 1, up: 2 };

// A vector from a ground pair and a height, in the frame's own axis order.
const inFrame = (first: number, second: number, height: number, up: UpAxis): Vec3 =>
  up === 'y' ? [first, height, second] : [first, second, height];

// The categories a room is recorded under, and the categories the lid is made of.
const roomCategories: ReadonlySet<string> = new Set(['room', 'space', 'ifcspace']);
const lidCategories: ReadonlySet<string> = new Set(['roof', 'ceiling', 'ifcroof', 'ifccovering']);

const categoryOf = (record: ObjectRecord): string => (record.category ?? '').trim().toLowerCase();

// The roof and the ceilings: what a viewer takes off to see every storey's interior from above.
export const lidKeys = (model: ModelData): readonly ObjectKey[] =>
  model.objects.filter((record) => lidCategories.has(categoryOf(record))).map((record) => objectKey(record.ref));

// The rooms of a model, in the order the model records them.
export const roomRecords = (model: ModelData): readonly ObjectRecord[] =>
  model.objects.filter((record) => roomCategories.has(categoryOf(record)));

// How far a parent link is followed before the model is taken to be looping.
const linkDepth = 8;

// The storey each object belongs to, by the model's own parent links, falling back to the storey
// the object's own height sits on when a link is missing. Doors reach their storey through the room
// that holds them; a room whose storey link was never recorded is placed by its elevation instead.
export const storeyOfObjects = (model: ModelData): ReadonlyMap<ObjectKey, string> => {
  const levels = levelsOf(model);
  const storeyIds = new Set(levels.map((level) => level.id));
  const byId = new Map(model.objects.map((record) => [record.ref.objectId, record]));
  const component = axesFor(model.coordinates.up).up + 12;
  const found = new Map<ObjectKey, string>();
  for (const record of model.objects) {
    let walked: ObjectRecord | undefined = record;
    let storey: string | undefined;
    for (let step = 0; step < linkDepth && walked !== undefined; step++) {
      if (storeyIds.has(walked.ref.objectId)) {
        storey = walked.ref.objectId;
        break;
      }
      walked = walked.parentId === undefined ? undefined : byId.get(walked.parentId);
    }
    const chosen = storey ?? levelAt(levels, record.transform[component] ?? 0)?.id;
    if (chosen !== undefined) found.set(objectKey(record.ref), chosen);
  }
  return found;
};

// The width one slot of a row takes: the ground extent the things being laid out share, divided by
// how many of them tile it, times the spacing the page asks for. Never below one unit, so a model
// with every object at one point still separates.
const slotStep = (model: ModelData, tilesAcross: number, spacing: number): number => {
  const size = boundsSize(placementBounds(placementsOf(model)));
  const width = size === undefined ? 0 : size[axesFor(model.coordinates.up).first] ?? 0;
  return Math.max(1, width / Math.max(1, tilesAcross)) * spacing;
};

// Offsets that lay the storeys of a building side by side on the ground, lowest first.
//
// Storey N moves to slot N along the first ground axis and down to the lowest storey's elevation,
// so every floor is at the same height and every interior is visible from above at once. The lowest
// storey does not move, which is what makes this measurable against the model's own placement.
// Spacing multiplies the building's own footprint width, so 1 puts the storeys edge to edge.
export const storeyRowOffsets = (model: ModelData, spacing: number): ReadonlyMap<ObjectKey, Vec3> => {
  const offsets = new Map<ObjectKey, Vec3>();
  const levels = levelsOf(model);
  if (levels.length < 2 || !(spacing > 0)) return offsets;
  const step = slotStep(model, 1, spacing);
  const ground = levels[0]?.elevation ?? 0;
  const indexOf = new Map(levels.map((level, index) => [level.id, index]));
  const storeyOf = storeyOfObjects(model);
  for (const placement of placementsOf(model)) {
    const storey = storeyOf.get(placement.key);
    const index = storey === undefined ? 0 : indexOf.get(storey) ?? 0;
    if (index <= 0) continue;
    const drop = ground - (levels[index]?.elevation ?? ground);
    offsets.set(placement.key, inFrame(index * step, 0, drop, model.coordinates.up));
  }
  return offsets;
};

// The mean position of the given objects along one axis, which is where a row of them is centred.
const middleOf = (
  keys: readonly ObjectKey[],
  centers: ReadonlyMap<ObjectKey, Vec3>,
  axis: number,
): number => {
  if (keys.length === 0) return 0;
  let total = 0;
  for (const key of keys) total += centers.get(key)?.[axis] ?? 0;
  return total / keys.length;
};

// The keys of everything the model hangs off each object, by the parent's own object id.
const childrenOf = (model: ModelData): ReadonlyMap<string, readonly ObjectKey[]> => {
  const held = new Map<string, ObjectKey[]>();
  for (const record of model.objects) {
    const parent = record.parentId;
    if (parent === undefined) continue;
    const list = held.get(parent);
    if (list === undefined) held.set(parent, [objectKey(record.ref)]);
    else list.push(objectKey(record.ref));
  }
  return held;
};

// Offsets that lay the rooms of one storey side by side, in the order the model records them.
//
// A room moves with everything the model hangs off it - its doors - so a room and its openings stay
// one thing, and the walls and slabs of the storey stay where they are. The row is centred on the
// storey's own footprint, so the building is still where it was.
export const roomRowOffsets = (
  model: ModelData,
  storeyId: string,
  spacing: number,
): ReadonlyMap<ObjectKey, Vec3> => {
  const offsets = new Map<ObjectKey, Vec3>();
  if (!(spacing > 0)) return offsets;
  const storeyOf = storeyOfObjects(model);
  const rooms = roomRecords(model).filter((record) => storeyOf.get(objectKey(record.ref)) === storeyId);
  if (rooms.length < 2) return offsets;
  const centers = new Map(placementsOf(model).map((placement) => [placement.key, placement.center]));
  const axis = axesFor(model.coordinates.up);
  const step = slotStep(model, Math.ceil(Math.sqrt(rooms.length)), spacing);
  const roomKeys = rooms.map((record) => objectKey(record.ref));
  const middleFirst = middleOf(roomKeys, centers, axis.first);
  const middleSecond = middleOf(roomKeys, centers, axis.second);
  const held = childrenOf(model);
  rooms.forEach((record, slot) => {
    const key = objectKey(record.ref);
    const center = centers.get(key) ?? [0, 0, 0];
    const first = middleFirst + (slot - (rooms.length - 1) / 2) * step - (center[axis.first] ?? 0);
    const second = middleSecond - (center[axis.second] ?? 0);
    const offset = inFrame(first, second, 0, model.coordinates.up);
    offsets.set(key, offset);
    for (const child of held.get(record.ref.objectId) ?? []) offsets.set(child, offset);
  });
  return offsets;
};

// The translation each object gets under one of the page's arrangements. The two the layouts
// feature already has go through its own `layoutOffsets`; the two rows are this module's.
export const separateOffsets = (model: ModelData, layout: SeparateLayout): ReadonlyMap<ObjectKey, Vec3> => {
  switch (layout.kind) {
    case 'as-placed':
      return layoutOffsets(model, noLayout);
    case 'stacked':
      return layoutOffsets(model, { kind: 'explode', by: 'storey', strength: layout.spacing });
    case 'storey-row':
      return storeyRowOffsets(model, layout.spacing);
    case 'room-row':
      return roomRowOffsets(model, layout.storeyId, layout.spacing);
  }
};
