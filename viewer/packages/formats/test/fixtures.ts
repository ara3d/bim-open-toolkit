/**
 * Fixtures built in memory. No file on disk, no private data, nothing shared with another package.
 *
 * The BFAST writer here is this package's own, written from the container specification, because the
 * loaders package does not export one. It is deliberately naive: it aligns and writes, and never
 * checks what it is given, so a test can write a broken file on purpose.
 */

const alignment = 64;
const preambleBytes = 32;
const rangeBytes = 16;
const align = (value: number): number => Math.ceil(value / alignment) * alignment;

export type NamedBuffer = { readonly name: string; readonly bytes: Uint8Array };

// Packs named buffers into BFAST bytes: preamble, ranges, the NUL separated names, then the payloads.
export function writeBfast(buffers: readonly NamedBuffer[]): Uint8Array {
  const names = new TextEncoder().encode(buffers.map((each) => each.name).join('\0') + '\0');
  const payloads = [names, ...buffers.map((each) => each.bytes)];
  const ranges: [number, number][] = [];
  let at = align(preambleBytes + payloads.length * rangeBytes);
  for (const payload of payloads) {
    ranges.push([at, at + payload.byteLength]);
    at = align(at + payload.byteLength);
  }
  const last = ranges[ranges.length - 1] ?? [0, 0];
  const out = new Uint8Array(align(last[1]));
  const view = new DataView(out.buffer);
  view.setBigInt64(0, BigInt(0xbfa5), true);
  view.setBigInt64(8, BigInt(ranges[0]?.[0] ?? 0), true);
  view.setBigInt64(16, BigInt(last[1]), true);
  view.setBigInt64(24, BigInt(payloads.length), true);
  ranges.forEach(([begin, end], index) => {
    view.setBigInt64(preambleBytes + index * rangeBytes, BigInt(begin), true);
    view.setBigInt64(preambleBytes + index * rangeBytes + 8, BigInt(end), true);
  });
  payloads.forEach((payload, index) => out.set(payload, ranges[index]?.[0] ?? 0));
  return out;
}

// One mesh of a fixture model: xyz positions and mesh-local triangle indices.
export type FixtureMesh = { readonly positions: readonly number[]; readonly indices: readonly number[] };

// One placement of a fixture model. `mesh` is -1 for a placement with no geometry.
export type FixtureInstance = {
  readonly mesh: number;
  readonly entity: number;
  /** Three rows of a 3x4 matrix, translation in the fourth column of each row. Identity by default. */
  readonly rows?: readonly number[];
  /** RGBA, one byte per channel. Opaque white by default. */
  readonly color?: readonly [number, number, number, number];
  readonly hidden?: boolean;
  /**
   * Roughness and metallic, one byte each, as the converter packs them. The defaults are the bytes
   * that mean the model contract's own defaults, 255 for fully diffuse and 0 for not metal, so an
   * instance that says nothing about its surface produces no material column.
   */
  readonly roughness?: number;
  readonly metallic?: number;
};

// Three rows of a 3x4 matrix that translates by the given offset.
export const translationRows = (x: number, y: number, z: number): readonly number[] =>
  [1, 0, 0, x, 0, 1, 0, y, 0, 0, 1, z];

// A unit triangle in the xy plane.
export const triangleMesh = (): FixtureMesh => ({
  positions: [0, 0, 0, 1, 0, 0, 0, 1, 0],
  indices: [0, 1, 2],
});

// A second mesh with different vertices, so a test can tell the two apart.
export const squareMesh = (): FixtureMesh => ({
  positions: [0, 0, 0, 2, 0, 0, 2, 2, 0, 0, 2, 0],
  indices: [0, 1, 2, 0, 2, 3],
});

export type BfastModelSpec = {
  readonly meshes: readonly FixtureMesh[];
  readonly instances: readonly FixtureInstance[];
  /** Extra buffers, such as `BOS/Entities.parquet`, added after the render buffers. */
  readonly extras?: readonly NamedBuffer[];
  /** Written into the meta block. 3 is what the loader accepts. */
  readonly primitiveSize?: number;
  readonly flags?: number;
};

const bytesOf = (array: ArrayBufferView): Uint8Array =>
  new Uint8Array(array.buffer, array.byteOffset, array.byteLength);

