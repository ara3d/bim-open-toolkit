// BOS (BIM Open Schema) geometry tables -> viewer-core groups.
// Ported from @ara3d/ara3d-webgl 1.3.15 (src/loader/buildInstances.ts and
// src/loader/bimGeometry.ts, recovered from the package's published source map).
// Source repo: https://github.com/ara3d/ara3d-webgl

import { InstancedGroup, MeshBuffers } from '@ara3d/viewer-core';
import { ConvertResult, GroupCallback } from './groups.js';

type IntColumn = Int32Array | Uint32Array;
type ByteColumn = Uint8Array | Int32Array;

/** The decoded BOS geometry tables (columns of the six geometry parquet tables). */
export interface BosGeometry {
  readonly InstanceEntityIndex: IntColumn;
  readonly InstanceMaterialIndex: IntColumn;
  readonly InstanceMeshIndex: IntColumn;
  readonly InstanceTransformIndex: IntColumn;
  readonly InstanceFlags: ByteColumn;
  readonly VertexX: IntColumn;
  readonly VertexY: IntColumn;
  readonly VertexZ: IntColumn;
  readonly IndexBuffer: IntColumn;
  readonly MeshVertexOffset: IntColumn;
  readonly MeshIndexOffset: IntColumn;
  readonly MaterialRed: ByteColumn;
  readonly MaterialGreen: ByteColumn;
  readonly MaterialBlue: ByteColumn;
  readonly MaterialAlpha: ByteColumn;
  readonly MaterialRoughness: ByteColumn;
  readonly MaterialMetallic: ByteColumn;
  readonly TransformTX: Float32Array;
  readonly TransformTY: Float32Array;
  readonly TransformTZ: Float32Array;
  readonly TransformQX: Float32Array;
  readonly TransformQY: Float32Array;
  readonly TransformQZ: Float32Array;
  readonly TransformQW: Float32Array;
  readonly TransformSX: Float32Array;
  readonly TransformSY: Float32Array;
  readonly TransformSZ: Float32Array;
  /**
   * Per BOS entity row, the source document's own id (the IFC STEP express id)
   * from the Entities table's LocalId column. Absent for archives without an
   * Entities table; 0 or negative where the entity has no source id.
   */
  readonly EntityLocalId?: IntColumn | null;
}

/** BOS stores vertex coordinates as integers at this fixed-point scale. */
export const BOS_VERTEX_SCALE = 10_000;

const HIDDEN_FLAG = 0x1;

export const bosMeshCount = (bos: BosGeometry): number =>
  bos.MeshVertexOffset.length;

/**
 * The id an entity is addressed by outside the viewer: its source document id
 * (IFC express id) when the BOS carries one, else the BOS entity row index.
 * Instance tables key rows by the source id, so groups must report the same.
 */
export function bosEntityId(bos: BosGeometry, entityIndex: number): number {
  const ids = bos.EntityLocalId;
  if (!ids || entityIndex < 0 || entityIndex >= ids.length) return entityIndex;
  const id = ids[entityIndex];
  return id > 0 ? id : entityIndex;
}

/**
 * Extracts one mesh from the shared vertex/index buffers as MeshBuffers
 * (positions descaled to floats; indices are mesh-local). Null when empty.
 */
export function bosMeshBuffers(bos: BosGeometry, meshIndex: number): MeshBuffers | null {
  const meshCount = bosMeshCount(bos);
  if (meshIndex < 0 || meshIndex >= meshCount) return null;
  const vStart = bos.MeshVertexOffset[meshIndex];
  const vEnd = meshIndex + 1 < meshCount ? bos.MeshVertexOffset[meshIndex + 1] : bos.VertexX.length;
  const iStart = bos.MeshIndexOffset[meshIndex];
  const iEnd = meshIndex + 1 < meshCount ? bos.MeshIndexOffset[meshIndex + 1] : bos.IndexBuffer.length;
  const vCount = vEnd - vStart;
  const iCount = iEnd - iStart;
  if (vCount <= 0 || iCount <= 0) return null;

  const positions = new Float32Array(vCount * 3);
  for (let vi = 0; vi < vCount; vi++) {
    positions[vi * 3] = bos.VertexX[vi + vStart] / BOS_VERTEX_SCALE;
    positions[vi * 3 + 1] = bos.VertexY[vi + vStart] / BOS_VERTEX_SCALE;
    positions[vi * 3 + 2] = bos.VertexZ[vi + vStart] / BOS_VERTEX_SCALE;
  }
  const indices = new Uint32Array(iCount);
  for (let ii = 0; ii < iCount; ii++) indices[ii] = bos.IndexBuffer[ii + iStart];
  return { positions, indices };
}

