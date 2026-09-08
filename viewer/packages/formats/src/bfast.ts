import { parseBfastModel, readBimTable, type BimData, type RenderModel } from '@ara3d/viewer-loaders';
import {
  colorStride,
  emptyBounds,
  identityMatrix,
  noMesh,
  objectRef,
  transformStride,
  type Bounds,
  type CoordinateContext,
  type Diagnostic,
  type Geometry,
  type Mesh,
  type ModelData,
  type ModelRef,
  type ObjectRecord,
} from '@bim-open-toolkit/model';
import { fail, formatCode, formatNote, formatWarning, requireThat } from './diagnostics.js';
import { loadedModel, type LoadedModel } from './loaded-model.js';
import { cancellationCheckInterval, reportProgress, throwIfCancelled, type LoadContext } from './progress.js';

// 32-bit words in one BFAST instance record, and the word each field sits at.
const instanceWords = 16;
const meshWord = 12;
const entityWord = 13;
const colorWord = 14;
const flagsWord = 15;

// Integers per mesh slice: base vertex, vertex count, first index, index count.
const meshSliceInts = 4;

// Byte 1 of the flags word holds the instance flags; bit 0 of those means the instance is not drawn.
const hiddenFlag = 0x1;

// How much of the embedded BOS tables to decode. Names and categories cost one Parquet read each.
export type MetadataLevel = 'none' | 'identity' | 'full';

// What a BFAST load needs beyond the bytes: who the model is, what frame it is in, and how much to read.
export type BfastOptions = LoadContext & {
  readonly ref?: ModelRef;
  readonly coordinates?: CoordinateContext;
  readonly metadata?: MetadataLevel;
};

/**
 * The frame a prepared BFAST reports in.
 *
 * The container records no units and no up axis, and the models this path is built for come out of
 * Revit and IFC, which are Z up. Nothing is rotated at load: a caller that knows better passes its
 * own `coordinates`, and a renderer converts with `contextTransform`.
 */
export const bfastCoordinates: CoordinateContext = {
  units: 'unknown',
  up: 'z',
  registration: { kind: 'unknown' },
};

// The mesh count and instance count of a parsed model, from the table lengths.
export const bfastMeshCount = (model: RenderModel): number => Math.floor(model.meshSlices.length / meshSliceInts);
export const bfastInstanceCount = (model: RenderModel): number => Math.floor(model.instanceInts.length / instanceWords);

/**
 * One `Mesh` per mesh slice, whose position and index arrays are views on the file.
 *
 * The stored per-mesh bounds are used when they are finite, because recomputing them is a second
 * pass over every vertex of the model for an answer the file already gives.
 */
export function bfastMeshes(model: RenderModel): readonly Mesh[] {
  const count = bfastMeshCount(model);
  const meshes: Mesh[] = [];
  for (let index = 0; index < count; index += 1) {
    const at = index * meshSliceInts;
    const baseVertex = model.meshSlices[at] ?? 0;
    const vertexCount = model.meshSlices[at + 1] ?? 0;
    const firstIndex = model.meshSlices[at + 2] ?? 0;
    const indexCount = model.meshSlices[at + 3] ?? 0;
    meshes.push({
      positions: model.vertices.subarray(baseVertex * 3, (baseVertex + vertexCount) * 3),
      indices: model.indices.subarray(firstIndex, firstIndex + indexCount),
      bounds: storedBounds(model.meshBounds, index, vertexCount),
    });
  }
  return meshes;
}

// The stored box of one mesh, or the empty box when the mesh has no vertices or the box is unusable.
function storedBounds(all: Float32Array, index: number, vertexCount: number): Bounds {
  if (vertexCount === 0) return emptyBounds;
  const at = index * 6;
  const values = [0, 1, 2, 3, 4, 5].map((offset) => all[at + offset] ?? Number.NaN);
  if (!values.every(Number.isFinite)) return emptyBounds;
  return {
    min: [values[0] ?? 0, values[1] ?? 0, values[2] ?? 0],
    max: [values[3] ?? 0, values[4] ?? 0, values[5] ?? 0],
  };
}

// The objects of the model as rows, and the row each source entity index maps to.
export type EntityRows = {
  readonly rowOfEntity: Int32Array;
  readonly entityOfRow: Int32Array;
  /** Rows the entity table itself declares. Rows past this were named only by an instance record. */
  readonly declared: number;
};