// Builds the render-model buffers of a BFAST file and packs them.
export function bfastModel(spec: BfastModelSpec): Uint8Array {
  const positions: number[] = [];
  const indices: number[] = [];
  const slices: number[] = [];
  const meshBounds: number[] = [];
  for (const each of spec.meshes) {
    const baseVertex = positions.length / 3;
    const firstIndex = indices.length;
    positions.push(...each.positions);
    indices.push(...each.indices);
    slices.push(baseVertex, each.positions.length / 3, firstIndex, each.indices.length);
    meshBounds.push(...boundsOf(each.positions));
  }
  const instanceWords = new Int32Array(spec.instances.length * 16);
  const instanceFloats = new Float32Array(instanceWords.buffer);
  const instanceBounds: number[] = [];
  spec.instances.forEach((instance, row) => {
    const rows = instance.rows ?? translationRows(0, 0, 0);
    instanceFloats.set(rows, row * 16);
    instanceWords[row * 16 + 12] = instance.mesh;
    instanceWords[row * 16 + 13] = instance.entity;
    const [red, green, blue, alpha] = instance.color ?? [255, 255, 255, 255];
    instanceWords[row * 16 + 14] = (red | (green << 8) | (blue << 16) | (alpha << 24)) | 0;
    const material = ((instance.roughness ?? 255) | ((instance.metallic ?? 0) << 8)) << 16;
    instanceWords[row * 16 + 15] = material | ((instance.hidden === true ? 1 : 0) << 8);
    instanceBounds.push(0, 0, 0, 1, 1, 1);
  });

  const meta = new ArrayBuffer(48);
  const metaView = new DataView(meta);
  const bounds = boundsOf(positions);
  bounds.forEach((value, at) => metaView.setFloat32(at * 4, value, true));
  metaView.setBigInt64(24, BigInt(positions.length / 3), true);
  metaView.setBigInt64(32, BigInt(indices.length / 3), true);
  metaView.setInt32(40, spec.primitiveSize ?? 3, true);
  metaView.setInt32(44, spec.flags ?? 0, true);

  return writeBfast([
    { name: 'VertexData', bytes: bytesOf(Float32Array.from(positions)) },
    { name: 'IndexData', bytes: bytesOf(Uint32Array.from(indices)) },
    { name: 'MeshSliceData', bytes: bytesOf(Int32Array.from(slices)) },
    { name: 'InstanceData', bytes: bytesOf(instanceWords) },
    { name: 'MeshBoundsData', bytes: bytesOf(Float32Array.from(meshBounds)) },
    { name: 'InstanceBoundsData', bytes: bytesOf(Float32Array.from(instanceBounds)) },
    { name: 'Meta', bytes: new Uint8Array(meta) },
    ...(spec.extras ?? []),
  ]);
}

// min xyz then max xyz of an xyz position list, as the file stores it.
function boundsOf(positions: readonly number[]): number[] {
  if (positions.length === 0) return [0, 0, 0, 0, 0, 0];
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (let at = 0; at + 2 < positions.length; at += 3)
    for (let axis = 0; axis < 3; axis += 1) {
      const value = positions[at + axis] ?? 0;
      min[axis] = Math.min(min[axis] ?? value, value);
      max[axis] = Math.max(max[axis] ?? value, value);
    }
  return [...min, ...max];
}

// A model with two meshes and three placements, one of them geometry-free. Used by several tests.
export const sampleBfast = (): Uint8Array =>
  bfastModel({
    meshes: [triangleMesh(), squareMesh()],
    instances: [
      { mesh: 0, entity: 0 },
      { mesh: 1, entity: 1, rows: translationRows(5, 0, 0), color: [255, 0, 0, 128] },
      { mesh: -1, entity: 2 },
    ],
  });

// The bytes as a standalone ArrayBuffer, which is what the loaders take.
export const asBuffer = (bytes: Uint8Array): ArrayBuffer => bytes.slice().buffer;

// ---------------------------------------------------------------------------
// glTF, OBJ and STL fixtures.
// ---------------------------------------------------------------------------

const padded = (length: number): number => Math.ceil(length / 4) * 4;

