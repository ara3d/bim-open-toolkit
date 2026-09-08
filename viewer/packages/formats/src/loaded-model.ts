import {
  boundsStride,
  colorStride,
  failure,
  hasErrors,
  isInstanceVisible,
  meshCount,
  noMesh,
  objectKey,
  success,
  transformStride,
  type CoordinateContext,
  type Diagnostic,
  type Geometry,
  type MeshTable,
  type ModelData,
  type Result,
} from '@bim-open-toolkit/model';
import { formatCode, formatDiagnostic } from './diagnostics.js';
import type { ModelDocuments, ModelProperties } from './properties.js';

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
  /**
   * Every property of every object, columnar, when the source carried them and the caller asked for
   * them with `LoadOptions.properties`. Absent otherwise: reading a million parameter rows is not
   * something a load does unless it is told to. See `properties.ts` for what it costs.
   */
  readonly properties?: ModelProperties;
  /**
   * Which source file each object came from, when the source records more than a single document.
   * A BFAST or BOS load at the default metadata level carries this; other formats have no such thing.
   */
  readonly documents?: ModelDocuments;
};

/**
 * What a format decoded beyond the geometry and the object records.
 *
 * A record rather than more positional parameters, and every field optional, so that a format with
 * nothing to say passes nothing and `LoadedModel` grows without any existing caller changing.
 */
export type LoadedModelExtras = {
  readonly properties?: ModelProperties;
  readonly documents?: ModelDocuments;
};

// Builds a `LoadedModel`, taking the coordinate frame from the model data so the two cannot disagree.
export const loadedModel = (
  format: ModelFormat,
  data: ModelData,
  geometry: Geometry,
  sourceBytes: number,
  diagnostics: readonly Diagnostic[] = [],
  extras: LoadedModelExtras = {},
): LoadedModel => ({
  format,
  data,
  geometry,
  coordinates: data.coordinates,
  sourceBytes,
  diagnostics,
  ...(extras.properties === undefined ? {} : { properties: extras.properties }),
  ...(extras.documents === undefined ? {} : { documents: extras.documents }),
});

// What a model contains, for reports, demos and the format table.
export type ModelStatistics = {
  readonly objects: number;
  readonly geometryFreeObjects: number;
  readonly meshes: number;
  readonly instances: number;
  /** Rows naming a mesh, hidden ones included. */
  readonly drawnInstances: number;
  /** Rows the source marks hidden: present in the table, not drawn. */
  readonly hiddenInstances: number;
  /** Vertices across the mesh list, counted once per mesh however often it is placed. */
  readonly meshVertices: number;
  /** Triangles across the mesh list, counted once per mesh however often it is placed. */
  readonly meshTriangles: number;
};

/**
 * Counts the model. One pass over the instance column and one over the meshes, nothing materialized.
 *
 * A geometry carries its meshes as records, as a `MeshTable`, or as both saying the same thing, so
 * the counts come from the table when there is one and from the record list otherwise.
 */
