import { describe, expect, it } from 'vitest';
import { metresZUpLocal } from '../src/coordinates.js';
import { objectKey, objectRef, type ModelRef } from '../src/identity.js';
import { identityMatrix } from '../src/math.js';
import { instanceRecords, isGeometryFree, noMesh, type InstanceRecord } from '../src/mesh.js';
import { emptyModel, emptyObject, hasRepresentation, objectIndexByKey, objectRefs, objectsByKey, type ModelData, type ObjectRecord } from '../src/objects.js';

const model: ModelRef = { id: 'tower', revision: 'r1' };

const data: ModelData = {
  ref: model,
  coordinates: metresZUpLocal,
  objects: [
    { ref: objectRef(model, 'wall'), transform: identityMatrix, representation: 0 },
    { ref: objectRef(model, 'room'), transform: identityMatrix, name: 'Office' },
  ],
};

describe('objects', () => {
  it('makes a record with no geometry at the origin', () => {
    const record = emptyObject(objectRef(model, 'x'));
    expect(record.transform).toEqual(identityMatrix);
    expect(hasRepresentation(record)).toBe(false);
  });

  it('keeps a geometry-free record addressable', () => {
    const byKey = objectsByKey(data);
    const room = byKey.get(objectKey(objectRef(model, 'room')));
    expect(room?.name).toBe('Office');
    expect(hasRepresentation(data.objects[0] ?? emptyObject(objectRef(model, 'x')))).toBe(true);
  });

  it('indexes objects by key in table order', () => {
    expect(objectIndexByKey(data).get(objectKey(objectRef(model, 'room')))).toBe(1);
  });

  it('lists every reference in table order', () => {
    expect(objectRefs(data).map((ref) => ref.objectId)).toEqual(['wall', 'room']);
  });

  // What `representation` means: the first of the instance rows the object owns, never all of them.
  it('names the first drawn instance row, while objectIndex holds every row', () => {
    const placement = (meshIndex: number, objectIndex: number): InstanceRecord =>
      ({ meshIndex, transform: identityMatrix, color: [1, 1, 1], opacity: 1, objectIndex });
    const placed = instanceRecords([placement(noMesh, 1), placement(0, 0), placement(0, 0)]);
    const drawnRowsOfWall = [...placed.objectIndex].flatMap((object, row) =>
      object === 0 && !isGeometryFree(placed, row) ? [row] : []);
    expect(drawnRowsOfWall).toEqual([1, 2]);
    const wall: ObjectRecord = { ...(data.objects[0] ?? emptyObject(objectRef(model, 'wall'))), representation: drawnRowsOfWall[0] };
    expect(hasRepresentation(wall)).toBe(true);
    expect(wall.representation).toBe(1);
  });

  it('makes an empty model', () => {
    expect(emptyModel(model, metresZUpLocal).objects).toEqual([]);
  });
});
