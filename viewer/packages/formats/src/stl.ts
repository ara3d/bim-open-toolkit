import {
  boundsOfPositions,
  colorStride,
  identityMatrix,
  objectRef,
  transformStride,
  type CoordinateContext,
  type Diagnostic,
  type Geometry,
  type ModelData,
  type ModelRef,
} from '@bim-open-toolkit/model';
import { defaultModelRef } from './bfast.js';
import { fail, formatCode, formatNote, formatWarning, requireThat } from './diagnostics.js';
import { loadedModel, type LoadedModel } from './loaded-model.js';
import { reportProgress, throwIfCancelled, type LoadContext } from './progress.js';

/**
 * STL records no units and no up axis. The CAD tools that write it work Z up, so that is what is
 * reported, and a caller that knows the file states its own frame instead. Nothing is rotated.
 */
export const stlCoordinates: CoordinateContext = {
  units: 'unknown',
  up: 'z',
  registration: { kind: 'unknown' },
};

export type StlOptions = LoadContext & {
  readonly ref?: ModelRef;
  readonly coordinates?: CoordinateContext;
};

// Bytes before the first triangle of a binary STL, and the size of one triangle record.
const headerBytes = 84;
const triangleBytes = 50;

// The mesh of an STL: three vertices per triangle, each with the triangle's own normal.
export type StlMesh = {
  readonly positions: Float32Array;
  readonly normals: Float32Array;
  readonly triangles: number;
  readonly name: string | undefined;
  readonly binary: boolean;
};

// True when the file's length is exactly what its declared triangle count needs.
export const isBinaryStl = (bytes: Uint8Array): boolean =>
  bytes.byteLength >= headerBytes &&
  headerBytes + new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(80, true) * triangleBytes ===
    bytes.byteLength;

/**
 * Reads a binary STL: an 80 byte header, a triangle count, then a normal, three vertices and an
 * attribute word per triangle. The attribute word carries colour in some writers' files; which
 * convention a file uses is not recorded, so it is not read.
 */
export function readBinaryStl(bytes: Uint8Array): StlMesh {
  requireThat(bytes.byteLength >= headerBytes, formatCode.invalidStl, () => 'The file is too short to be a binary STL');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const triangles = view.getUint32(80, true);
  const needed = headerBytes + triangles * triangleBytes;
  requireThat(needed === bytes.byteLength, formatCode.invalidStl,
    () => `The file declares ${triangles} triangles, needing ${needed} bytes, but holds ${bytes.byteLength}`);
  const positions = new Float32Array(triangles * 9);
  const normals = new Float32Array(triangles * 9);
  for (let triangle = 0; triangle < triangles; triangle += 1) {
    const at = headerBytes + triangle * triangleBytes;
    const normal = [view.getFloat32(at, true), view.getFloat32(at + 4, true), view.getFloat32(at + 8, true)];
    for (let corner = 0; corner < 3; corner += 1) {
      const from = at + 12 + corner * 12;
      const to = triangle * 9 + corner * 3;
      for (let axis = 0; axis < 3; axis += 1) {
        const value = view.getFloat32(from + axis * 4, true);
        requireThat(Number.isFinite(value), formatCode.invalidStl, () => `Triangle ${triangle} has a non-finite vertex`, [triangle]);
        positions[to + axis] = value;
        normals[to + axis] = normal[axis] ?? 0;
      }
    }
  }
  return { positions, normals, triangles, name: headerName(bytes), binary: true };
}

// The 80 byte header as text when it holds any, which is where writers put a name.
function headerName(bytes: Uint8Array): string | undefined {
  let text = '';
  for (const byte of bytes.subarray(0, 80)) if (byte >= 0x20 && byte < 0x7f) text += String.fromCharCode(byte);
  const trimmed = text.trim();
  return trimmed === '' ? undefined : trimmed;
}

