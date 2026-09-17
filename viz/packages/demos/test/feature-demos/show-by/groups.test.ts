// The groups the page shows by, checked against the generated building and against a hand-built
// model whose room has lost its storey link, which is the case the generator makes on purpose.

import { describe, expect, it } from 'vitest';
import { defaultBuildingOptions, generateBuilding } from '@bim-open-toolkit/synthetic';
import {
  metresZUpLocal,
  modelIdentity,
  objectKey,
  objectRef,
  translation,
  type ModelData,
  type ModelRef,
  type ObjectRecord,
} from '@bim-open-toolkit/model';
import {
  findGroup,
  groupsOf,
  noCategoryLabel,
  placesOf,
  unassignedStoreyId,
} from '../../../src/feature-demos/show-by/groups.js';

const building = () => generateBuilding({ ...defaultBuildingOptions, roof: true, ceilings: true });

const total = (groups: readonly { readonly count: number }[]): number =>
  groups.reduce((sum, group) => sum + group.count, 0);

// A model of one storey with two rooms and a door in each; the second room has no storey link.
const brokenModel = (): ModelData => {
  const ref: ModelRef = modelIdentity({ id: 'show-by-fixture', revision: '1' });
  const record = (
    objectId: string,
    category: string,
    parentId: string | undefined,
    name?: string,
  ): ObjectRecord => ({
    ref: objectRef(ref, objectId),
    ...(name === undefined ? {} : { name }),
    category,
    ...(parentId === undefined ? {} : { parentId }),
    transform: translation([0, 0, 0]),
  });
  return {
    ref,
    coordinates: metresZUpLocal,
    objects: [
      record('storey-1', 'Storey', undefined, 'Level 1'),
      record('room-a', 'Room', 'storey-1', 'Office 1.01'),
      record('door-a', 'Door', 'room-a', 'Door 1.01a'),
      record('room-b', 'Room', undefined),
      record('door-b', 'Door', 'room-b', 'Door 1.02a'),
      record('loose', '', undefined, 'Site marker'),
    ],
  };
};

describe('the groups a model offers', () => {
  it('puts every object of the building in exactly one storey group', () => {
    const model = building().model;
    const groups = groupsOf(model);
    expect(groups.storeys.map((group) => group.label)).toEqual(
      expect.arrayContaining(['Level 1', 'Level 2', 'Level 3']),
    );
    expect(total(groups.storeys)).toBe(model.objects.length);
    const seen = new Set(groups.storeys.flatMap((group) => [...group.members]));
    expect(seen.size).toBe(model.objects.length);
  });

  it('gives every object exactly one category group, the roof and the ceilings among them', () => {
    const model = building().model;
    const groups = groupsOf(model);
    expect(total(groups.categories)).toBe(model.objects.length);
    expect(findGroup(groups, 'category', 'Roof')?.count).toBe(1);
    expect(findGroup(groups, 'category', 'Ceiling')?.count).toBe(defaultBuildingOptions.storeys);
    expect(findGroup(groups, 'category', 'Room')?.count).toBe(
      defaultBuildingOptions.storeys * defaultBuildingOptions.roomsPerStorey,
    );
    expect(groups.categories.map((group) => group.id)).toEqual([...groups.categories.map((group) => group.id)].sort());
  });

  it('holds each room together with the doors that hang off it', () => {
    const model = building().model;
    const groups = groupsOf(model);
    expect(groups.rooms).toHaveLength(defaultBuildingOptions.storeys * defaultBuildingOptions.roomsPerStorey);
    for (const room of groups.rooms) {
      const children = model.objects.filter((record) => record.parentId === room.id);
      expect(room.count).toBe(children.length + 1);
      expect(room.members).toContain(
        objectKey(objectRef(model.ref, room.id)),
      );
    }
  });

  it('collects the objects whose storey link is missing rather than dropping them', () => {
    const model = brokenModel();
    const groups = groupsOf(model);
    const unassigned = findGroup(groups, 'storey', unassignedStoreyId);
    expect(unassigned?.members).toEqual([
      objectKey(objectRef(model.ref, 'room-b')),
      objectKey(objectRef(model.ref, 'door-b')),
      objectKey(objectRef(model.ref, 'loose')),
    ]);
    expect(findGroup(groups, 'storey', 'storey-1')?.count).toBe(3);
    expect(total(groups.storeys)).toBe(model.objects.length);
    expect(findGroup(groups, 'category', noCategoryLabel)?.count).toBe(1);
    expect(findGroup(groups, 'room', 'room-b')?.label).toBe('room-b');
  });

  it('shows the same missing links in the generated building when the gaps are widened', () => {
    const model = generateBuilding({ ...defaultBuildingOptions, roof: true, ceilings: true, gapScale: 5 }).model;
    const unlinked = model.objects.filter((record) => record.category === 'Room' && record.parentId === undefined);
    expect(unlinked.length).toBeGreaterThan(0);
    const groups = groupsOf(model);
    const unassigned = findGroup(groups, 'storey', unassignedStoreyId);
    expect(unassigned?.count).toBeGreaterThanOrEqual(unlinked.length);
    expect(total(groups.storeys)).toBe(model.objects.length);
  });
});

describe('where an object sits', () => {
  it('reads a door back with its name, category, storey and room', () => {
    const model = building().model;
    const places = placesOf(model);
    const door = model.objects.find((record) => record.category === 'Door' && record.parentId === 'room-2-1');
    expect(door).toBeDefined();
    if (door === undefined) return;
    const place = places.get(objectKey(door.ref));
    expect(place?.category).toBe('Door');
    expect(place?.storey).toBe('Level 2');
    expect(place?.room).toBe(model.objects.find((record) => record.ref.objectId === 'room-2-1')?.name ?? 'room-2-1');
  });

  it('leaves the storey empty for an object whose link is missing', () => {
    const model = brokenModel();
    const places = placesOf(model);
    expect(places.get(objectKey(objectRef(model.ref, 'door-b')))).toEqual({
      name: 'Door 1.02a',
      category: 'Door',
      storey: '',
      room: 'room-b',
    });
    expect(places.get(objectKey(objectRef(model.ref, 'door-a')))?.storey).toBe('Level 1');
  });
});