/**
 * The object rows of a model: every row of the entity table first, in table order, then any further
 * entity an instance record names, in instance order. An instance naming an entity beyond a present
 * entity table is an error, because that object has no identity to give it.
 */
export function bfastEntityRows(model: RenderModel, declared: number): EntityRows {
  const instances = bfastInstanceCount(model);
  let largest = declared - 1;
  for (let row = 0; row < instances; row += 1) {
    const entity = model.instanceInts[row * instanceWords + entityWord] ?? -1;
    requireThat(entity >= 0, formatCode.invalidBfast, () => `Instance ${row} names entity ${entity}`);
    requireThat(
      declared === 0 || entity < declared,
      formatCode.invalidBfast,
      () => `Instance ${row} names entity ${entity}, beyond the ${declared} rows of the entity table`,
    );
    if (entity > largest) largest = entity;
  }
  const rowOfEntity = new Int32Array(Math.max(largest + 1, 0)).fill(-1);
  const entityOfRow = new Int32Array(Math.max(largest + 1, 0));
  let count = 0;
  const add = (entity: number): void => {
    if ((rowOfEntity[entity] ?? -1) !== -1) return;
    rowOfEntity[entity] = count;
    entityOfRow[count] = entity;
    count += 1;
  };
  for (let entity = 0; entity < declared; entity += 1) add(entity);
  for (let row = 0; row < instances; row += 1) add(model.instanceInts[row * instanceWords + entityWord] ?? 0);
  return { rowOfEntity, entityOfRow: entityOfRow.subarray(0, count), declared };
}

// The instance rows of a model, plus how many hidden placements were left out.
export type BfastInstances = {
  readonly geometry: Geometry;
  readonly hidden: number;
  /** First drawn instance row of each object row, or -1 when the object draws nothing. */
  readonly firstDrawn: Int32Array;
};

/**
 * The instance columns: one row per placement the file draws or leaves geometry-free.
 *
 * A placement the file marks hidden is not a row, because `InstanceRecords` has no visibility column
 * and a row without one would be drawn. The count is reported so the loss is visible.
 */
export function bfastInstances(
  model: RenderModel,
  meshes: readonly Mesh[],
  rows: EntityRows,
  context: LoadContext,
): BfastInstances {
  const total = bfastInstanceCount(model);
  const kept: number[] = [];
  for (let row = 0; row < total; row += 1) {
    const flags = ((model.instanceInts[row * instanceWords + flagsWord] ?? 0) >>> 8) & 0xff;
    if ((flags & hiddenFlag) === 0) kept.push(row);
  }

  const count = kept.length;
  const meshIndex = new Int32Array(count);
  const objectIndex = new Int32Array(count);
  const transform = new Float32Array(count * transformStride);
  const color = new Float32Array(count * colorStride);
  const firstDrawn = new Int32Array(rows.entityOfRow.length).fill(-1);
  const floats = model.instanceFloats;
  const words = model.instanceInts;

  for (let out = 0; out < count; out += 1) {
    if (out % cancellationCheckInterval === 0) throwIfCancelled(context);
    const source = kept[out] ?? 0;
    const at = source * instanceWords;
    const mesh = words[at + meshWord] ?? noMesh;
    requireThat(
      mesh === noMesh || (mesh >= 0 && mesh < meshes.length),
      formatCode.invalidBfast,
      () => `Instance ${source} names mesh ${mesh} of ${meshes.length}`,
    );
    const object = rows.rowOfEntity[words[at + entityWord] ?? 0] ?? -1;
    requireThat(object >= 0, formatCode.invalidBfast, () => `Instance ${source} names an entity that is not an object`);
    meshIndex[out] = mesh;
    objectIndex[out] = object;
    if (mesh !== noMesh && (firstDrawn[object] ?? -1) === -1) firstDrawn[object] = out;
    writeColumnMajor(floats, at, transform, out * transformStride);
    const packed = words[at + colorWord] ?? 0;
    for (let channel = 0; channel < colorStride; channel += 1)
      color[out * colorStride + channel] = ((packed >>> (channel * 8)) & 0xff) / 255;
  }
  return { geometry: { meshes, instances: { count, meshIndex, transform, color, objectIndex } }, hidden: total - count, firstDrawn };
}

/**
 * Copies one instance transform into the column.
 *
 * The file stores the three rows of a 3x4 matrix with translation in the fourth column of each row;
 * `InstanceRecords.transform` is column-major 4x4, so this is a transpose plus the last row.
 */
