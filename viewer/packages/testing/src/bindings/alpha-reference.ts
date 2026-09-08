/**
 * The alpha loader's binding step, on its own.
 *
 * `loadBosModel` parses, converts and binds in one asynchronous function, and
 * yields to the event loop every 4096 instances, so the binding step cannot be
 * timed inside it. This is the same loop with the yields removed: one frozen
 * object per rendered instance holding a frozen transform copy and a frozen
 * colour copy, plus one object per entity. It is the baseline the columnar
 * layout is measured against, and the reference the parity tests compare with.
 *
 * Keep it faithful. A parity test checks it against the real `loadBosModel`
 * whenever the private benchmark model is present.
 */
import type { InstancedGroup } from '@ara3d/viewer-core';
import { Matrix4 as ThreeMatrix4 } from 'three';
import { withOpaqueMaterials, type SourceUp } from './build.js';
import { noSourceId, type ObjectIdentity } from './object-table.js';
import { transformFloats } from './representation-table.js';
import { columnAt, type BindingSource } from './source.js';

/** The alpha loader's per-instance binding object. */
export type AlphaBinding = {
  readonly ref: ObjectIdentity;
  readonly representationId: string;
  readonly group: InstancedGroup;
  readonly instanceIndex: number;
  readonly localTransform: readonly number[];
  readonly colorFactor: readonly [number, number, number, number];
};

/** The alpha loader's normalized object record, without the fields that are always constant. */
export type AlphaObject = {
  readonly ref: ObjectIdentity;
  readonly name: string;
  readonly sourceId?: string;
};

export type AlphaBindingResult = {
  readonly objects: readonly AlphaObject[];
  readonly bindings: readonly AlphaBinding[];
};

/** Builds the objects and the per-instance bindings the way the alpha loader does. */
export function buildAlphaBindings(
  source: BindingSource,
  modelId: string,
  sourceUp: SourceUp = 'Y',
): AlphaBindingResult {
  const { entityLocalIds } = source;
  const objects = new Map<number, AlphaObject>();
  const addObject = (entity: number): AlphaObject => {
    if (!Number.isInteger(entity) || entity < 0) throw new Error('Invalid model entity index');
    if (entityLocalIds !== null && entity >= entityLocalIds.length)
      throw new Error('Model entity index exceeds the entity table');
    const existing = objects.get(entity);
    if (existing !== undefined) return existing;
    const id = entityLocalIds?.[entity] ?? noSourceId;
    const record: AlphaObject = {
      ref: { modelId, objectId: `bos:${entity}` },
      name: id > noSourceId ? `Object ${id}` : `Entity ${entity}`,
      ...(id > noSourceId ? { sourceId: String(id) } : {}),
    };
    objects.set(entity, record);
    return record;
  };
  for (let entity = 0; entity < (entityLocalIds?.length ?? 0); entity += 1) addObject(entity);
  for (let i = 0; i < source.instanceEntities.count; i += 1) addObject(columnAt(source.instanceEntities, i));

  const conversion = sourceUp === 'Z' ? new ThreeMatrix4().makeRotationX(-Math.PI / 2) : new ThreeMatrix4();
  const matrix = new ThreeMatrix4();
  const sourceMatrix = new ThreeMatrix4();
  const transformBuffer = new Float32Array(transformFloats);
  const bindings: AlphaBinding[] = [];
  const entries = withOpaqueMaterials(source.groups);
  for (let groupIndex = 0; groupIndex < entries.length; groupIndex += 1) {
    const entry = entries[groupIndex];
    if (entry === undefined) continue;
    const group = entry.group;
    const transforms = group.transforms;
    const colors = group.colors;
    for (let instanceIndex = 0; instanceIndex < entry.entities.length; instanceIndex += 1) {
      const transform = matrix
        .multiplyMatrices(conversion, sourceMatrix.fromArray(transforms, instanceIndex * transformFloats))
        .toArray();
      if (!transform.every(Number.isFinite)) throw new Error('Invalid representation transform');
      if (sourceUp === 'Z') {
        transformBuffer.set(transform);
        group.setTransform(instanceIndex, transformBuffer);
      }
      const colorOffset = instanceIndex * 4;
      bindings.push({
        ref: addObject(entry.entities[instanceIndex] ?? -1).ref,
        representationId: `bos:${groupIndex}:${instanceIndex}`,
        group,
        instanceIndex,
        localTransform: Object.freeze(transform),
        colorFactor: Object.freeze([
          colors[colorOffset] ?? 0,
          colors[colorOffset + 1] ?? 0,
          colors[colorOffset + 2] ?? 0,
          colors[colorOffset + 3] ?? 0,
        ] as const),
      });
    }
  }
  return { objects: [...objects.values()], bindings };
}
