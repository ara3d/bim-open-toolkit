// Correctness contract of the two object-to-instance layouts: they must describe
// the same assignment, or comparing their cost compares two different things.
import { describe, expect, it } from 'vitest';
import {
  buildBindingObjects, buildObjectColumns, objectIds, objectKey, objectOfRow, rowsOfObject,
} from '../../src/perf/object-index.js';
import { createSyntheticScene, scaledShape } from '../../src/perf/scene.js';

const MODEL = 'model-under-test';
const scene = createSyntheticScene(scaledShape(240, 17));
const objectCount = 30;
const owner = objectOfRow(scene.rowCount, objectCount);
const ids = objectIds(objectCount);
const bindings = buildBindingObjects(scene, owner, ids, MODEL);
const columns = buildObjectColumns(scene.rowCount, owner, ids, MODEL);

/** Each row's (group ordinal, slot) pair, as a comparable string. */
const slotOfRow = (row: number): string => `${scene.groupOf[row]}:${scene.indexInGroup[row]}`;

describe('object index layouts', () => {
  it('assigns every row to exactly one object', () => {
    expect(owner.length).toBe(scene.rowCount);
    expect(new Set(owner).size).toBe(objectCount);
    expect(columns.rowStart[objectCount]).toBe(scene.rowCount);
  });

  it('binds one frozen object per rendered instance', () => {
    expect(bindings.byModel.length).toBe(scene.rowCount);
    expect(bindings.byObject.size).toBe(objectCount);
    const first = bindings.byModel[0];
    if (!first) throw new Error('no bindings');
    expect(Object.isFrozen(first)).toBe(true);
    expect(Object.isFrozen(first.ref)).toBe(true);
  });

  it('gives every object the same instances in both layouts', () => {
    for (let o = 0; o < objectCount; o++) {
      const objectId = ids[o];
      if (objectId === undefined) throw new Error('missing id');
      const key = objectKey({ modelId: MODEL, objectId });
      const fromObjects = bindings.byObject.get(key);
      if (!fromObjects) throw new Error(`no bindings for ${key}`);
      const fromColumns = rowsOfObject(columns, o);
      expect(fromColumns.length).toBe(fromObjects.length);
      const bySlot = new Set(fromObjects.map((binding) =>
        `${scene.groups.indexOf(binding.group)}:${binding.instanceIndex}`));
      expect(new Set([...fromColumns].map(slotOfRow))).toEqual(bySlot);
    }
  });

  it('looks an object up by the same key in both layouts', () => {
    const objectId = ids[7];
    if (objectId === undefined) throw new Error('missing id');
    const key = objectKey({ modelId: MODEL, objectId });
    expect(columns.ordinalOf.get(key)).toBe(7);
    expect(bindings.byObject.has(key)).toBe(true);
    expect(columns.ordinalOf.get(objectKey({ modelId: 'other', objectId }))).toBeUndefined();
  });

  it('indexes every instance of every group', () => {
    let bound = 0;
    for (const slots of bindings.byInstance.values()) bound += slots.size;
    expect(bound).toBe(scene.rowCount);
  });

  it('rejects an assignment that cannot cover the rows', () => {
    expect(() => objectOfRow(10, 11)).toThrow(/cannot cover/);
  });
});