function writeColumnMajor(floats: Float32Array, at: number, out: Float32Array, target: number): void {
  for (let column = 0; column < 4; column += 1)
    for (let row = 0; row < 3; row += 1) {
      const value = floats[at + row * 4 + column] ?? 0;
      requireThat(Number.isFinite(value), formatCode.invalidBfast, () => `Instance transform holds ${value}`);
      out[target + column * 4 + row] = value;
    }
  out[target + 3] = 0;
  out[target + 7] = 0;
  out[target + 11] = 0;
  out[target + 15] = 1;
}

// What the embedded BOS tables say about each entity row. Absent tables leave every field empty.
export type EntityFacts = {
  readonly declared: number;
  readonly localId: Int32Array | null;
  readonly name: readonly (string | undefined)[] | null;
  readonly category: readonly (string | undefined)[] | null;
  readonly diagnostics: readonly Diagnostic[];
};

// Nothing decoded: the model's objects are whatever its instance records name.
export const noEntityFacts: EntityFacts = { declared: 0, localId: null, name: null, category: null, diagnostics: [] };

/**
 * Reads the entity table embedded in a combined BFAST.
 *
 * `identity` decodes the source document id only, which is what identity across revisions needs.
 * `full` also decodes the name and the category, which BOS stores as indices: `Name` indexes the
 * string table, and `Category` names another entity row whose own name is the category label.
 */
export async function readEntityFacts(
  data: BimData,
  level: MetadataLevel,
  context: LoadContext,
): Promise<EntityFacts> {
  if (level === 'none') return noEntityFacts;
  if (data.size === 0)
    return {
      ...noEntityFacts,
      diagnostics: [
        formatWarning(
          formatCode.missingEntityTable,
          'This BFAST carries no BOS tables, so its objects come from its instance records only',
        ),
      ],
    };

  reportProgress(context, 'metadata', 0, 1);
  const columns = level === 'full' ? ['LocalId', 'Name', 'Category'] : ['LocalId'];
  const entities = await readBimTable(data, 'Entities.parquet', columns).catch((error: unknown): never =>
    fail(formatCode.invalidBfast, `The embedded Entities table could not be read: ${messageOf(error)}`, [
      'Entities.parquet',
    ]),
  );
  throwIfCancelled(context);
  const strings = level === 'full' ? await readStrings(data) : null;
  throwIfCancelled(context);
  const facts = entityFactsFrom(entities, strings);
  reportProgress(context, 'metadata', 1, 1);
  return level === 'full' && strings === null
    ? {
        ...facts,
        diagnostics: [
          formatWarning(
            formatCode.missingEntityTable,
            'This BFAST has no string table, so object names and categories are not available',
          ),
        ],
      }
    : facts;
}

/**
 * The decoded entity rows read as facts, without any file access.
 *
 * BOS stores both labels as indices: `Name` indexes the string table, and `Category` names another
 * entity row whose own name is the category label. An index that is absent, negative, out of range
 * or names an empty string reads as no value rather than as a made-up one.
 */
export function entityFactsFrom(
  entities: readonly Readonly<Record<string, unknown>>[],
  strings: readonly (string | undefined)[] | null,
): EntityFacts {
  const declared = entities.length;
  const localId = new Int32Array(declared);
  for (let row = 0; row < declared; row += 1) localId[row] = integerOf(entities[row]?.['LocalId']) ?? 0;
  if (strings === null) return { declared, localId, name: null, category: null, diagnostics: [] };
  const name: (string | undefined)[] = [];
  const category: (string | undefined)[] = [];
  for (let row = 0; row < declared; row += 1) {
    const entity = entities[row];
    name.push(labelOf(strings, integerOf(entity?.['Name'])));
    const owner = integerOf(entity?.['Category']);
    category.push(
      owner === undefined || owner < 0 || owner >= declared
        ? undefined
        : labelOf(strings, integerOf(entities[owner]?.['Name'])),
    );
  }
  return { declared, localId, name, category, diagnostics: [] };
}

// The BOS string table, or null when the file has none.
async function readStrings(data: BimData): Promise<readonly (string | undefined)[] | null> {
  const rows = await readBimTable(data, 'Strings.parquet', ['Strings']).catch(() => null);
  return rows === null ? null : rows.map((row) => textOf(row['Strings']));
}

