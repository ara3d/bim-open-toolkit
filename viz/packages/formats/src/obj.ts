import {
  boundsOfPositions,
  colorStride,
  identityMatrix,
  objectRef,
  transformStride,
  type CoordinateContext,
  type Diagnostic,
  type Geometry,
  type Mesh,
  type ModelData,
  type ModelRef,
  type ObjectRecord,
} from '@bim-open-toolkit/model';
import { defaultModelRef } from './bfast.js';
import { formatCode, formatNote, formatWarning, requireThat } from './diagnostics.js';
import { loadedModel, type LoadedModel } from './loaded-model.js';
import { reportProgress, throwIfCancelled, type LoadContext } from './progress.js';

/**
 * OBJ records no units and no up axis. Most exporters write Y up, so that is what is reported, and a
 * caller that knows the file states its own frame instead. Nothing is rotated at load.
 */
export const objCoordinates: CoordinateContext = {
  units: 'unknown',
  up: 'y',
  registration: { kind: 'unknown' },
};

export type ObjOptions = LoadContext & {
  readonly ref?: ModelRef;
  readonly coordinates?: CoordinateContext;
};

// One group of an OBJ file, which becomes one mesh, one placement and one object.
type Group = {
  name: string | undefined;
  readonly positions: number[];
  readonly normals: number[];
  readonly indices: number[];
  /** Vertex slot of each distinct position/normal pair, keyed by the pair as written. */
  readonly vertices: Map<string, number>;
};

const newGroup = (name: string | undefined): Group => ({
  name,
  positions: [],
  normals: [],
  indices: [],
  vertices: new Map(),
});

/**
 * An OBJ file as a `LoadedModel`: one object and one mesh per `o` or `g` group, or one for the whole
 * file when it declares none.
 *
 * OBJ indexes positions and normals separately, so each distinct pair becomes one vertex. Faces with
 * more than three corners are triangulated as a fan, which is right for the convex faces exporters
 * write and wrong for a concave one; there is nothing in the format that says which it is.
 *
 * Raises a `FormatError`; `loadModel` is the entry that returns failures instead of raising them.
 */
export function readObjModel(bytes: Uint8Array, options: ObjOptions = {}): LoadedModel {
  throwIfCancelled(options);
  reportProgress(options, 'parse', 0, 1);
  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  const parsed = parseObj(text, options);
  reportProgress(options, 'parse', 1, 1);

  const ref = options.ref ?? defaultModelRef(undefined);
  const meshes: Mesh[] = [];
  const objects: ObjectRecord[] = [];
  for (const [index, group] of parsed.groups.entries()) {
    if (group.indices.length === 0) continue;
    const positions = Float32Array.from(group.positions);
    meshes.push({
      positions,
      indices: Uint32Array.from(group.indices),
      ...(group.normals.length === group.positions.length ? { normals: Float32Array.from(group.normals) } : {}),
      bounds: boundsOfPositions(positions),
    });
    objects.push({
      ref: objectRef(ref, `group:${index}`),
      transform: identityMatrix,
      ...(group.name === undefined ? {} : { name: group.name }),
      representation: meshes.length - 1,
    });
  }

  reportProgress(options, 'convert', 0, 1);
  const geometry: Geometry = { meshes, instances: onePlacementEach(meshes.length) };
  reportProgress(options, 'convert', 1, 1);

  const data: ModelData = { ref, coordinates: options.coordinates ?? objCoordinates, objects };
  return loadedModel('obj', data, geometry, bytes.byteLength, [
    ...parsed.diagnostics,
    ...(meshes.length === 0 ? [formatWarning(formatCode.noGeometry, 'The file declares no triangles')] : []),
    ...(options.coordinates === undefined
      ? [formatNote(formatCode.assumedCoordinates, 'OBJ records no units or up axis; the model is reported as Y up with unknown units')]
      : []),
  ]);
}

// One instance row per mesh, at the origin, opaque white: an OBJ places nothing more than once.
function onePlacementEach(count: number): Geometry['instances'] {
  const meshIndex = new Int32Array(count);
  const objectIndex = new Int32Array(count);
  const transform = new Float32Array(count * transformStride);
  const color = new Float32Array(count * colorStride).fill(1);
  for (let row = 0; row < count; row += 1) {
    meshIndex[row] = row;
    objectIndex[row] = row;
    transform.set(identityMatrix, row * transformStride);
  }
  return { count, meshIndex, transform, color, objectIndex };
}

