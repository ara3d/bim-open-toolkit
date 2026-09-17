/**
 * Building the columnar binding from what a loader produced.
 *
 * The three steps the alpha loader folds into one per-instance loop are
 * separated here, because they cost very different amounts and only one of them
 * is per instance:
 *
 * - normalizing group materials is per group,
 * - converting the up axis is a bulk pass over the group transform buffers,
 * - filling the representation columns is three integer writes per instance.
 */
import { InstancedGroup } from '@ara3d/viewer-core';
import type { BosGroupEntities } from '@ara3d/viewer-loaders';
import { Matrix4 as ThreeMatrix4 } from 'three';
import { buildObjectTable, type ObjectTable } from './object-table.js';
import { transformFloats, type ColumnarBinding, type RepresentationTable } from './representation-table.js';
import { columnAt, type BindingSource } from './source.js';

/** Which axis points up in the source model. The result is always Y up. */
export type SourceUp = 'Y' | 'Z';

export type BindingOptions = {
  readonly sourceUp?: SourceUp;
  /** Reject a non-finite transform, as the alpha loader does. On by default. */
  readonly validate?: boolean;
};

/** A binding plus the objects its rows point at. */
export type LoadedBinding = ColumnarBinding & { readonly objects: ObjectTable };

/**
 * Source alpha belongs to the instance, not to the material: an instance whose
 * colour factor already carries its alpha would be faded twice if the material
 * were translucent as well. The alpha loader rebuilds such a group with an
 * opaque material, and so does this.
 */
export function withOpaqueMaterials(entries: readonly BosGroupEntities[]): readonly BosGroupEntities[] {
  return entries.map((entry) => {
    if (entry.group.material.opacity === 1) return entry;
    const group = new InstancedGroup(entry.group.mesh, { ...entry.group.material, opacity: 1 }, entry.group.instanceCount);
    group.append(entry.group.transforms, entry.group.colors);
    return { group, entities: entry.entities };
  });
}

/** Rejects a group whose transform buffer holds a value that cannot be drawn. */
export function validateTransforms(groups: readonly InstancedGroup[]): void {
  for (const group of groups) {
    const transforms = group.transforms;
    for (let i = 0; i < transforms.length; i += 1)
      if (!Number.isFinite(transforms[i])) throw new Error('Invalid representation transform');
  }
}

/**
 * Rotates every instance of every group -90 degrees about X, in place.
 *
 * One pass over the group buffers replaces the alpha loader's per-instance
 * matrix object. The multiplication is the same one, so the stored result is
 * the same to the bit.
 */
export function convertUpAxis(groups: readonly InstancedGroup[]): void {
  const conversion = new ThreeMatrix4().makeRotationX(-Math.PI / 2);
  const source = new ThreeMatrix4();
  const product = new ThreeMatrix4();
  const row = new Float32Array(transformFloats);
  for (const group of groups) {
    const transforms = group.transforms;
    for (let instance = 0; instance * transformFloats < transforms.length; instance += 1) {
      row.set(product.multiplyMatrices(conversion, source.fromArray(transforms, instance * transformFloats)).elements);
      group.setTransform(instance, row);
    }
  }
}

/** Fills the three integer columns. This is the whole per-instance cost of the columnar layout. */
export function buildRepresentationTable(
  entries: readonly BosGroupEntities[],
  rowOfEntity: Int32Array,
): RepresentationTable {
  let count = 0;
  for (const entry of entries) count += entry.entities.length;
  const objectIndex = new Int32Array(count);
  const groupIndex = new Int32Array(count);
  const instanceIndex = new Int32Array(count);
  let row = 0;
  for (let group = 0; group < entries.length; group += 1) {
    const entities = entries[group]?.entities ?? [];
    for (let instance = 0; instance < entities.length; instance += 1) {
      const object = rowOfEntity[entities[instance] ?? -1] ?? -1;
      if (object < 0) throw new Error('Representation names an entity that is not an object');
      objectIndex[row] = object;
      groupIndex[row] = group;
      instanceIndex[row] = instance;
      row += 1;
    }
  }
  return { count, objectIndex, groupIndex, instanceIndex };
}

/** The whole binding step: objects, group normalization, up axis, representation columns. */
export function buildColumnarBinding(source: BindingSource, options: BindingOptions = {}): LoadedBinding {
  const objects = buildObjectTable(source.entityLocalIds, source.instanceEntities);
  const entries = withOpaqueMaterials(source.groups);
  const groups = entries.map((entry) => entry.group);
  if (options.validate !== false) validateTransforms(groups);
  if (options.sourceUp === 'Z') convertUpAxis(groups);
  return { groups, table: buildRepresentationTable(entries, objects.rowOfEntity), objects };
}

/** Entity index of every instance record of the source, materialized. Used by tests, not by loading. */
export const instanceEntityList = (source: BindingSource): Int32Array => {
  const out = new Int32Array(source.instanceEntities.count);
  for (let i = 0; i < out.length; i += 1) out[i] = columnAt(source.instanceEntities, i);
  return out;
};
