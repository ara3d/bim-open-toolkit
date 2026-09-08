import {
  boundsOfPositions,
  colorStride,
  identityMatrix,
  multiplyMatrix,
  objectRef,
  transformStride,
  type CoordinateContext,
  type Diagnostic,
  type Geometry,
  type Matrix4,
  type Mesh,
  type ModelData,
  type ModelRef,
  type ObjectRecord,
} from '@bim-open-toolkit/model';
import { fail, formatCode, formatNote, formatWarning, requireThat } from './diagnostics.js';
import { defaultModelRef } from './bfast.js';
import { loadedModel, type LoadedModel } from './loaded-model.js';
import { reportProgress, throwIfCancelled, type LoadContext } from './progress.js';
import { noResolver, type Resolver } from './resolver.js';

/**
 * glTF says its own frame: right-handed, Y up, distances in metres. This is the only supported
 * format that states its units, so a glTF model needs no assumption from the caller.
 */
export const gltfCoordinates: CoordinateContext = {
  units: 'metres',
  up: 'y',
  registration: { kind: 'local' },
};

export type GltfOptions = LoadContext & {
  readonly ref?: ModelRef;
  readonly coordinates?: CoordinateContext;
  /** How a `.gltf` reaches the files it names. Nothing is fetched unless a host supplies one. */
  readonly resolver?: Resolver;
};

// Bytes of the GLB header, and the chunk type words for the JSON and the binary chunk.
const glbHeaderBytes = 12;
const glbChunkHeaderBytes = 8;
const glbMagic = 0x46546c67;
const jsonChunk = 0x4e4f534a;
const binaryChunk = 0x004e4942;

// Bytes of one accessor component, by glTF component type.
const componentBytes: Readonly<Record<number, number>> = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };

// Components of one accessor element, by glTF element type.
const typeComponents: Readonly<Record<string, number>> = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT2: 4, MAT3: 9, MAT4: 16 };

// The only primitive mode this adapter draws. The rest are reported and skipped.
const triangleMode = 4;

/** A glTF document: its JSON as unvalidated data, and the binary buffers it refers to. */
export type GltfDocument = {
  readonly json: unknown;
  readonly buffers: readonly Uint8Array[];
  readonly diagnostics: readonly Diagnostic[];
};

// True when the bytes are a GLB container rather than a bare glTF JSON document.
export const isGlb = (bytes: Uint8Array): boolean =>
  bytes.byteLength >= 4 && new DataView(bytes.buffer, bytes.byteOffset, 4).getUint32(0, true) === glbMagic;

// True when the value is a JSON object rather than an array, a primitive or null.
const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const memberOf = (value: unknown, key: string): unknown => (isRecord(value) ? value[key] : undefined);
const listOf = (value: unknown): readonly unknown[] => (Array.isArray(value) ? value : []);
const itemOf = (value: unknown, key: string, index: number): unknown => listOf(memberOf(value, key))[index];
const numberOf = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;
const stringOf = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);
const numbersOf = (value: unknown): readonly number[] =>
  listOf(value).map((each) => numberOf(each) ?? Number.NaN);

/**
 * Splits a GLB container into its JSON chunk and its binary chunk.
 *
 * A `.gltf` is the same document without the container, so both formats meet here and everything
 * after this point is shared.
 */
export function readGlbChunks(bytes: Uint8Array): { readonly json: string; readonly binary: Uint8Array | undefined } {
  requireThat(bytes.byteLength >= glbHeaderBytes + glbChunkHeaderBytes, formatCode.invalidGltf, () => 'The GLB is too short to hold a header');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  requireThat(view.getUint32(0, true) === glbMagic, formatCode.invalidGltf, () => 'The file does not start with the glTF magic');
  const version = view.getUint32(4, true);
  requireThat(version === 2, formatCode.invalidGltf, () => `GLB version ${version} is not supported; only version 2 is`);
  const declared = view.getUint32(8, true);
  requireThat(declared <= bytes.byteLength, formatCode.invalidGltf, () => `The GLB declares ${declared} bytes but only ${bytes.byteLength} are present`);

  let json: string | undefined;
  let binary: Uint8Array | undefined;
  for (let at = glbHeaderBytes; at + glbChunkHeaderBytes <= declared; ) {
    const length = view.getUint32(at, true);
    const kind = view.getUint32(at + 4, true);
    at += glbChunkHeaderBytes;
    requireThat(at + length <= declared, formatCode.invalidGltf, () => 'A GLB chunk runs past the end of the file');
    if (kind === jsonChunk) json = new TextDecoder().decode(bytes.subarray(at, at + length));
    if (kind === binaryChunk) binary = bytes.subarray(at, at + length);
    at += length;
  }
  if (json === undefined) fail(formatCode.invalidGltf, 'The GLB has no JSON chunk');
  return { json, binary };
}

