import { InstancedGroup, type MeshBuffers } from '@ara3d/viewer-core';
import { readBFast } from './bfast.js';
import { readRenderModel, instanceCount, meshCount, instanceMeshIndex, instanceEntityIndex, instanceHidden, instanceColor, instanceMatrix, type RenderModel } from './renderModel.js';
import type { BosConvertResult } from './bos-geometry.js';
import type { GroupCallback } from './groups.js';
import type { LoadOptions, LoadSource } from './progress.js';
import { toArrayBuffer } from './fetch-buffer.js';
import { bfastBimData, bimEntityLocalIds, type BimData } from './bim-data.js';

export type BfastModel = RenderModel & { readonly bimData: BimData };

/** Reads prepared Ara 3D triangle geometry as views on the uncompressed file. */
export function parseBfastModel(buffer: ArrayBuffer): BfastModel {
  const container = readBFast(buffer);
  const model = { ...readRenderModel(container), bimData: bfastBimData(container) };
  if (model.meta.primitiveSize !== 3 || model.meta.flags !== 0)
    throw new Error('BFAST supports triangle models without vertex colors only');
  if (model.meshSlices.length % 4 || model.instanceInts.length % 16 || model.vertices.length % 3 ||
      model.meshBounds.length !== meshCount(model) * 6 || model.instanceBounds.length !== instanceCount(model) * 6)
    throw new Error('Invalid BFAST table lengths');
  for (let i = 0; i < model.meshSlices.length; i += 4) {
    const [base, vertices, first, indices] = model.meshSlices.subarray(i, i + 4);
    if (base < 0 || vertices < 0 || first < 0 || indices < 0 || indices % 3 ||
        (base + vertices) * 3 > model.vertices.length || first + indices > model.indices.length)
      throw new Error(`Invalid BFAST mesh slice ${i / 4}`);
    for (let j = first; j < first + indices; j++)
      if (model.indices[j] >= vertices) throw new Error(`Invalid BFAST mesh index in slice ${i / 4}`);
  }
  for (const value of model.vertices)
    if (!Number.isFinite(value)) throw new Error('Invalid BFAST vertex');
  for (let i = 0; i < instanceCount(model); i++) {
    const mesh = instanceMeshIndex(model, i);
    if (mesh < -1 || mesh >= meshCount(model) || instanceEntityIndex(model, i) < 0)
      throw new Error(`Invalid BFAST instance ${i}`);
    for (let j = 0; j < 12; j++)
      if (!Number.isFinite(model.instanceFloats[i * 16 + j])) throw new Error(`Invalid BFAST transform ${i}`);
  }
  return model;
}

/** Keeps entity row identity and shares mesh views across material groups. */
export function bfastToGroups(model: RenderModel, onGroup?: GroupCallback): BosConvertResult {
  const meshes = new Map<number, MeshBuffers>();
  const buckets = new Map<string, { meshIndex: number; packed: number; alpha: number; instances: number[] }>();
  for (let i = 0; i < instanceCount(model); i++) {
    const meshIndex = instanceMeshIndex(model, i);
    if (meshIndex === -1 || instanceHidden(model, i) || model.meshSlices[meshIndex * 4 + 3] === 0) continue;
    // High bytes of the flags word carry BOS roughness and metallic values.
    const packed = model.instanceInts[i * 16 + 15] >>> 16;
    const alpha = instanceColor(model, i) >>> 24;
    const key = `${meshIndex}|${packed}|${alpha}`;
    let bucket = buckets.get(key);
    if (!bucket) { bucket = { meshIndex, packed, alpha, instances: [] }; buckets.set(key, bucket); }
    bucket.instances.push(i);
  }
  const groups: InstancedGroup[] = [];
  const groupEntities: BosConvertResult['groupEntities'][number][] = [];
  let count = 0;
  for (const bucket of buckets.values()) {
    const { meshIndex, packed, alpha, instances } = bucket;
    let mesh = meshes.get(meshIndex);
    if (!mesh) {
      const [base, vertices, first, indices] = model.meshSlices.subarray(meshIndex * 4, meshIndex * 4 + 4);
      mesh = { positions: model.vertices.subarray(base * 3, (base + vertices) * 3), indices: model.indices.subarray(first, first + indices) };
      meshes.set(meshIndex, mesh);
    }
    const transforms = new Float32Array(instances.length * 16), colors = new Float32Array(instances.length * 4);
    const entities: number[] = [];
    instances.forEach((source, target) => {
      instanceMatrix(model, source, transforms, target * 16);
      const color = instanceColor(model, source);
      for (let channel = 0; channel < 4; channel++) colors[target * 4 + channel] = ((color >>> (channel * 8)) & 255) / 255;
      entities.push(instanceEntityIndex(model, source));
    });
    const group = new InstancedGroup(mesh, { roughness: (packed & 255) / 255, metalness: (packed >>> 8) / 255, opacity: alpha / 255 }, instances.length);
    group.append(transforms, colors);
    groups.push(group); groupEntities.push({ group, entities }); count += instances.length;
    onGroup?.(group, groups.length - 1, buckets.size);
  }
  return { groups, groupEntities, instanceCount: count };
}

export type BfastLoadResult = BosConvertResult & { readonly bimData: BimData; readonly entityLocalIds: Int32Array | null };

export async function loadBfast(source: LoadSource, scene: import('@ara3d/viewer-core').ViewerScene, options: LoadOptions = {}): Promise<BfastLoadResult> {
  const buffer = await toArrayBuffer(source, options.onProgress);
  options.onProgress?.({ stage: 'parse', loaded: 0, total: 1 });
  const model = parseBfastModel(buffer);
  const entityLocalIds = await bimEntityLocalIds(model.bimData);
  if (entityLocalIds) for (let i = 13; i < model.instanceInts.length; i += 16)
    if (model.instanceInts[i] >= entityLocalIds.length) throw new Error('BFAST entity index exceeds Entities table');
  options.onProgress?.({ stage: 'parse', loaded: 1, total: 1 });
  const converted = bfastToGroups(model, (group, index, total) => {
    scene.addGroup(group);
    options.onProgress?.({ stage: 'convert', loaded: index + 1, total });
  });
  // Match loadBos's source-ID convention; bfastToGroups remains row-based.
  const groupEntities = converted.groupEntities.map(entry => ({ ...entry, entities: entry.entities.map(row =>
    entityLocalIds && entityLocalIds[row] > 0 ? entityLocalIds[row] : row) }));
  return { ...converted, groupEntities, bimData: model.bimData, entityLocalIds };
}