/**
 * Composes translation + quaternion + scale into a column-major 4x4 matrix
 * (same convention and result as THREE.Matrix4.compose).
 */
export function composeTrs(
  tx: number, ty: number, tz: number,
  qx: number, qy: number, qz: number, qw: number,
  sx: number, sy: number, sz: number,
): Float32Array {
  const x2 = qx + qx, y2 = qy + qy, z2 = qz + qz;
  const xx = qx * x2, xy = qx * y2, xz = qx * z2;
  const yy = qy * y2, yz = qy * z2, zz = qz * z2;
  const wx = qw * x2, wy = qw * y2, wz = qw * z2;
  return new Float32Array([
    (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
    (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
    (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
    tx, ty, tz, 1,
  ]);
}

/** The 4x4 world matrix of one row of the Transforms table. */
export const bosTransform = (bos: BosGeometry, ti: number): Float32Array =>
  composeTrs(
    bos.TransformTX[ti], bos.TransformTY[ti], bos.TransformTZ[ti],
    bos.TransformQX[ti], bos.TransformQY[ti], bos.TransformQZ[ti], bos.TransformQW[ti],
    bos.TransformSX[ti], bos.TransformSY[ti], bos.TransformSZ[ti],
  );

interface Bucket {
  readonly mesh: MeshBuffers;
  readonly metalness: number;
  readonly roughness: number;
  readonly opacity: number;
  readonly transforms: number[];
  readonly colors: number[];
  /** Entity id per instance (see bosEntityId), aligned with instance indices. */
  readonly entities: number[];
}

/** Maps each produced group's instances back to entity ids (see bosEntityId). */
export interface BosGroupEntities {
  readonly group: InstancedGroup;
  readonly entities: readonly number[];
}

export interface BosConvertResult extends ConvertResult {
  readonly groupEntities: readonly BosGroupEntities[];
}

/**
 * Converts decoded BOS geometry tables into InstancedGroups: instances sharing
 * a mesh and material parameters merge into one group, with the material color
 * carried per instance. Hidden instances (flags & 0x1) are skipped.
 * Groups are emitted through `onGroup` as each one is finished.
 */
// TODO: honor per-instance visibility as a group split instead of dropping hidden instances.
export function bosToGroups(bos: BosGeometry, onGroup?: GroupCallback): BosConvertResult {
  const meshCache = new Map<number, MeshBuffers | null>();
  const buckets = new Map<string, Bucket>();
  let instanceCount = 0;

  const n = bos.InstanceMeshIndex.length;
  for (let i = 0; i < n; i++) {
    const meshIndex = bos.InstanceMeshIndex[i];
    if (meshIndex < 0) continue;
    if (bos.InstanceFlags[i] & HIDDEN_FLAG) continue;

    let mesh = meshCache.get(meshIndex);
    if (mesh === undefined) {
      mesh = bosMeshBuffers(bos, meshIndex);
      meshCache.set(meshIndex, mesh);
    }
    if (!mesh) continue;

    const mi = bos.InstanceMaterialIndex[i];
    const metalness = (bos.MaterialMetallic[mi] ?? 0) / 255;
    const roughness = (bos.MaterialRoughness[mi] ?? 128) / 255;
    const alpha = (bos.MaterialAlpha[mi] ?? 255) / 255;

    const key = `${meshIndex}|${metalness},${roughness},${alpha}`;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = {
        mesh, metalness, roughness, opacity: alpha,
        transforms: [], colors: [], entities: [],
      };
      buckets.set(key, bucket);
    }
    bucket.transforms.push(...bosTransform(bos, bos.InstanceTransformIndex[i]));
    bucket.colors.push(
      (bos.MaterialRed[mi] ?? 255) / 255,
      (bos.MaterialGreen[mi] ?? 255) / 255,
      (bos.MaterialBlue[mi] ?? 255) / 255,
      alpha,
    );
    bucket.entities.push(bosEntityId(bos, bos.InstanceEntityIndex[i]));
    instanceCount++;
  }

  const flat = [...buckets.values()];
  const groups: InstancedGroup[] = [];
  const groupEntities: BosGroupEntities[] = [];
  for (let i = 0; i < flat.length; i++) {
    const b = flat[i];
    const count = b.transforms.length / 16;
    const group = new InstancedGroup(
      b.mesh,
      { metalness: b.metalness, roughness: b.roughness, opacity: b.opacity },
      Math.max(1, count),
    );
    group.append(Float32Array.from(b.transforms), Float32Array.from(b.colors));
    groups.push(group);
    groupEntities.push({ group, entities: b.entities });
    onGroup?.(group, i, flat.length);
  }
  return { groups, instanceCount, groupEntities };
}