type ParsedObj = { readonly groups: readonly Group[]; readonly diagnostics: readonly Diagnostic[] };

/** Reads the statements of an OBJ file. Unknown statements are ignored, as the format expects. */
export function parseObj(text: string, context: LoadContext = {}): ParsedObj {
  const positions: number[] = [];
  const normals: number[] = [];
  const groups: Group[] = [newGroup(undefined)];
  const diagnostics: Diagnostic[] = [];
  let materials = false;
  let current = groups[0] ?? newGroup(undefined);
  let lineNumber = 0;

  for (const raw of text.split('\n')) {
    lineNumber += 1;
    if (lineNumber % 4096 === 0) throwIfCancelled(context);
    const line = raw.trim();
    if (line.length === 0 || line.startsWith('#')) continue;
    const parts = line.split(/\s+/);
    const keyword = parts[0] ?? '';
    if (keyword === 'v') {
      positions.push(...triple(parts, lineNumber, 'vertex'));
    } else if (keyword === 'vn') {
      normals.push(...triple(parts, lineNumber, 'normal'));
    } else if (keyword === 'o' || keyword === 'g') {
      const name = parts.slice(1).join(' ');
      if (current.indices.length === 0 && current.name === undefined) current.name = name === '' ? undefined : name;
      else {
        current = newGroup(name === '' ? undefined : name);
        groups.push(current);
      }
    } else if (keyword === 'f') {
      addFace(current, parts, positions, normals, lineNumber);
    } else if (keyword === 'mtllib' || keyword === 'usemtl') {
      materials = true;
    }
  }
  if (materials)
    diagnostics.push(formatWarning(formatCode.droppedMaterialLibrary, 'OBJ material libraries are not read; every placement is opaque white'));
  return { groups, diagnostics };
}

// The three numbers of a `v` or `vn` statement.
function triple(parts: readonly string[], line: number, what: string): readonly [number, number, number] {
  const values = [1, 2, 3].map((at) => Number(parts[at]));
  requireThat(values.every(Number.isFinite), formatCode.invalidObj, () => `Line ${line} is not a three component ${what}`, [line]);
  return [values[0] ?? 0, values[1] ?? 0, values[2] ?? 0];
}

/**
 * Adds one face, triangulated as a fan.
 *
 * A corner is written `v`, `v/vt`, `v//vn` or `v/vt/vn`, with indices counted from one, or from the
 * end when negative. A position and a normal index together name one vertex of the built mesh.
 */
function addFace(
  group: Group,
  parts: readonly string[],
  positions: readonly number[],
  normals: readonly number[],
  line: number,
): void {
  const corners: number[] = [];
  for (let at = 1; at < parts.length; at += 1) {
    const corner = parts[at] ?? '';
    if (corner === '') continue;
    const fields = corner.split('/');
    const position = indexOf(fields[0], positions.length / 3, line);
    const normal = fields[2] === undefined || fields[2] === '' ? -1 : indexOf(fields[2], normals.length / 3, line);
    const key = `${position}/${normal}`;
    let slot = group.vertices.get(key);
    if (slot === undefined) {
      slot = group.positions.length / 3;
      group.vertices.set(key, slot);
      group.positions.push(positions[position * 3] ?? 0, positions[position * 3 + 1] ?? 0, positions[position * 3 + 2] ?? 0);
      if (normal >= 0)
        group.normals.push(normals[normal * 3] ?? 0, normals[normal * 3 + 1] ?? 0, normals[normal * 3 + 2] ?? 0);
      else if (group.normals.length > 0) group.normals.push(0, 0, 0);
    }
    corners.push(slot);
  }
  requireThat(corners.length >= 3, formatCode.invalidObj, () => `Line ${line} is a face with ${corners.length} corners`, [line]);
  for (let corner = 1; corner + 1 < corners.length; corner += 1)
    group.indices.push(corners[0] ?? 0, corners[corner] ?? 0, corners[corner + 1] ?? 0);
}

// One index of a face corner, counted from one, or from the end when negative.
function indexOf(field: string | undefined, count: number, line: number): number {
  const value = Number(field);
  requireThat(Number.isInteger(value) && value !== 0, formatCode.invalidObj, () => `Line ${line} has "${field ?? ''}" where an index belongs`, [line]);
  const at = value > 0 ? value - 1 : count + value;
  requireThat(at >= 0 && at < count, formatCode.invalidObj, () => `Line ${line} names element ${value} of ${count}`, [line]);
  return at;
}