/** Reads an ASCII STL: `solid`, then `facet normal` blocks each holding three `vertex` lines. */
export function readAsciiStl(text: string, context: LoadContext = {}): StlMesh {
  const positions: number[] = [];
  const normals: number[] = [];
  let normal: readonly number[] = [0, 0, 0];
  let corners = 0;
  let name: string | undefined;
  let lineNumber = 0;
  for (const raw of text.split('\n')) {
    lineNumber += 1;
    if (lineNumber % 4096 === 0) throwIfCancelled(context);
    const parts = raw.trim().split(/\s+/);
    const keyword = parts[0]?.toLowerCase() ?? '';
    if (keyword === 'solid') {
      const given = parts.slice(1).join(' ');
      name = given === '' ? undefined : given;
    } else if (keyword === 'facet') {
      normal = numbers(parts.slice(parts.length - 3), lineNumber, 'normal');
      corners = 0;
    } else if (keyword === 'vertex') {
      const point = numbers(parts.slice(1, 4), lineNumber, 'vertex');
      positions.push(...point);
      normals.push(...normal);
      corners += 1;
      requireThat(corners <= 3, formatCode.invalidStl, () => `The facet ending at line ${lineNumber} has more than three vertices`, [lineNumber]);
    }
  }
  requireThat(positions.length % 9 === 0, formatCode.invalidStl, () => 'The file ends inside a facet');
  if (positions.length === 0 && !/^\s*solid\b/i.test(text)) fail(formatCode.invalidStl, 'The file is neither a binary nor an ASCII STL');
  return {
    positions: Float32Array.from(positions),
    normals: Float32Array.from(normals),
    triangles: positions.length / 9,
    name,
    binary: false,
  };
}

function numbers(parts: readonly string[], line: number, what: string): readonly [number, number, number] {
  const values = parts.map(Number);
  requireThat(values.length === 3 && values.every(Number.isFinite), formatCode.invalidStl,
    () => `Line ${line} is not a three component ${what}`, [line]);
  return [values[0] ?? 0, values[1] ?? 0, values[2] ?? 0];
}

/**
 * An STL file as a `LoadedModel`: one object, one mesh and one placement.
 *
 * STL has no vertex sharing, no object structure and no colour, so the mesh keeps three vertices per
 * triangle with the facet's own normal on each. Welding them is a mesh operation, not a format one.
 *
 * Raises a `FormatError`; `loadModel` is the entry that returns failures instead of raising them.
 */
export function readStlModel(bytes: Uint8Array, options: StlOptions = {}): LoadedModel {
  throwIfCancelled(options);
  reportProgress(options, 'parse', 0, 1);
  const read = isBinaryStl(bytes)
    ? readBinaryStl(bytes)
    : readAsciiStl(new TextDecoder('utf-8', { fatal: false }).decode(bytes), options);
  reportProgress(options, 'parse', 1, 1);

  const ref = options.ref ?? defaultModelRef(undefined);
  const indices = new Uint32Array(read.triangles * 3);
  for (let at = 0; at < indices.length; at += 1) indices[at] = at;
  const meshes = read.triangles === 0
    ? []
    : [{ positions: read.positions, indices, normals: read.normals, bounds: boundsOfPositions(read.positions) }];

  reportProgress(options, 'convert', 0, 1);
  const geometry: Geometry = { meshes, instances: singlePlacement(meshes.length) };
  const data: ModelData = {
    ref,
    coordinates: options.coordinates ?? stlCoordinates,
    objects: [
      {
        ref: objectRef(ref, 'solid'),
        transform: identityMatrix,
        ...(read.name === undefined ? {} : { name: read.name }),
        ...(meshes.length === 0 ? {} : { representation: 0 }),
      },
    ],
  };
  reportProgress(options, 'convert', 1, 1);

  const diagnostics: Diagnostic[] = [
    formatWarning(formatCode.droppedVertexColors, 'STL carries no colour this adapter can read; the placement is opaque white'),
  ];
  if (read.triangles === 0) diagnostics.push(formatWarning(formatCode.noGeometry, 'The file declares no triangles'));
  if (options.coordinates === undefined)
    diagnostics.push(formatNote(formatCode.assumedCoordinates, 'STL records no units or up axis; the model is reported as Z up with unknown units'));
  return loadedModel('stl', data, geometry, bytes.byteLength, diagnostics);
}

// One row when the file drew anything, so the single object has one placement at the origin.
function singlePlacement(meshes: number): Geometry['instances'] {
  const count = meshes;
  const transform = new Float32Array(count * transformStride);
  const color = new Float32Array(count * colorStride).fill(1);
  for (let row = 0; row < count; row += 1) transform.set(identityMatrix, row * transformStride);
  return { count, meshIndex: new Int32Array(count), transform, color, objectIndex: new Int32Array(count) };
}
