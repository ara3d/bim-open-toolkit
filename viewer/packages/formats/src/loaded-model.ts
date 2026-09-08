import {
  colorStride,
  failure,
  hasErrors,
  noMesh,
  objectKey,
  success,
  transformStride,
  type CoordinateContext,
  type Diagnostic,
  type Geometry,
  type ModelData,
  type Result,
} from '@bim-open-toolkit/model';
import { formatCode, formatDiagnostic } from './diagnostics.js';

// A file format this package can turn into a `LoadedModel`.
export type ModelFormat = 'bfast' | 'bos' | 'glb' | 'gltf' | 'obj' | 'stl';

// Every supported format, in the order the format table documents them.
export const modelFormats: readonly ModelFormat[] = ['bfast', 'bos', 'glb', 'gltf', 'obj', 'stl'];

/**
 * One source file, normalized. `data` holds the object records, `geometry` holds the meshes and the
 * columnar instance rows that place them, and `coordinates` is the frame both report in — the same
 * object as `data.coordinates`, named here because a caller usually wants it without the records.
 * `diagnostics` is what the loader observed about this model; `loadModel` repeats it on the Result.
 */
export type LoadedModel = {
  readonly format: ModelFormat;
  readonly data: ModelData;
  readonly geometry: Geometry;
  readonly coordinates: CoordinateContext;
  readonly sourceBytes: number;
  readonly diagnostics: readonly Diagnostic[];
};

// Builds a `LoadedModel`, taking the coordinate frame from the model data so the two cannot disagree.
export const loadedModel = (
  format: ModelFormat,
  data: ModelData,
  geometry: Geometry,
  sourceBytes: number,
  diagnostics: readonly Diagnostic[] = [],
): LoadedModel => ({ format, data, geometry, coordinates: data.coordinates, sourceBytes, diagnostics });

// What a model contains, for reports, demos and the format table.
export type ModelStatistics = {
  readonly objects: number;
  readonly geometryFreeObjects: number;
  readonly meshes: number;
  readonly instances: number;
  readonly drawnInstances: number;
  /** Vertices across the mesh list, counted once per mesh however often it is placed. */
  readonly meshVertices: number;
  /** Triangles across the mesh list, counted once per mesh however often it is placed. */
  readonly meshTriangles: number;
};

// Counts the model. One pass over the instance column and the mesh list, nothing materialized.
export function modelStatistics(model: LoadedModel): ModelStatistics {
  const { meshes, instances } = model.geometry;
  const drawn = new Set<number>();
  let drawnInstances = 0;
  for (let row = 0; row < instances.count; row += 1) {
    const index = instances.meshIndex[row] ?? noMesh;
    if (index === noMesh) continue;
    drawnInstances += 1;
    drawn.add(instances.objectIndex[row] ?? -1);
  }
  let meshVertices = 0;
  let meshTriangles = 0;
  for (const each of meshes) {
    meshVertices += Math.floor(each.positions.length / 3);
    meshTriangles += Math.floor(each.indices.length / 3);
  }
  return {
    objects: model.data.objects.length,
    geometryFreeObjects: model.data.objects.length - drawn.size,
    meshes: meshes.length,
    instances: instances.count,
    drawnInstances,
    meshVertices,
    meshTriangles,
  };
}

/**
 * Every invariant a `LoadedModel` is supposed to hold, checked from the outside.
 *
 * A loader checks what its own format does not guarantee, so this is not run on every load: it walks
 * every index and every float, which for a large model costs as much as building the columns. Use it
 * in tests, and on input from somewhere you do not trust.
 */
export function validateLoadedModel(model: LoadedModel): readonly Diagnostic[] {
  const problems: Diagnostic[] = [];
  const report = (message: string, path: readonly (string | number)[]): void => {
    problems.push(formatDiagnostic(formatCode.invalidModel, message, path));
  };
  if (model.coordinates !== model.data.coordinates)
    report('The model reports one coordinate frame and its data reports another', ['coordinates']);
  if (!Number.isInteger(model.sourceBytes) || model.sourceBytes < 0)
    report(`Source size ${model.sourceBytes} is not a byte count`, ['sourceBytes']);

  checkInstances(model, report);
  checkMeshes(model, report);
  checkObjects(model, report);
  return problems;
}