/** Packs a glTF JSON document and an optional binary chunk into a GLB container. */
export function writeGlb(json: unknown, binary?: Uint8Array): Uint8Array {
  const text = new TextEncoder().encode(JSON.stringify(json));
  const jsonLength = padded(text.byteLength);
  const binaryLength = binary === undefined ? 0 : padded(binary.byteLength);
  const total = 12 + 8 + jsonLength + (binary === undefined ? 0 : 8 + binaryLength);
  const out = new Uint8Array(total);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, total, true);
  view.setUint32(12, jsonLength, true);
  view.setUint32(16, 0x4e4f534a, true);
  out.fill(0x20, 20 + text.byteLength, 20 + jsonLength);
  out.set(text, 20);
  if (binary !== undefined) {
    const at = 20 + jsonLength;
    view.setUint32(at, binaryLength, true);
    view.setUint32(at + 4, 0x004e4942, true);
    out.set(binary, at + 8);
  }
  return out;
}

/** The bytes a triangle glTF refers to: three positions then three unsigned short indices. */
export const triangleBuffer = (): Uint8Array => {
  const out = new Uint8Array(padded(36) + padded(6));
  new Float32Array(out.buffer, 0, 9).set([0, 0, 0, 1, 0, 0, 0, 1, 0]);
  new Uint16Array(out.buffer, 36, 3).set([0, 1, 2]);
  return out;
};

/**
 * A document with one mesh placed by two nodes, the second a child translated along x, with a red
 * half-transparent material. The buffer is left for the caller to supply as a chunk or a data uri.
 */
export const triangleGltfJson = (bufferUri?: string): unknown => ({
  asset: { version: '2.0' },
  scene: 0,
  scenes: [{ nodes: [0] }],
  nodes: [
    { name: 'root', children: [1] },
    { name: 'placed', mesh: 0, translation: [2, 0, 0] },
  ],
  meshes: [{ primitives: [{ attributes: { POSITION: 0 }, indices: 1, material: 0 }] }],
  materials: [{ pbrMetallicRoughness: { baseColorFactor: [1, 0, 0, 0.5] } }],
  accessors: [
    { bufferView: 0, componentType: 5126, count: 3, type: 'VEC3' },
    { bufferView: 1, componentType: 5123, count: 3, type: 'SCALAR' },
  ],
  bufferViews: [
    { buffer: 0, byteOffset: 0, byteLength: 36 },
    { buffer: 0, byteOffset: 36, byteLength: 6 },
  ],
  buffers: [{ byteLength: padded(36) + padded(6), ...(bufferUri === undefined ? {} : { uri: bufferUri }) }],
});

// The same document as a GLB with its buffer in the binary chunk.
export const triangleGlb = (): Uint8Array => writeGlb(triangleGltfJson(), triangleBuffer());

// The same document as JSON text whose buffer is an external file the resolver must supply.
export const triangleGltfText = (uri = 'scene.bin'): string => JSON.stringify(triangleGltfJson(uri));

/** Packs triangles into a binary STL. Each triangle is a normal and three vertices. */
export function writeBinaryStl(
  triangles: readonly { readonly normal: readonly number[]; readonly corners: readonly number[] }[],
  header = 'fixture',
): Uint8Array {
  const out = new Uint8Array(84 + triangles.length * 50);
  const view = new DataView(out.buffer);
  out.set(new TextEncoder().encode(header).subarray(0, 80));
  view.setUint32(80, triangles.length, true);
  triangles.forEach((triangle, index) => {
    const at = 84 + index * 50;
    triangle.normal.forEach((value, axis) => view.setFloat32(at + axis * 4, value, true));
    triangle.corners.forEach((value, offset) => view.setFloat32(at + 12 + offset * 4, value, true));
  });
  return out;
}

// One triangle, for the binary STL fixtures.
export const stlTriangle = (): { readonly normal: readonly number[]; readonly corners: readonly number[] } => ({
  normal: [0, 0, 1],
  corners: [0, 0, 0, 1, 0, 0, 0, 1, 0],
});

// The same triangle written as ASCII STL.
export const asciiStlText = (name = 'fixture'): string =>
  `solid ${name}\n` +
  '  facet normal 0 0 1\n    outer loop\n      vertex 0 0 0\n      vertex 1 0 0\n      vertex 0 1 0\n    endloop\n  endfacet\n' +
  `endsolid ${name}\n`;
