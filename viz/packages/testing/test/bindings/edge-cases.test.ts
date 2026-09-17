/**
 * The cases where an instance record and an object do not correspond one to
 * one: an instance that is not drawn, an instance with no mesh, an entity no
 * instance refers to, and an instance naming an entity the table does not have.
 */
import { bfastToGroups } from '@ara3d/viewer-loaders';
import { describe, expect, it } from 'vitest';
import { buildAlphaBindings } from '../../src/bindings/alpha-reference.js';
import { buildColumnarBinding } from '../../src/bindings/build.js';
import { buildObjectTable, objectAt, objectNameAt } from '../../src/bindings/object-table.js';
import {
  instanceAt,
  withColorOverrides,
  withTransformOverrides,
} from '../../src/bindings/representation-table.js';
import { bfastBindingSource, denseColumn, stridedColumn } from '../../src/bindings/source.js';
import { syntheticRenderModel, type SyntheticModelShape } from '../../src/bindings/synthetic-model.js';

const modelId = 'edges';

const shape = (overrides: Partial<SyntheticModelShape>): SyntheticModelShape => ({
  instances: 40, meshes: 4, materials: 3, entities: 8, hiddenFraction: 0, noMeshFraction: 0, seed: 2, ...overrides,
});

const sourceOf = (overrides: Partial<SyntheticModelShape>) => {
  const { model, entityLocalIds } = syntheticRenderModel(shape(overrides));
  return bfastBindingSource(model, bfastToGroups(model), entityLocalIds);
};

describe('objects that no rendered instance represents', () => {
  it('keeps an object for every entity row, including rows with no geometry', () => {
    const source = sourceOf({ instances: 6, entities: 20 });
    const columnar = buildColumnarBinding(source);
    expect(columnar.objects.count).toBe(20);
    expect(columnar.table.count).toBeLessThan(20);
    const represented = new Set([...columnar.table.objectIndex]);
    expect(represented.size).toBeLessThan(columnar.objects.count);
  });

  it('keeps the object of a hidden instance, which has no representation row', () => {
    const withHidden = buildColumnarBinding(sourceOf({ hiddenFraction: 1, noMeshFraction: 0 }));
    expect(withHidden.table.count).toBe(0);
    expect(withHidden.objects.count).toBe(8);
    expect(withHidden.groups).toHaveLength(0);
  });

  it('keeps the object of an instance whose mesh index is -1', () => {
    const withoutMesh = buildColumnarBinding(sourceOf({ noMeshFraction: 1, hiddenFraction: 0 }));
    expect(withoutMesh.table.count).toBe(0);
    expect(withoutMesh.objects.count).toBe(8);
  });

  it('drops instances of the empty mesh, as the group converter does', () => {
    const { model, entityLocalIds } = syntheticRenderModel(shape({ instances: 12, meshes: 2 }));
    // Mesh 0 is the empty one and mesh 1 is the only other; every instance uses mesh 1.
    for (let i = 0; i < 12; i += 1) model.instanceInts[i * 16 + 12] = 0;
    const columnar = buildColumnarBinding(bfastBindingSource(model, bfastToGroups(model), entityLocalIds));
    expect(columnar.table.count).toBe(0);
    expect(columnar.objects.count).toBe(8);
  });
});

describe('entity indices the table cannot resolve', () => {
  it('rejects an instance naming an entity beyond the entity table', () => {
    const { model, entityLocalIds } = syntheticRenderModel(shape({}));
    model.instanceInts[13] = entityLocalIds.length;
    const source = bfastBindingSource(model, bfastToGroups(model), entityLocalIds);
    expect(() => buildColumnarBinding(source)).toThrow(/exceeds the entity table/);
    expect(() => buildAlphaBindings(source, modelId)).toThrow(/exceeds the entity table/);
  });

  it('rejects a negative entity index', () => {
    expect(() => buildObjectTable(null, denseColumn(new Int32Array([0, -1])))).toThrow(/Invalid model entity index/);
  });

  it('numbers objects in first-seen order when the model has no entity table', () => {
    const table = buildObjectTable(null, denseColumn(new Int32Array([5, 2, 5, 9])));
    expect(table.count).toBe(3);
    expect([...table.entityIndex]).toEqual([5, 2, 9]);
    expect(table.rowOfEntity[5]).toBe(0);
    expect(table.rowOfEntity[7]).toBe(-1);
    expect(objectNameAt(table, 0)).toBe('Entity 5');
  });
});

describe('reading a strided column of the instance table', () => {
  it('reads the entity word of every 16 word instance record', () => {
    const { model } = syntheticRenderModel(shape({ instances: 5, entities: 3 }));
    const column = stridedColumn(model.instanceInts, 13, 16);
    expect(column.count).toBe(5);
    expect(column.values).toBe(model.instanceInts);
  });
});

describe('override columns', () => {
  it('are absent at load and materialize the group values when asked for', () => {
    const columnar = buildColumnarBinding(sourceOf({}));
    const before = instanceAt(columnar, 0);
    const withColors = { groups: columnar.groups, table: withColorOverrides(columnar) };
    const withBoth = { groups: columnar.groups, table: withTransformOverrides(withColors) };
    expect(withBoth.table.colorFactor).toBeDefined();
    expect(withBoth.table.localTransform).toBeDefined();
    const after = instanceAt(withBoth, 0);
    expect([...after.transform]).toEqual([...before.transform]);
    expect([...after.color]).toEqual([...before.color]);
  });
});

describe('object identity', () => {
  it('names an object by its source id when it has one and by its entity row otherwise', () => {
    const columnar = buildColumnarBinding(sourceOf({ entities: 5 }));
    // The generator gives every fourth entity row no source id.
    expect(objectAt(columnar.objects, 0, modelId)).toEqual({
      ref: { modelId, objectId: 'bos:0' }, name: 'Entity 0',
    });
    expect(objectAt(columnar.objects, 1, modelId)).toEqual({
      ref: { modelId, objectId: 'bos:1' }, name: 'Object 8', sourceId: '8',
    });
  });
});
