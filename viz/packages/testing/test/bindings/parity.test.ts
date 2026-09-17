/**
 * The columnar table must say exactly what the alpha loader's per-instance
 * binding objects say: the same objects in the same order, the same object for
 * every instance, and the same transform and colour for every instance.
 *
 * Transforms are compared after `Math.fround`. The alpha keeps the matrix
 * product at double precision inside the binding while writing the single
 * precision result into the group buffer that is actually drawn, so the two
 * differ in the digits no renderer ever reads. The columnar table keeps only
 * the drawn value.
 */
import { bfastToGroups } from '@ara3d/viewer-loaders';
import { describe, expect, it } from 'vitest';
import { buildAlphaBindings } from '../../src/bindings/alpha-reference.js';
import { buildColumnarBinding, type SourceUp } from '../../src/bindings/build.js';
import { objectAt } from '../../src/bindings/object-table.js';
import { instanceAt, representationIdAt, tableBytes } from '../../src/bindings/representation-table.js';
import { bfastBindingSource, type BindingSource } from '../../src/bindings/source.js';
import { buildingShape, syntheticRenderModel } from '../../src/bindings/synthetic-model.js';

const modelId = 'parity';

/** Both paths must start from their own groups: the alpha path mutates them when the up axis changes. */
function bindingSource(instances: number, seed: number): BindingSource {
  const { model, entityLocalIds } = syntheticRenderModel(buildingShape(instances, seed));
  return bfastBindingSource(model, bfastToGroups(model), entityLocalIds);
}

function comparePaths(instances: number, seed: number, sourceUp: SourceUp): void {
  const alpha = buildAlphaBindings(bindingSource(instances, seed), modelId, sourceUp);
  const columnar = buildColumnarBinding(bindingSource(instances, seed), { sourceUp });

  expect(columnar.objects.count).toBe(alpha.objects.length);
  for (let row = 0; row < columnar.objects.count; row += 1)
    expect(objectAt(columnar.objects, row, modelId)).toEqual(alpha.objects[row]);

  expect(columnar.table.count).toBe(alpha.bindings.length);
  for (let row = 0; row < columnar.table.count; row += 1) {
    const expected = alpha.bindings[row];
    if (expected === undefined) throw new Error('missing alpha binding');
    const actual = instanceAt(columnar, row);
    expect(objectAt(columnar.objects, actual.objectIndex, modelId).ref).toEqual(expected.ref);
    expect(representationIdAt(columnar.table, row)).toBe(expected.representationId);
    expect(actual.instanceIndex).toBe(expected.instanceIndex);
    expect([...actual.transform]).toEqual(expected.localTransform.map(Math.fround));
    expect([...actual.color]).toEqual([...expected.colorFactor]);
  }
}

describe('columnar binding parity with the alpha binding step', () => {
  it('agrees on objects, transforms and colours for a Y up model', () => {
    comparePaths(400, 7, 'Y');
  });

  it('agrees for a Z up model, where both paths rotate the group buffers', () => {
    comparePaths(400, 11, 'Z');
  });

  it('agrees on a model whose instances all share one object', () => {
    const { model, entityLocalIds } = syntheticRenderModel({
      instances: 64, meshes: 3, materials: 2, entities: 1, hiddenFraction: 0, noMeshFraction: 0, seed: 3,
    });
    const source = bfastBindingSource(model, bfastToGroups(model), entityLocalIds);
    const alpha = buildAlphaBindings(source, modelId);
    const columnar = buildColumnarBinding(
      bfastBindingSource(model, bfastToGroups(model), entityLocalIds),
    );
    expect(columnar.objects.count).toBe(1);
    expect(alpha.objects).toHaveLength(1);
    expect(columnar.table.count).toBe(alpha.bindings.length);
    for (let row = 0; row < columnar.table.count; row += 1) expect(columnar.table.objectIndex[row]).toBe(0);
  });

  it('stores three integers per instance and no copies of the group buffers', () => {
    const columnar = buildColumnarBinding(bindingSource(400, 13));
    expect(columnar.table.colorFactor).toBeUndefined();
    expect(columnar.table.localTransform).toBeUndefined();
    expect(tableBytes(columnar.table)).toBe(columnar.table.count * 3 * 4);
  });
});
