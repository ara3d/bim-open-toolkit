import {
  BufferAttribute,
  BufferGeometry,
  MeshStandardMaterial,
} from 'three';
import { BosGeometry } from '../src/bos-geometry.js';

export const triangleGeometry = (): BufferGeometry => {
  const g = new BufferGeometry();
  g.setAttribute(
    'position',
    new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3),
  );
  g.setIndex(new BufferAttribute(new Uint16Array([0, 1, 2]), 1));
  return g;
};

export const standardMaterial = (
  color: number,
  overrides: Partial<MeshStandardMaterial> = {},
): MeshStandardMaterial => {
  const m = new MeshStandardMaterial({ color });
  Object.assign(m, overrides);
  return m;
};

/** Builds a valid binary GLB from a glTF JSON document + BIN payload. */
export function buildGlb(json: object, bin: Uint8Array): ArrayBuffer {
  const enc = new TextEncoder();
  let jsonBytes = enc.encode(JSON.stringify(json));
  while (jsonBytes.length % 4 !== 0)
    jsonBytes = new Uint8Array([...jsonBytes, 0x20]); // pad with spaces
  const binPadded = new Uint8Array(Math.ceil(bin.length / 4) * 4);
  binPadded.set(bin);

  const total = 12 + 8 + jsonBytes.length + 8 + binPadded.length;
  const out = new ArrayBuffer(total);
  const dv = new DataView(out);
  const u8 = new Uint8Array(out);
  let o = 0;
  dv.setUint32(o, 0x46546c67, true); o += 4; // 'glTF'
  dv.setUint32(o, 2, true); o += 4;
  dv.setUint32(o, total, true); o += 4;
  dv.setUint32(o, jsonBytes.length, true); o += 4;
  dv.setUint32(o, 0x4e4f534a, true); o += 4; // 'JSON'
  u8.set(jsonBytes, o); o += jsonBytes.length;
  dv.setUint32(o, binPadded.length, true); o += 4;
  dv.setUint32(o, 0x004e4942, true); o += 4; // 'BIN'
  u8.set(binPadded, o);
  return out;
}

/**
 * A minimal GLB: one triangle mesh referenced by two nodes (the second
 * translated by +2 in x), so a correct converter merges them into one group
 * with two instances.
 */
export function twoNodeTriangleGlb(): ArrayBuffer {
  const positions = new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]);
  const indices = new Uint16Array([0, 1, 2]);
  const bin = new Uint8Array(48);
  bin.set(new Uint8Array(positions.buffer), 0); // 36 bytes
  bin.set(new Uint8Array(indices.buffer), 36); // 6 bytes
  const json = {
    asset: { version: '2.0' },
    scene: 0,
    scenes: [{ nodes: [0, 1] }],
    nodes: [{ mesh: 0 }, { mesh: 0, translation: [2, 0, 0] }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    accessors: [
      {
        bufferView: 0, componentType: 5126, count: 3, type: 'VEC3',
        min: [0, 0, 0], max: [1, 1, 0],
      },
      { bufferView: 1, componentType: 5123, count: 3, type: 'SCALAR' },
    ],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: 36 },
      { buffer: 0, byteOffset: 36, byteLength: 6 },
    ],
    buffers: [{ byteLength: 48 }],
  };
  return buildGlb(json, bin);
}

/**
 * Hand-built BOS tables: 2 meshes (triangle, quad), 2 materials, 4 instances —
 * instances 0 and 1 share mesh 0 + material 0, instance 2 uses mesh 1 +
 * material 1, instance 3 is hidden (flags & 1).
 */
export function sampleBosGeometry(overrides: Partial<BosGeometry> = {}): BosGeometry {
  const s = BOS_SCALE;
  return {
    InstanceEntityIndex: new Int32Array([10, 11, 12, 13]),
    InstanceMaterialIndex: new Int32Array([0, 0, 1, 0]),
    InstanceMeshIndex: new Int32Array([0, 0, 1, 0]),
    InstanceTransformIndex: new Int32Array([0, 1, 0, 0]),
    InstanceFlags: new Uint8Array([0, 0, 0, 1]),
    // mesh 0: 3 vertices; mesh 1: 4 vertices
    VertexX: new Int32Array([0, s, 0, 0, s, s, 0]),
    VertexY: new Int32Array([0, 0, s, 0, 0, s, s]),
    VertexZ: new Int32Array([0, 0, 0, 0, 0, 0, 0]),
    // mesh 0: 1 triangle; mesh 1: 2 triangles (mesh-local indices)
    IndexBuffer: new Int32Array([0, 1, 2, 0, 1, 2, 0, 2, 3]),
    MeshVertexOffset: new Int32Array([0, 3]),
    MeshIndexOffset: new Int32Array([0, 3]),
    MaterialRed: new Uint8Array([255, 0]),
    MaterialGreen: new Uint8Array([0, 255]),
    MaterialBlue: new Uint8Array([0, 0]),
    MaterialAlpha: new Uint8Array([255, 128]),
    MaterialRoughness: new Uint8Array([204, 51]),
    MaterialMetallic: new Uint8Array([0, 255]),
    TransformTX: new Float32Array([0, 5]),
    TransformTY: new Float32Array([0, 0]),
    TransformTZ: new Float32Array([0, 0]),
    TransformQX: new Float32Array([0, 0]),
    TransformQY: new Float32Array([0, 0]),
    TransformQZ: new Float32Array([0, 0]),
    TransformQW: new Float32Array([1, 1]),
    TransformSX: new Float32Array([1, 2]),
    TransformSY: new Float32Array([1, 2]),
    TransformSZ: new Float32Array([1, 2]),
    ...overrides,
  };
}

export const BOS_SCALE = 10_000;
