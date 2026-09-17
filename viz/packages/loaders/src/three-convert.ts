import {
  BufferAttribute,
  BufferGeometry,
  InstancedMesh,
  InterleavedBufferAttribute,
  Material,
  Matrix4,
  Mesh,
  Object3D,
} from 'three';
import {
  InstancedGroup,
  MaterialConfig,
  MeshBuffers,
  defaultMaterial,
} from '@ara3d/viewer-core';
import { ConvertResult, GroupCallback } from './groups.js';

type Attribute = BufferAttribute | InterleavedBufferAttribute;

const attributeToFloat32 = (attr: Attribute): Float32Array => {
  if (
    attr instanceof BufferAttribute &&
    attr.array instanceof Float32Array &&
    attr.itemSize === 3
  )
    return attr.array;
  const out = new Float32Array(attr.count * 3);
  for (let i = 0; i < attr.count; i++) {
    out[i * 3] = attr.getX(i);
    out[i * 3 + 1] = attr.getY(i);
    out[i * 3 + 2] = attr.getZ(i);
  }
  return out;
};

/** Extracts viewer-core MeshBuffers from a three geometry; null if it has no vertices. */
export function toMeshBuffers(geometry: BufferGeometry): MeshBuffers | null {
  const position = geometry.getAttribute('position') as Attribute | undefined;
  if (!position || position.count === 0) return null;
  const normal = geometry.getAttribute('normal') as Attribute | undefined;
  const index = geometry.index;
  return {
    positions: attributeToFloat32(position),
    normals: normal ? attributeToFloat32(normal) : undefined,
    indices: index
      ? index.array instanceof Uint32Array
        ? index.array
        : new Uint32Array(index.array as ArrayLike<number>)
      : undefined,
  };
}

/** Material parameters relevant to viewer-core: shared config + per-instance RGBA. */
export interface MaterialInfo {
  readonly config: MaterialConfig;
  readonly color: readonly [number, number, number, number];
}

interface ColorLike {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

/** Reads config and color off any three material (missing fields fall back to defaults). */
// TODO: multi-material meshes (material arrays with geometry groups) use only the first material.
export function materialInfo(material: Material | Material[] | undefined): MaterialInfo {
  const m = (Array.isArray(material) ? material[0] : material) as
    | (Material & { color?: ColorLike; metalness?: number; roughness?: number })
    | undefined;
  const opacity = m?.opacity ?? defaultMaterial.opacity;
  return {
    config: {
      metalness: m?.metalness ?? defaultMaterial.metalness,
      roughness: m?.roughness ?? defaultMaterial.roughness,
      opacity,
    },
    color: m?.color ? [m.color.r, m.color.g, m.color.b, opacity] : [1, 1, 1, opacity],
  };
}

const configKey = (c: MaterialConfig): string =>
  `${c.metalness},${c.roughness},${c.opacity}`;

interface Bucket {
  readonly mesh: MeshBuffers;
  readonly config: MaterialConfig;
  readonly transforms: number[];
  readonly colors: number[];
}

/**
 * Converts a three object hierarchy into InstancedGroups: node transforms are
 * baked into per-instance world matrices, and meshes sharing the same geometry
 * and material parameters merge into one group (per-instance color carries the
 * material color). Source InstancedMeshes are flattened into instances too.
 *
 * Groups are emitted through `onGroup` as each one is finished, so callers can
 * append them to a scene progressively.
 */
export function convertObject(root: Object3D, onGroup?: GroupCallback): ConvertResult {
  root.updateWorldMatrix(true, true);

  const meshCache = new Map<BufferGeometry, MeshBuffers | null>();
  const buckets = new Map<BufferGeometry, Map<string, Bucket>>();
  let instanceCount = 0;

  const bucketFor = (geometry: BufferGeometry, info: MaterialInfo): Bucket | null => {
    let mesh = meshCache.get(geometry);
    if (mesh === undefined) {
      mesh = toMeshBuffers(geometry);
      meshCache.set(geometry, mesh);
    }
    if (!mesh) return null;
    let byConfig = buckets.get(geometry);
    if (!byConfig) {
      byConfig = new Map();
      buckets.set(geometry, byConfig);
    }
    const key = configKey(info.config);
    let bucket = byConfig.get(key);
    if (!bucket) {
      bucket = { mesh, config: info.config, transforms: [], colors: [] };
      byConfig.set(key, bucket);
    }
    return bucket;
  };

  const addInstance = (bucket: Bucket, world: Matrix4, color: readonly number[]): void => {
    bucket.transforms.push(...world.elements);
    bucket.colors.push(color[0], color[1], color[2], color[3]);
    instanceCount++;
  };

  const local = new Matrix4();
  const world = new Matrix4();
  root.traverse((obj) => {
    const mesh = obj as Mesh;
    if (!mesh.isMesh) return;
    const info = materialInfo(mesh.material);
    const bucket = bucketFor(mesh.geometry, info);
    if (!bucket) return;
    const instanced = obj as InstancedMesh;
    if (instanced.isInstancedMesh) {
      for (let i = 0; i < instanced.count; i++) {
        instanced.getMatrixAt(i, local);
        world.multiplyMatrices(obj.matrixWorld, local);
        addInstance(bucket, world, info.color);
      }
    } else {
      addInstance(bucket, obj.matrixWorld, info.color);
    }
  });

  const flat: Bucket[] = [];
  for (const byConfig of buckets.values())
    for (const bucket of byConfig.values()) flat.push(bucket);

  const groups: InstancedGroup[] = [];
  for (let i = 0; i < flat.length; i++) {
    const b = flat[i];
    const n = b.transforms.length / 16;
    const group = new InstancedGroup(b.mesh, b.config, Math.max(1, n));
    group.append(Float32Array.from(b.transforms), Float32Array.from(b.colors));
    groups.push(group);
    onGroup?.(group, i, flat.length);
  }
  return { groups, instanceCount };
}
