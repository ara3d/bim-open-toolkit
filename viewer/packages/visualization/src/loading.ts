import { InstancedGroup } from '@ara3d/viewer-core';
import { bosToGroups, parseBosGeometry, type LoadProgress, type LoadSource } from '@ara3d/viewer-loaders';
import { Matrix4 as ThreeMatrix4 } from 'three';
import { identityMatrix, type Matrix4, type ModelData, type ModelRef, type ObjectRecord, type Result } from './contracts.js';
import type { InstanceBinding } from './render.js';

export type BosModelOptions = {
  readonly signal?: AbortSignal;
  readonly onProgress?: (progress: LoadProgress) => void;
  /** The returned model always uses Y-up; Z input rotates -90 degrees about X. */
  readonly sourceUp?: 'Y' | 'Z';
};
export type LoadedBosModel = { readonly model: ModelData; readonly bindings: InstanceBinding[] };

async function sourceBuffer(source: LoadSource, options: BosModelOptions): Promise<ArrayBuffer> {
  if (typeof source !== 'string') return source instanceof ArrayBuffer ? source : source.arrayBuffer();
  const response = await fetch(source, options.signal ? { signal: options.signal } : {});
  if (!response.ok) throw new Error(`BOS fetch failed: ${response.status}`);
  if (!response.body) return response.arrayBuffer();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  const contentLength = Number(response.headers.get('content-length'));
  let loaded = 0;
  try {
    for (;;) {
      options.signal?.throwIfAborted();
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value); loaded += value.byteLength;
      options.onProgress?.({ stage: 'fetch', loaded, ...(contentLength > 0 ? { total: contentLength } : {}) });
    }
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(loaded);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return bytes.buffer;
}

/** Decode and normalize without touching a scene. A cancelled load never publishes a value. */
export async function loadBosModel(source: LoadSource, modelRef: ModelRef, options: BosModelOptions = {}): Promise<Result<LoadedBosModel>> {
  const check = () => options.signal?.throwIfAborted();
  const progress = (value: LoadProgress) => { check(); options.onProgress?.(value); check(); };
  try {
    check();
    const buffer = await sourceBuffer(source, { ...options, onProgress: progress });
    check(); progress({ stage: 'parse', loaded: 0, total: 1 });
    const bos = await parseBosGeometry(buffer);
    check(); progress({ stage: 'parse', loaded: 1, total: 1 });
    // The converter's source-ID fallback can collide with another entity row's LocalId.
    // Use entity rows for runtime identity and keep source IDs as separate metadata.
    const converted = bosToGroups({ ...bos, EntityLocalId: null }, (_group, index, total) => progress({ stage: 'convert', loaded: index + 1, total }));
    const objects = new Map<number, ObjectRecord>();
    const addObject = (entity: number) => {
      if (!Number.isInteger(entity) || entity < 0) throw new Error('Invalid BOS entity index');
      if (!objects.has(entity)) {
        const sourceId = bos.EntityLocalId?.[entity];
        objects.set(entity, {
          ref: { modelId: modelRef.id, objectId: `bos:${entity}` }, name: sourceId && sourceId > 0 ? `Object ${sourceId}` : `Entity ${entity}`,
          ...(sourceId !== undefined && sourceId > 0 ? { sourceId: String(sourceId) } : {}),
          transform: identityMatrix, appearance: { color: [1, 1, 1], opacity: 1, visible: true },
        });
      }
      return objects.get(entity)!;
    };
    for (let entity = 0; entity < (bos.EntityLocalId?.length ?? 0); entity++) addObject(entity);
    for (const entity of bos.InstanceEntityIndex) addObject(entity);
    const conversion = options.sourceUp === 'Z' ? new ThreeMatrix4().makeRotationX(-Math.PI / 2) : new ThreeMatrix4();
    const matrix = new ThreeMatrix4();
    const bindings: InstanceBinding[] = [];
    for (const [groupIndex, entry] of converted.groupEntities.entries()) {
      check();
      // Source alpha is carried once in each representation's color factor.
      const group = new InstancedGroup(entry.group.mesh, { ...entry.group.material, opacity: 1 }, entry.group.instanceCount);
      group.append(entry.group.transforms, entry.group.colors);
      for (const [instanceIndex, entity] of entry.entities.entries()) {
        const transform = matrix.multiplyMatrices(conversion, new ThreeMatrix4().fromArray(group.getTransform(instanceIndex))).toArray();
        if (!transform.every(Number.isFinite)) throw new Error('Invalid BOS representation transform');
        group.setTransform(instanceIndex, new Float32Array(transform));
        bindings.push({
          ref: addObject(entity).ref, representationId: `bos:${groupIndex}:${instanceIndex}`, group, instanceIndex,
          localTransform: Object.freeze(transform) as unknown as Matrix4,
          colorFactor: Object.freeze(Array.from(group.getColor(instanceIndex))) as unknown as readonly [number, number, number, number],
        });
      }
    }
    check();
    return { ok: true, value: { model: { ref: { ...modelRef }, coordinates: { units: 'unknown', up: 'Y', registration: 'unknown' }, objects: [...objects.values()] }, bindings }, diagnostics: [] };
  } catch (error) {
    return { ok: false, diagnostics: [{ code: options.signal?.aborted ? 'aborted' : 'load-failed', message: options.signal?.aborted ? 'BOS loading cancelled' : error instanceof Error ? error.message : 'BOS loading failed' }] };
  }
}