// A string-table entry, empty entries read as absent so nothing fabricates a name.
const labelOf = (strings: readonly (string | undefined)[], index: number | undefined): string | undefined => {
  if (index === undefined || index < 0) return undefined;
  const found = strings[index];
  return found === undefined || found.trim() === '' ? undefined : found;
};

// A Parquet cell read as an integer. BOS stores ids as 64-bit values, which arrive as bigints.
const integerOf = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === 'bigint') return Number(value);
  return undefined;
};

// A Parquet cell read as text.
const textOf = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);

const messageOf = (error: unknown): string => (error instanceof Error ? error.message : String(error));

// The object records of a model, one per row, named and categorized from the entity table when it has one.
export function bfastObjects(ref: ModelRef, rows: EntityRows, facts: EntityFacts, firstDrawn: Int32Array): readonly ObjectRecord[] {
  const objects: ObjectRecord[] = [];
  for (let row = 0; row < rows.entityOfRow.length; row += 1) {
    const entity = rows.entityOfRow[row] ?? 0;
    const sourceId = facts.localId === null ? 0 : facts.localId[entity] ?? 0;
    const drawn = firstDrawn[row] ?? -1;
    objects.push({
      ref: objectRef(ref, `bos:${entity}`),
      transform: identityMatrix,
      ...(facts.name === null ? {} : withValue('name', facts.name[entity])),
      ...(facts.category === null ? {} : withValue('category', facts.category[entity])),
      ...(sourceId > 0 ? { sourceId: String(sourceId) } : {}),
      ...(drawn >= 0 ? { representation: drawn } : {}),
    });
  }
  return objects;
}

// A single-property object, or nothing at all when the value is absent, so no key is set to undefined.
const withValue = (key: 'name' | 'category', value: string | undefined): Record<string, string> =>
  value === undefined ? {} : { [key]: value };

// The default identity of a model loaded from bytes with no name of its own.
export const defaultModelRef = (source: string | undefined): ModelRef => ({
  id: source ?? 'model',
  revision: '1',
  ...(source === undefined ? {} : { source }),
});

/**
 * A prepared BFAST as a `LoadedModel`: mesh views on the file, one columnar instance row per drawn or
 * geometry-free placement, and one object per entity the file declares or an instance names.
 *
 * Raises a `FormatError`; `loadModel` is the entry that returns failures instead of raising them.
 */
export async function readBfastModel(buffer: ArrayBuffer, options: BfastOptions = {}): Promise<LoadedModel> {
  throwIfCancelled(options);
  reportProgress(options, 'parse', 0, 1);
  const parsed = parseModel(buffer);
  reportProgress(options, 'parse', 1, 1);

  const facts = await readEntityFacts(parsed.bimData, options.metadata ?? 'full', options);
  throwIfCancelled(options);

  const rows = bfastEntityRows(parsed, facts.declared);
  const meshes = bfastMeshes(parsed);
  reportProgress(options, 'convert', 0, 2);
  const built = bfastInstances(parsed, meshes, rows, options);
  reportProgress(options, 'convert', 1, 2);

  const ref = options.ref ?? defaultModelRef(undefined);
  const data: ModelData = {
    ref,
    coordinates: options.coordinates ?? bfastCoordinates,
    objects: bfastObjects(ref, rows, facts, built.firstDrawn),
  };
  reportProgress(options, 'convert', 2, 2);
  return loadedModel('bfast', data, built.geometry, buffer.byteLength, [
    ...facts.diagnostics,
    ...(built.hidden > 0
      ? [formatWarning(formatCode.droppedHiddenInstances, `${built.hidden} placements are marked hidden in the file and are not instance rows`)]
      : []),
    ...(built.geometry.instances.count === 0
      ? [formatWarning(formatCode.noGeometry, 'The file declares no drawn placements')]
      : []),
    ...(options.coordinates === undefined
      ? [
          formatNote(
            formatCode.assumedCoordinates,
            'BFAST records no units or up axis; the model is reported as Z up with unknown units',
          ),
        ]
      : []),
  ]);
}

// Parses the container and the render tables, turning the loader's errors into format diagnostics.
function parseModel(buffer: ArrayBuffer): ReturnType<typeof parseBfastModel> {
  try {
    return parseBfastModel(buffer);
  } catch (error) {
    return fail(formatCode.invalidBfast, messageOf(error));
  }
}