/**
 * Reads a glTF document: the JSON, then every buffer it names.
 *
 * A data URI is decoded in place. Any other uri is a file the document does not contain, so it goes
 * to the resolver, and without one the load fails naming the uri rather than reaching for it.
 */
export async function readGltfDocument(
  bytes: Uint8Array,
  options: GltfOptions,
): Promise<GltfDocument> {
  const chunks = isGlb(bytes) ? readGlbChunks(bytes) : { json: new TextDecoder().decode(bytes), binary: undefined };
  const json: unknown = parseJson(chunks.json);
  const required = listOf(memberOf(json, 'extensionsRequired')).map(stringOf).filter((each) => each !== undefined);
  if (required.length > 0)
    fail(formatCode.invalidGltf, `This document requires ${required.join(', ')}, which this adapter does not implement`);

  const resolver = options.resolver ?? noResolver;
  const declared = listOf(memberOf(json, 'buffers'));
  const buffers: Uint8Array[] = [];
  const diagnostics: Diagnostic[] = [];
  for (const [index, each] of declared.entries()) {
    throwIfCancelled(options);
    const uri = stringOf(memberOf(each, 'uri'));
    if (uri === undefined) {
      if (chunks.binary === undefined) fail(formatCode.invalidGltf, `Buffer ${index} has no uri and the file has no binary chunk`);
      buffers.push(chunks.binary);
    } else if (uri.startsWith('data:')) {
      buffers.push(decodeDataUri(uri));
    } else {
      buffers.push(new Uint8Array(await resolver.resolve(uri, options)));
    }
  }
  if (listOf(memberOf(json, 'animations')).length > 0)
    diagnostics.push(formatWarning(formatCode.droppedAnimation, 'Animation clips are not carried; the geometry uses its initial pose'));
  if (listOf(memberOf(json, 'textures')).length > 0)
    diagnostics.push(formatWarning(formatCode.droppedTextures, 'Textures are not carried; each placement keeps its material base colour only'));
  return { json, buffers, diagnostics };
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch (error) {
    return fail(formatCode.invalidGltf, `The glTF JSON could not be parsed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// Decodes a base64 or percent-encoded data uri into its bytes.
function decodeDataUri(uri: string): Uint8Array {
  const comma = uri.indexOf(',');
  requireThat(comma > 0, formatCode.invalidGltf, () => 'A data uri has no comma');
  const head = uri.slice(0, comma);
  const body = uri.slice(comma + 1);
  if (!head.endsWith(';base64')) return new TextEncoder().encode(decodeURIComponent(body));
  const binary = atob(body);
  const out = new Uint8Array(binary.length);
  for (let at = 0; at < binary.length; at += 1) out[at] = binary.charCodeAt(at);
  return out;
}

/** The values of one accessor as floats, with normalized integers scaled and sparse values applied. */
export function readAccessor(document: GltfDocument, index: number): Float32Array {
  const accessor = itemOf(document.json, 'accessors', index);
  if (accessor === undefined) fail(formatCode.invalidGltf, `Accessor ${index} is not in the document`);
  const count = numberOf(memberOf(accessor, 'count')) ?? 0;
  const type = stringOf(memberOf(accessor, 'type')) ?? '';
  const components = typeComponents[type];
  if (components === undefined) fail(formatCode.invalidGltf, `Accessor ${index} has element type "${type}"`);
  const componentType = numberOf(memberOf(accessor, 'componentType')) ?? 0;
  const out = new Float32Array(count * components);
  const view = numberOf(memberOf(accessor, 'bufferView'));
  if (view !== undefined)
    readInto(out, document, view, numberOf(memberOf(accessor, 'byteOffset')) ?? 0, count, components, componentType,
      memberOf(accessor, 'normalized') === true);
  applySparse(out, document, memberOf(accessor, 'sparse'), components, componentType, index);
  return out;
}

// Copies `count` elements of `components` each out of a buffer view into `out`.
function readInto(
  out: Float32Array,
  document: GltfDocument,
  viewIndex: number,
  accessorOffset: number,
  count: number,
  components: number,
  componentType: number,
  normalized: boolean,
): void {
  const size = componentBytes[componentType];
  if (size === undefined) fail(formatCode.invalidGltf, `Component type ${componentType} is not a glTF component type`);
  const view = itemOf(document.json, 'bufferViews', viewIndex);
  if (view === undefined) fail(formatCode.invalidGltf, `Buffer view ${viewIndex} is not in the document`);
  const buffer = document.buffers[numberOf(memberOf(view, 'buffer')) ?? -1];
  if (buffer === undefined) fail(formatCode.invalidGltf, `Buffer view ${viewIndex} names a buffer that is not loaded`);
  const viewOffset = numberOf(memberOf(view, 'byteOffset')) ?? 0;
  const stride = numberOf(memberOf(view, 'byteStride')) ?? components * size;
  const start = viewOffset + accessorOffset;
  const needed = count === 0 ? 0 : start + (count - 1) * stride + components * size;
  requireThat(needed <= buffer.byteLength, formatCode.invalidGltf, () => `Buffer view ${viewIndex} needs ${needed} bytes of a ${buffer.byteLength} byte buffer`);
  const bytes = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
  for (let element = 0; element < count; element += 1)
    for (let component = 0; component < components; component += 1)
      out[element * components + component] = componentAt(bytes, start + element * stride + component * size, componentType, normalized);
}

// One component read at a byte offset, scaled to 0..1 or -1..1 when the accessor is normalized.
function componentAt(bytes: DataView, at: number, componentType: number, normalized: boolean): number {
  switch (componentType) {
    case 5120:
      return normalized ? Math.max(bytes.getInt8(at) / 127, -1) : bytes.getInt8(at);
    case 5121:
      return normalized ? bytes.getUint8(at) / 255 : bytes.getUint8(at);
    case 5122:
      return normalized ? Math.max(bytes.getInt16(at, true) / 32767, -1) : bytes.getInt16(at, true);
    case 5123:
      return normalized ? bytes.getUint16(at, true) / 65535 : bytes.getUint16(at, true);
    case 5125:
      return bytes.getUint32(at, true);
    default:
      return bytes.getFloat32(at, true);
  }
}

// Overwrites the elements a sparse accessor replaces.
function applySparse(
  out: Float32Array,
  document: GltfDocument,
  sparse: unknown,
  components: number,
  componentType: number,
  index: number,
): void {
  if (!isRecord(sparse)) return;
  const count = numberOf(memberOf(sparse, 'count')) ?? 0;
  const indices = memberOf(sparse, 'indices');
  const values = memberOf(sparse, 'values');
  const rows = new Float32Array(count);
  readInto(rows, document, numberOf(memberOf(indices, 'bufferView')) ?? -1, numberOf(memberOf(indices, 'byteOffset')) ?? 0,
    count, 1, numberOf(memberOf(indices, 'componentType')) ?? 5125, false);
  const replacement = new Float32Array(count * components);
  readInto(replacement, document, numberOf(memberOf(values, 'bufferView')) ?? -1, numberOf(memberOf(values, 'byteOffset')) ?? 0,
    count, components, componentType, false);
  for (let row = 0; row < count; row += 1) {
    const target = rows[row] ?? -1;
    requireThat(target >= 0 && (target + 1) * components <= out.length, formatCode.invalidGltf,
      () => `Sparse accessor ${index} replaces element ${target}, which it does not have`);
    for (let component = 0; component < components; component += 1)
      out[target * components + component] = replacement[row * components + component] ?? 0;
  }
}

// The local transform of a node: its matrix when it has one, else translation times rotation times scale.
export function nodeTransform(node: unknown): Matrix4 {
  const matrix = numbersOf(memberOf(node, 'matrix'));
  if (matrix.length === 16) return sixteen(matrix);
  const [tx, ty, tz] = [...numbersOf(memberOf(node, 'translation')), 0, 0, 0];
  const rotation = numbersOf(memberOf(node, 'rotation'));
  const [sx, sy, sz] = [...numbersOf(memberOf(node, 'scale')), 1, 1, 1];
  const [qx, qy, qz, qw] = rotation.length === 4 ? rotation : [0, 0, 0, 1];
  return composeTrs(tx ?? 0, ty ?? 0, tz ?? 0, qx ?? 0, qy ?? 0, qz ?? 0, qw ?? 1, sx ?? 1, sy ?? 1, sz ?? 1);
}

// Translation, a unit quaternion and a scale as one column-major matrix.
export function composeTrs(
  tx: number, ty: number, tz: number,
  qx: number, qy: number, qz: number, qw: number,
  sx: number, sy: number, sz: number,
): Matrix4 {
  const x2 = qx + qx, y2 = qy + qy, z2 = qz + qz;
  const xx = qx * x2, xy = qx * y2, xz = qx * z2;
  const yy = qy * y2, yz = qy * z2, zz = qz * z2;
  const wx = qw * x2, wy = qw * y2, wz = qw * z2;
  return [
    (1 - (yy + zz)) * sx, (xy + wz) * sx, (xz - wy) * sx, 0,
    (xy - wz) * sy, (1 - (xx + zz)) * sy, (yz + wx) * sy, 0,
    (xz + wy) * sz, (yz - wx) * sz, (1 - (xx + yy)) * sz, 0,
    tx, ty, tz, 1,
  ];
}

const sixteen = (values: readonly number[]): Matrix4 => [
  values[0] ?? 0, values[1] ?? 0, values[2] ?? 0, values[3] ?? 0,
  values[4] ?? 0, values[5] ?? 0, values[6] ?? 0, values[7] ?? 0,
  values[8] ?? 0, values[9] ?? 0, values[10] ?? 0, values[11] ?? 0,
  values[12] ?? 0, values[13] ?? 0, values[14] ?? 0, values[15] ?? 0,
];

// One drawable primitive of a glTF mesh, once its accessors have been read.
type Primitive = { readonly mesh: Mesh; readonly color: readonly [number, number, number, number] };

/**
 * A glTF or GLB document as a `LoadedModel`.
 *
 * Every node is an object, whether or not it draws anything, so a named group node stays addressable
 * and its children can point at it. Every drawn primitive of every node is one instance row, with
 * the node's world transform baked in and the material's base colour as its colour factor.
 *
 * Raises a `FormatError`; `loadModel` is the entry that returns failures instead of raising them.
 */
export async function readGltfModel(bytes: Uint8Array, options: GltfOptions = {}): Promise<LoadedModel> {
  throwIfCancelled(options);
  reportProgress(options, 'parse', 0, 1);
  const container = isGlb(bytes);
  const document = await readGltfDocument(bytes, options);
  reportProgress(options, 'parse', 1, 1);
  throwIfCancelled(options);

  const diagnostics: Diagnostic[] = [...document.diagnostics];
  const meshes: Mesh[] = [];
  const primitivesOfMesh = new Map<number, readonly Primitive[]>();
  const readMesh = (index: number): readonly Primitive[] => {
    const known = primitivesOfMesh.get(index);
    if (known !== undefined) return known;
    const built = readPrimitives(document, index, diagnostics);
    primitivesOfMesh.set(index, built);
    for (const each of built) meshes.push(each.mesh);
    return built;
  };

  const nodes = listOf(memberOf(document.json, 'nodes'));
  const parents = parentsOf(nodes);
  const ref = options.ref ?? defaultModelRef(undefined);
  const objects: ObjectRecord[] = [];
  const rows: { readonly node: number; readonly primitive: Primitive; readonly transform: Matrix4 }[] = [];
  const worlds = new Map<number, Matrix4>();
  const worldOf = (index: number): Matrix4 => {
    const known = worlds.get(index);
    if (known !== undefined) return known;
    const parent = parents[index] ?? -1;
    const local = nodeTransform(nodes[index]);
    const world = parent < 0 ? local : multiplyMatrix(worldOf(parent), local);
    worlds.set(index, world);
    return world;
  };

  nodes.forEach((node, index) => {
    throwIfCancelled(options);
    const world = worldOf(index);
    const meshIndex = numberOf(memberOf(node, 'mesh'));
    const first = rows.length;
    if (meshIndex !== undefined) for (const primitive of readMesh(meshIndex)) rows.push({ node: index, primitive, transform: world });
    const parent = parents[index] ?? -1;
    objects.push({
      ref: objectRef(ref, `node:${index}`),
      transform: identityMatrix,
      ...(stringOf(memberOf(node, 'name')) === undefined ? {} : { name: stringOf(memberOf(node, 'name')) ?? '' }),
      ...(parent < 0 ? {} : { parentId: `node:${parent}` }),
      ...(rows.length > first ? { representation: first } : {}),
    });
  });

  reportProgress(options, 'convert', 0, 1);
  const geometry: Geometry = { meshes, instances: instanceColumns(rows, meshes) };
  reportProgress(options, 'convert', 1, 1);
  if (geometry.instances.count === 0)
    diagnostics.push(formatWarning(formatCode.noGeometry, 'The document draws no triangles'));

  const data: ModelData = { ref, coordinates: options.coordinates ?? gltfCoordinates, objects };
  return loadedModel(container ? 'glb' : 'gltf', data, geometry, bytes.byteLength, [
      ...diagnostics,
      formatNote(formatCode.assumedCoordinates, 'glTF states metres and Y up; the model is reported in that frame'),
    ]);
}

// The instance columns of the rows collected while walking the nodes.
function instanceColumns(
  rows: readonly { readonly node: number; readonly primitive: Primitive; readonly transform: Matrix4 }[],
  meshes: readonly Mesh[],
): Geometry['instances'] {
  const count = rows.length;
  const meshIndex = new Int32Array(count);
  const objectIndex = new Int32Array(count);
  const transform = new Float32Array(count * transformStride);
  const color = new Float32Array(count * colorStride);
  rows.forEach((row, index) => {
    meshIndex[index] = meshes.indexOf(row.primitive.mesh);
    objectIndex[index] = row.node;
    transform.set(row.transform, index * transformStride);
    color.set(row.primitive.color, index * colorStride);
  });
  return { count, meshIndex, transform, color, objectIndex };
}

// The parent of every node, or -1, from the children lists.
function parentsOf(nodes: readonly unknown[]): Int32Array {
  const parents = new Int32Array(nodes.length).fill(-1);
  nodes.forEach((node, index) => {
    for (const child of listOf(memberOf(node, 'children'))) {
      const at = numberOf(child) ?? -1;
      requireThat(at >= 0 && at < nodes.length, formatCode.invalidGltf, () => `Node ${index} names child ${at}, which is not in the document`);
      requireThat((parents[at] ?? -1) === -1, formatCode.invalidGltf, () => `Node ${at} has more than one parent`);
      parents[at] = index;
    }
  });
  return parents;
}

// The drawable primitives of one glTF mesh, skipping the modes this adapter does not draw.
function readPrimitives(document: GltfDocument, index: number, diagnostics: Diagnostic[]): readonly Primitive[] {
  const mesh = itemOf(document.json, 'meshes', index);
  if (mesh === undefined) fail(formatCode.invalidGltf, `Mesh ${index} is not in the document`);
  const out: Primitive[] = [];
  for (const [at, primitive] of listOf(memberOf(mesh, 'primitives')).entries()) {
    const mode = numberOf(memberOf(primitive, 'mode')) ?? triangleMode;
    if (mode !== triangleMode) {
      diagnostics.push(formatWarning(formatCode.droppedPrimitives, `Mesh ${index} primitive ${at} uses mode ${mode}; only triangles are drawn`, [index, at]));
      continue;
    }
    const position = numberOf(memberOf(memberOf(primitive, 'attributes'), 'POSITION'));
    if (position === undefined) continue;
    const positions = readAccessor(document, position);
    const normalIndex = numberOf(memberOf(memberOf(primitive, 'attributes'), 'NORMAL'));
    const normals = normalIndex === undefined ? undefined : readAccessor(document, normalIndex);
    const indexAccessor = numberOf(memberOf(primitive, 'indices'));
    const vertices = Math.floor(positions.length / 3);
    const indices = indexAccessor === undefined ? sequence(vertices) : toIndices(readAccessor(document, indexAccessor), vertices, index, at);
    out.push({
      mesh: {
        positions,
        indices,
        ...(normals === undefined || normals.length !== positions.length ? {} : { normals }),
        bounds: boundsOfPositions(positions),
      },
      color: baseColor(document, numberOf(memberOf(primitive, 'material'))),
    });
  }
  return out;
}

const sequence = (count: number): Uint32Array => {
  const out = new Uint32Array(count - (count % 3));
  for (let at = 0; at < out.length; at += 1) out[at] = at;
  return out;
};

function toIndices(values: Float32Array, vertices: number, mesh: number, primitive: number): Uint32Array {
  const out = new Uint32Array(values.length - (values.length % 3));
  for (let at = 0; at < out.length; at += 1) {
    const value = values[at] ?? -1;
    requireThat(value >= 0 && value < vertices, formatCode.invalidGltf,
      () => `Mesh ${mesh} primitive ${primitive} names vertex ${value} of ${vertices}`, [mesh, primitive, at]);
    out[at] = value;
  }
  return out;
}

// The base colour factor of a material, opaque white when it has none.
function baseColor(document: GltfDocument, index: number | undefined): readonly [number, number, number, number] {
  if (index === undefined) return [1, 1, 1, 1];
  const pbr = memberOf(itemOf(document.json, 'materials', index), 'pbrMetallicRoughness');
  const factor = numbersOf(memberOf(pbr, 'baseColorFactor'));
  if (factor.length < 4 || !factor.every(Number.isFinite)) return [1, 1, 1, 1];
  const clamp = (value: number): number => Math.min(1, Math.max(0, value));
  return [clamp(factor[0] ?? 1), clamp(factor[1] ?? 1), clamp(factor[2] ?? 1), clamp(factor[3] ?? 1)];
}