export function modelStatistics(model: LoadedModel): ModelStatistics {
  const { meshes, instances, meshTable } = model.geometry;
  const drawn = new Set<number>();
  let drawnInstances = 0;
  let hiddenInstances = 0;
  for (let row = 0; row < instances.count; row += 1) {
    if (!isInstanceVisible(instances, row)) hiddenInstances += 1;
    const index = instances.meshIndex[row] ?? noMesh;
    if (index === noMesh) continue;
    drawnInstances += 1;
    drawn.add(instances.objectIndex[row] ?? -1);
  }
  let meshVertices = 0;
  let meshTriangles = 0;
  if (meshTable === undefined)
    for (const each of meshes) {
      meshVertices += Math.floor(each.positions.length / 3);
      meshTriangles += Math.floor(each.indices.length / 3);
    }
  else
    for (let index = 0; index < meshCount(meshTable); index += 1) {
      meshVertices += meshTable.vertexCount[index] ?? 0;
      meshTriangles += Math.floor((meshTable.indexCount[index] ?? 0) / 3);
    }
  return {
    objects: model.data.objects.length,
    geometryFreeObjects: model.data.objects.length - drawn.size,
    meshes: meshTable === undefined ? meshes.length : meshCount(meshTable),
    instances: instances.count,
    drawnInstances,
    hiddenInstances,
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
 *
 * A geometry may carry its meshes as records, as a `MeshTable`, or as both; each form is checked as
 * it stands, and a geometry carrying both is checked for holding the same number of meshes in each.
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
  checkProperties(model, report);
  checkDocuments(model, report);
  return problems;
}

/**
 * The property columns' own invariants: one offset per object plus the closing one, offsets that
 * only rise, a last offset that is the row count, and a descriptor index per row that names a
 * descriptor. The values are not checked, because a raw `Value` word may legitimately index nothing.
 */
function checkProperties(model: LoadedModel, report: Report): void {
  const properties = model.properties;
  if (properties === undefined) return;
  const objects = model.data.objects.length;
  if (properties.objects !== objects)
    report(`Properties cover ${properties.objects} objects, not ${objects}`, ['properties', 'objects']);
  if (properties.start.length !== properties.objects + 1)
    report(`Property offsets have ${properties.start.length} entries, not ${properties.objects + 1}`, ['properties', 'start']);
  for (const [name, length] of [
    ['descriptor', properties.descriptor.length],
    ['value', properties.value.length],
  ] as const)
    if (length !== properties.rows) report(`Property column ${name} has ${length} rows, not ${properties.rows}`, ['properties', name]);
  if ((properties.start[properties.start.length - 1] ?? -1) !== properties.rows)
    report(`Property offsets end at ${properties.start[properties.start.length - 1] ?? -1}, not ${properties.rows}`, ['properties', 'start']);
  for (let at = 1; at < properties.start.length; at += 1)
    if ((properties.start[at] ?? 0) < (properties.start[at - 1] ?? 0)) {
      report(`Property offsets fall at object ${at - 1}`, ['properties', 'start', at]);
      break;
    }
  for (let row = 0; row < properties.rows; row += 1) {
    const index = properties.descriptor[row] ?? -1;
    if (index < 0 || index >= properties.descriptors.count) {
      report(`Property row ${row} names descriptor ${index} of ${properties.descriptors.count}`, ['properties', 'descriptor', row]);
      break;
    }
  }
}

// Every object names a document the table holds, or no document at all.
function checkDocuments(model: LoadedModel, report: Report): void {
  const documents = model.documents;
  if (documents === undefined) return;
  const objects = model.data.objects.length;
  if (documents.ofObject.length !== objects)
    report(`Document attribution has ${documents.ofObject.length} rows, not ${objects}`, ['documents', 'ofObject']);
  for (let row = 0; row < documents.ofObject.length; row += 1) {
    const index = documents.ofObject[row] ?? -1;
    if (index < -1 || index >= documents.count) {
      report(`Object ${row} names document ${index} of ${documents.count}`, ['documents', 'ofObject', row]);
      break;
    }
  }
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

// How many meshes the geometry has, from the table when it carries one and from the records otherwise.
const geometryMeshCount = (geometry: Geometry): number =>
  geometry.meshTable === undefined ? geometry.meshes.length : meshCount(geometry.meshTable);

/**
 * The mesh table's own invariants: columns of one length, a bounds row per mesh, and every range
 * inside the buffers it names. A mesh's indices count from its own first vertex, so an index is
 * checked against that mesh's vertex count rather than against the whole buffer.
 */
function checkMeshTable(table: MeshTable, report: Report): void {
  const count = meshCount(table);
  const columns: readonly (readonly [string, number])[] = [
    ['vertexCount', table.vertexCount.length],
    ['indexStart', table.indexStart.length],
    ['indexCount', table.indexCount.length],
    ['bounds', Math.floor(table.bounds.length / boundsStride)],
  ];
  for (const [name, length] of columns)
    if (length !== count) report(`Mesh table column ${name} has ${length} rows, not ${count}`, ['meshTable', name]);
  if (table.positions.length % 3 !== 0)
    report(`Mesh table has ${table.positions.length} position floats, not a multiple of three`, ['meshTable', 'positions']);
  if (table.normals !== undefined && table.normals.length !== table.positions.length)
    report(
      `Mesh table has ${table.normals.length} normal floats for ${table.positions.length} position floats`,
      ['meshTable', 'normals'],
    );
  for (let at = 0; at < table.positions.length; at += 1)
    if (!Number.isFinite(table.positions[at])) {
      report(`Mesh table has a non-finite position at ${at}`, ['meshTable', 'positions', at]);
      break;
    }

  const vertices = Math.floor(table.positions.length / 3);
  for (let index = 0; index < count; index += 1) {
    const path = ['meshTable', index] as const;
    const start = table.vertexStart[index] ?? 0;
    const own = table.vertexCount[index] ?? 0;
    const first = table.indexStart[index] ?? 0;
    const indices = table.indexCount[index] ?? 0;
    if (start < 0 || own < 0 || start + own > vertices) {
      report(`Mesh ${index} claims vertices ${start} to ${start + own} of ${vertices}`, [...path, 'vertexStart']);
      continue;
    }
    if (first < 0 || indices < 0 || first + indices > table.indices.length) {
      report(`Mesh ${index} claims indices ${first} to ${first + indices} of ${table.indices.length}`, [...path, 'indexStart']);
      continue;
    }
    if (indices % 3 !== 0) report(`Mesh ${index} has ${indices} indices, not a multiple of three`, [...path, 'indexCount']);
    for (let at = first; at < first + indices; at += 1) {
      const vertex = table.indices[at] ?? 0;
      if (vertex >= own) {
        report(`Mesh ${index} index ${at - first} names vertex ${vertex} of its own ${own}`, [...path, 'indices', at - first]);
        break;
      }
    }
  }
}

function checkMeshes(model: LoadedModel, report: Report): void {
  const table = model.geometry.meshTable;
  if (table !== undefined) {
    checkMeshTable(table, report);
    if (model.geometry.meshes.length > 0 && model.geometry.meshes.length !== meshCount(table))
      report(
        `The geometry lists ${model.geometry.meshes.length} meshes and its table holds ${meshCount(table)}`,
        ['meshTable'],
      );
  }
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
  const { count, meshIndex, transform, color, objectIndex, visible, roughness, metallic } = model.geometry.instances;
  const meshes = geometryMeshCount(model.geometry);
  const objects = model.data.objects.length;
  if (visible !== undefined && visible.length !== count)
    report(`visible has ${visible.length} rows, not ${count}`, ['instances', 'visible']);
  for (const [name, column] of [
    ['roughness', roughness],
    ['metallic', metallic],
  ] as const) {
    if (column === undefined) continue;
    if (column.length !== count) report(`${name} has ${column.length} rows, not ${count}`, ['instances', name]);
    for (let row = 0; row < column.length; row += 1) {
      const value = column[row] ?? 0;
      if (!Number.isFinite(value) || value < 0 || value > 1) {
        report(`Instance ${row} has a ${name} factor outside zero to one`, ['instances', name, row]);
        break;
      }
    }
  }
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