// The model when it holds together, and its problems when it does not.
export const checkedModel = (model: LoadedModel): Result<LoadedModel> => {
  const problems = validateLoadedModel(model);
  return hasErrors(problems) ? failure(problems) : success(model, [...model.diagnostics, ...problems]);
};

type Report = (message: string, path: readonly (string | number)[]) => void;

function checkObjects(model: LoadedModel, report: Report): void {
  const { ref, objects } = model.data;
  const seen = new Set<string>();
  const rows = model.geometry.instances.count;
  objects.forEach((record, index) => {
    if (record.ref.modelId !== ref.id || record.ref.revision !== ref.revision)
      report(`Object ${index} belongs to a different model revision`, ['objects', index, 'ref']);
    const key = objectKey(record.ref);
    if (seen.has(key)) report(`Object key ${key} is used by more than one record`, ['objects', index, 'ref']);
    seen.add(key);
    const row = record.representation;
    if (row === undefined) return;
    if (!Number.isInteger(row) || row < 0 || row >= rows)
      report(`Object ${index} names instance row ${row}, which is outside the table`, ['objects', index, 'representation']);
    else if ((model.geometry.instances.objectIndex[row] ?? -1) !== index)
      report(`Object ${index} names instance row ${row}, which belongs to another object`, ['objects', index, 'representation']);
  });
}

function checkMeshes(model: LoadedModel, report: Report): void {
  model.geometry.meshes.forEach((each, index) => {
    const path = ['meshes', index] as const;
    if (each.positions.length % 3 !== 0)
      report(`Mesh ${index} has ${each.positions.length} position floats, not a multiple of three`, [...path, 'positions']);
    if (each.normals !== undefined && each.normals.length !== each.positions.length)
      report(`Mesh ${index} has ${each.normals.length} normal floats for ${each.positions.length} position floats`, [...path, 'normals']);
    if (each.indices.length % 3 !== 0)
      report(`Mesh ${index} has ${each.indices.length} indices, not a multiple of three`, [...path, 'indices']);
    for (let at = 0; at < each.positions.length; at += 1)
      if (!Number.isFinite(each.positions[at])) {
        report(`Mesh ${index} has a non-finite position at ${at}`, [...path, 'positions', at]);
        break;
      }
    const vertices = Math.floor(each.positions.length / 3);
    for (let at = 0; at < each.indices.length; at += 1) {
      const vertex = each.indices[at] ?? 0;
      if (vertex >= vertices) {
        report(`Mesh ${index} index ${at} names vertex ${vertex} of ${vertices}`, [...path, 'indices', at]);
        break;
      }
    }
  });
}

function checkInstances(model: LoadedModel, report: Report): void {
  const { count, meshIndex, transform, color, objectIndex } = model.geometry.instances;
  const meshes = model.geometry.meshes.length;
  const objects = model.data.objects.length;
  if (meshIndex.length !== count) report(`meshIndex has ${meshIndex.length} rows, not ${count}`, ['instances', 'meshIndex']);
  if (objectIndex.length !== count) report(`objectIndex has ${objectIndex.length} rows, not ${count}`, ['instances', 'objectIndex']);
  if (transform.length !== count * transformStride)
    report(`transform has ${transform.length} floats, not ${count * transformStride}`, ['instances', 'transform']);
  if (color.length !== count * colorStride)
    report(`color has ${color.length} floats, not ${count * colorStride}`, ['instances', 'color']);

  for (let row = 0; row < count; row += 1) {
    const index = meshIndex[row] ?? noMesh;
    if (index !== noMesh && (index < 0 || index >= meshes)) {
      report(`Instance ${row} names mesh ${index} of ${meshes}`, ['instances', 'meshIndex', row]);
      break;
    }
  }
  for (let row = 0; row < count; row += 1) {
    const index = objectIndex[row] ?? -1;
    if (index < 0 || index >= objects) {
      report(`Instance ${row} names object ${index} of ${objects}`, ['instances', 'objectIndex', row]);
      break;
    }
  }
  for (let at = 0; at < transform.length; at += 1)
    if (!Number.isFinite(transform[at])) {
      report(`Instance ${Math.floor(at / transformStride)} has a non-finite transform`, ['instances', 'transform', at]);
      break;
    }
  for (let at = 0; at < color.length; at += 1) {
    const value = color[at] ?? 0;
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      report(`Instance ${Math.floor(at / colorStride)} has a colour factor outside zero to one`, ['instances', 'color', at]);
      break;
    }
  }
}
