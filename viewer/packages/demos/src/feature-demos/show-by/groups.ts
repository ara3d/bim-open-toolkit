// The groups an object can be shown by, derived from a model alone: the storeys a building has,
// the rooms in them, and the categories its objects are recorded under.
//
// Membership follows the `parentId` chain, not geometry: a door hangs off its room and through the
// room off a storey, everything else hangs off its storey. The storey list itself is the navigation
// aid's `levelsOf`, so the page and a level picker can never disagree about what a storey is.
//
// The building generator drops a documented share of the rooms' storey links, so a chain that
// reaches no storey is a fact about the data rather than a bug. Those objects are collected in the
// "unassigned" group and shown as such; dropping them would let the pickers claim fewer objects
// than the model holds.

import { objectKey, type ModelData, type ObjectKey, type ObjectRecord } from '@bim-open-toolkit/model';
import { levelsOf, type Level } from '@bim-open-toolkit/features';

// What an object can be shown by.
export type GroupKind = 'storey' | 'room' | 'category';

// The three kinds, in the order the page's pickers stand.
export const groupKinds = ['storey', 'room', 'category'] as const;

// The storey group holding every object whose storey link is missing.
export const unassignedStoreyId = 'unassigned';

// What that group is called.
export const unassignedStoreyLabel = 'Unassigned';

// The category an object with no recorded category is grouped under.
export const noCategoryLabel = 'No category';

// One group: how to name it in a picker, and the objects it holds.
export type ObjectGroup = {
  readonly kind: GroupKind;
  readonly id: string;
  readonly label: string;
  readonly members: readonly ObjectKey[];
  readonly count: number;
};

// Every group of every kind, each list in the order its picker shows it: storeys by elevation,
// rooms in model order, categories by name.
export type ShowGroups = {
  readonly storeys: readonly ObjectGroup[];
  readonly rooms: readonly ObjectGroup[];
  readonly categories: readonly ObjectGroup[];
};

// Where one object sits, for a status line: its own name and category, and the storey and room
// whose groups hold it. An empty storey or room means the chain reached none.
export type ObjectPlace = {
  readonly name: string;
  readonly category: string;
  readonly storey: string;
  readonly room: string;
};

// True when the record is a room, whatever case the category was written in.
const isRoom = (record: ObjectRecord): boolean => (record.category ?? '').trim().toLowerCase() === 'room';

// The category a record is grouped under, which is its own when it has one.
const categoryOf = (record: ObjectRecord): string => {
  const written = (record.category ?? '').trim();
  return written === '' ? noCategoryLabel : written;
};

// What a record is called in a picker or a status line.
const labelOf = (record: ObjectRecord): string => record.name ?? record.ref.objectId;

// The room and the storey one object's parent chain reaches, each undefined when it reaches none.
type Placement = { readonly roomId: string | undefined; readonly storeyId: string | undefined };

// Walks the chain once, taking the first room and the first storey on it. A record is its own room
// or storey. A chain that loops back on itself stops rather than spinning.
const placementOf = (
  byId: ReadonlyMap<string, ObjectRecord>,
  storeyIds: ReadonlySet<string>,
  record: ObjectRecord,
): Placement => {
  const seen = new Set<string>();
  let roomId: string | undefined;
  let storeyId: string | undefined;
  let current: ObjectRecord | undefined = record;
  while (current !== undefined && !seen.has(current.ref.objectId)) {
    const id = current.ref.objectId;
    seen.add(id);
    if (roomId === undefined && isRoom(current)) roomId = id;
    if (storeyId === undefined && storeyIds.has(id)) storeyId = id;
    // Annotated because the loop assigns `current` from this, which is a circular inference.
    const parentId: string | undefined = current.parentId;
    current = parentId === undefined ? undefined : byId.get(parentId);
  }
  return { roomId, storeyId };
};

// Every object's placement, in `model.objects` order.
const placementsOf = (model: ModelData, levels: readonly Level[]): readonly Placement[] => {
  const byId = new Map(model.objects.map((record) => [record.ref.objectId, record]));
  const storeyIds = new Set(levels.map((level) => level.id));
  return model.objects.map((record) => placementOf(byId, storeyIds, record));
};

const group = (kind: GroupKind, id: string, label: string, members: readonly ObjectKey[]): ObjectGroup => ({
  kind,
  id,
  label,
  members,
  count: members.length,
});

// The object keys held under each id a picker returns for an object, in model order.
const membersById = (
  keys: readonly ObjectKey[],
  idOf: (index: number) => string | undefined,
): ReadonlyMap<string, readonly ObjectKey[]> => {
  const held = new Map<string, ObjectKey[]>();
  keys.forEach((key, index) => {
    const id = idOf(index);
    if (id === undefined) return;
    const list = held.get(id);
    if (list === undefined) held.set(id, [key]);
    else list.push(key);
  });
  return held;
};

// The groups a model offers. Every object is in exactly one storey group and one category group,
// and in a room group only when its chain reaches a room.
export const groupsOf = (model: ModelData): ShowGroups => {
  const levels = levelsOf(model);
  const where = placementsOf(model, levels);
  const keys = model.objects.map((record) => objectKey(record.ref));
  const byStorey = membersById(keys, (index) => where[index]?.storeyId ?? unassignedStoreyId);
  const byRoom = membersById(keys, (index) => where[index]?.roomId);
  const byCategory = membersById(keys, (index) => {
    const record = model.objects[index];
    return record === undefined ? undefined : categoryOf(record);
  });
  const unassigned = byStorey.get(unassignedStoreyId) ?? [];
  return {
    storeys: [
      ...levels.map((level) => group('storey', level.id, level.name, byStorey.get(level.id) ?? [])),
      ...(unassigned.length > 0 ? [group('storey', unassignedStoreyId, unassignedStoreyLabel, unassigned)] : []),
    ],
    rooms: model.objects
      .filter(isRoom)
      .map((record) => group('room', record.ref.objectId, labelOf(record), byRoom.get(record.ref.objectId) ?? [])),
    categories: [...byCategory.keys()]
      .sort()
      .map((name) => group('category', name, name, byCategory.get(name) ?? [])),
  };
};

// The groups of one kind, so a picker and a command can name a kind rather than a field.
export const groupsOfKind = (groups: ShowGroups, kind: GroupKind): readonly ObjectGroup[] =>
  kind === 'storey' ? groups.storeys : kind === 'room' ? groups.rooms : groups.categories;

// One group, or undefined when nothing of that kind is named that.
export const findGroup = (groups: ShowGroups, kind: GroupKind, id: string): ObjectGroup | undefined =>
  groupsOfKind(groups, kind).find((item) => item.id === id);

// Where every object sits, for the line a click writes.
export const placesOf = (model: ModelData): ReadonlyMap<ObjectKey, ObjectPlace> => {
  const levels = levelsOf(model);
  const where = placementsOf(model, levels);
  const byId = new Map(model.objects.map((record) => [record.ref.objectId, record]));
  const nameOf = (id: string | undefined): string => {
    const found = id === undefined ? undefined : byId.get(id);
    return found === undefined ? '' : labelOf(found);
  };
  return new Map(
    model.objects.map((record, index) => [
      objectKey(record.ref),
      {
        name: labelOf(record),
        category: categoryOf(record),
        storey: nameOf(where[index]?.storeyId),
        room: nameOf(where[index]?.roomId),
      },
    ]),
  );
};
