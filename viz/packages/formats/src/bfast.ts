import { parseBfastModel, readBimTable, type BimData, type RenderModel } from '@ara3d/viewer-loaders';
import {
  boundsStride,
  colorStride,
  defaultMetallic,
  defaultRoughness,
  emptyBounds,
  identityMatrix,
  meshCount,
  noMesh,
  objectRef,
  transformStride,
  type CoordinateContext,
  type Diagnostic,
  type Geometry,
  type MeshTable,
  type ModelData,
  type ModelRef,
  type ObjectRecord,
} from '@bim-open-toolkit/model';
import { fail, formatCode, formatNote, formatWarning } from './diagnostics.js';
import { loadedModel, type LoadedModel } from './loaded-model.js';
import { cancellationCheckInterval, reportProgress, throwIfCancelled, type LoadContext } from './progress.js';
import {
  modelDocumentsFrom,
  modelPropertiesFrom,
  parquetInteger,
  parquetText,
  type ModelDocuments,
  type ModelProperties,
} from './properties.js';

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

// Bytes 2 and 3 of the flags word hold the placement's surface factors, 0 to 255 over 0 to 1.
const roughnessShift = 16;
const metallicShift = 24;

// How much of the embedded BOS tables to decode. Names and categories cost one Parquet read each.
export type MetadataLevel = 'none' | 'identity' | 'full';

// What a BFAST load needs beyond the bytes: who the model is, what frame it is in, and how much to read.
export type BfastOptions = LoadContext & {
  readonly ref?: ModelRef;
  readonly coordinates?: CoordinateContext;
  readonly metadata?: MetadataLevel;
  /**
   * Decodes the embedded parameter tables onto `LoadedModel.properties`. Off by default: the
   * Snowdon federated model has 1.6 million parameter rows, and reading them costs about a second
   * and a transient 175 MB that no caller who is only drawing the model should have to pay.
   */
  readonly properties?: boolean;
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
 * The model's meshes as a `MeshTable` over the file's own buffers: nothing is copied but the four
 * range columns, and no `Mesh` object is built.
 *
 * `parseBfastModel` accepts triangle models without vertex colours only, so a vertex is three floats
 * and the whole vertex buffer is the table's position buffer; the file's indices already count from
 * each mesh's own first vertex, which is what `MeshTable` asks for. The stored per-mesh boxes are the
 * bounds column as they are, and are copied with the unusable ones emptied only when one is unusable.
 */
export function bfastMeshTable(model: RenderModel): MeshTable {
  const count = bfastMeshCount(model);
  const vertexStart = new Int32Array(count);
  const vertexCount = new Int32Array(count);
  const indexStart = new Int32Array(count);
  const indexCount = new Int32Array(count);
  let stored = true;
  for (let index = 0; index < count; index += 1) {
    const at = index * meshSliceInts;
    const vertices = model.meshSlices[at + 1] ?? 0;
    vertexStart[index] = model.meshSlices[at] ?? 0;
    vertexCount[index] = vertices;
    indexStart[index] = model.meshSlices[at + 2] ?? 0;
    indexCount[index] = model.meshSlices[at + 3] ?? 0;
    if (stored && !usableBox(model.meshBounds, index, vertices)) stored = false;
  }
  return {
    positions: model.vertices,
    indices: model.indices,
    vertexStart,
    vertexCount,
    indexStart,
    indexCount,
    bounds: stored ? model.meshBounds : emptiedBoxes(model.meshBounds, vertexCount),
  };
}

// True when the file's box for a mesh can be believed: the mesh has vertices and every float is finite.
function usableBox(all: Float32Array, index: number, vertices: number): boolean {
  if (vertices === 0) return false;
  const at = index * boundsStride;
  for (let offset = 0; offset < boundsStride; offset += 1) if (!Number.isFinite(all[at + offset])) return false;
  return true;
}

// The stored boxes with the unusable ones replaced by the empty box, so no reader believes a NaN.
function emptiedBoxes(all: Float32Array, vertexCount: Int32Array): Float32Array {
  const bounds = new Float32Array(vertexCount.length * boundsStride);
  const empty = [...emptyBounds.min, ...emptyBounds.max];
  for (let index = 0; index < vertexCount.length; index += 1) {
    const at = index * boundsStride;
    if (usableBox(all, index, vertexCount[index] ?? 0)) bounds.set(all.subarray(at, at + boundsStride), at);
    else bounds.set(empty, at);
  }
  return bounds;
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
  // Inline checks, not `requireThat`: a message closure allocated per instance is the whole cost.
  for (let row = 0; row < instances; row += 1) {
    const entity = model.instanceInts[row * instanceWords + entityWord] ?? -1;
    if (entity < 0) fail(formatCode.invalidBfast, `Instance ${row} names entity ${entity}`);
    if (declared > 0 && entity >= declared)
      fail(formatCode.invalidBfast, `Instance ${row} names entity ${entity}, beyond the ${declared} rows of the entity table`);
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

// The instance rows of a model, plus how many of them the file marks hidden.
export type BfastInstances = {
  readonly geometry: Geometry;
  readonly hidden: number;
  /** First instance row with geometry of each object row, or -1 when the object draws nothing. */
  readonly firstDrawn: Int32Array;
};

/**
 * The instance columns: one row per placement of the file, in the file's own order.
 *
 * A placement the file marks hidden is a row with `visible` 0, so a host can show it or unhide it and
 * nothing has to be rebuilt. The `visible` column exists only when the file marks something hidden.
 * `firstDrawn` names the first row with geometry whether or not it is hidden, because hiding is a
 * state a host changes and the object's representation is not.
 *
 * The flags word also carries a roughness byte and a metallic byte per placement. Each becomes a
 * column only when some row differs from the contract's default, since an absent column reads as that
 * default: a file whose placements are all fully diffuse dielectrics allocates neither.
 */
export function bfastInstances(
  model: RenderModel,
  table: MeshTable,
  rows: EntityRows,
  context: LoadContext,
): BfastInstances {
  const count = bfastInstanceCount(model);
  const words = model.instanceInts;
  const floats = model.instanceFloats;

  const meshIndex = new Int32Array(count);
  const objectIndex = new Int32Array(count);
  const transform = new Float32Array(count * transformStride);
  const color = new Float32Array(count * colorStride);
  // Each allocated on the first row that differs from the default, so a file saying nothing new
  // carries no column at all and every row reads as the default.
  let visible: Uint8Array | undefined;
  let roughness: Float32Array | undefined;
  let metallic: Float32Array | undefined;
  const firstDrawn = new Int32Array(rows.entityOfRow.length).fill(-1);
  const meshes = meshCount(table);

  // The checks below are written inline rather than through `requireThat`, because building the
  // message closure of an assertion that holds costs more here than everything else in the loop.
  let hidden = 0;
  for (let row = 0; row < count; row += 1) {
    if (row % cancellationCheckInterval === 0) throwIfCancelled(context);
    const at = row * instanceWords;
    const mesh = words[at + meshWord] ?? noMesh;
    if (mesh !== noMesh && (mesh < 0 || mesh >= meshes))
      fail(formatCode.invalidBfast, `Instance ${row} names mesh ${mesh} of ${meshes}`);
    const object = rows.rowOfEntity[words[at + entityWord] ?? 0] ?? -1;
    if (object < 0) fail(formatCode.invalidBfast, `Instance ${row} names an entity that is not an object`);
    meshIndex[row] = mesh;
    objectIndex[row] = object;
    if (mesh !== noMesh && (firstDrawn[object] ?? -1) === -1) firstDrawn[object] = row;
    writeColumnMajor(floats, at, transform, row * transformStride, row);
    const packed = words[at + colorWord] ?? 0;
    const colorAt = row * colorStride;
    color[colorAt] = (packed & 0xff) / 255;
    color[colorAt + 1] = ((packed >>> 8) & 0xff) / 255;
    color[colorAt + 2] = ((packed >>> 16) & 0xff) / 255;
    color[colorAt + 3] = ((packed >>> 24) & 0xff) / 255;
    const flags = words[at + flagsWord] ?? 0;
    if (((flags >>> 8) & hiddenFlag) !== 0) {
      visible ??= new Uint8Array(count).fill(1);
      visible[row] = 0;
      hidden += 1;
    }
    const rough = ((flags >>> roughnessShift) & 0xff) / 255;
    if (rough !== defaultRoughness) roughness ??= new Float32Array(count).fill(defaultRoughness);
    if (roughness !== undefined) roughness[row] = rough;
    const metal = ((flags >>> metallicShift) & 0xff) / 255;
    if (metal !== defaultMetallic) metallic ??= new Float32Array(count).fill(defaultMetallic);
    if (metallic !== undefined) metallic[row] = metal;
  }
  return {
    geometry: {
      meshes: [],
      meshTable: table,
      instances: {
        count,
        meshIndex,
        transform,
        color,
        objectIndex,
        ...(visible === undefined ? {} : { visible }),
        ...(roughness === undefined ? {} : { roughness }),
        ...(metallic === undefined ? {} : { metallic }),
      },
    },
    hidden,
    firstDrawn,
  };
}

/**
 * Copies one instance transform into the column.
 *
 * The file stores the three rows of a 3x4 matrix with translation in the fourth column of each row;
 * `InstanceRecords.transform` is column-major 4x4, so this is a transpose plus the last row.
 */
function writeColumnMajor(floats: Float32Array, at: number, out: Float32Array, target: number, source: number): void {
  for (let column = 0; column < 4; column += 1)
    for (let row = 0; row < 3; row += 1) {
      const value = floats[at + row * 4 + column] ?? 0;
      if (!Number.isFinite(value)) fail(formatCode.invalidBfast, `Instance ${source} has a transform holding ${value}`);
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
  /** Document index of each entity, -1 where the file names none. Null when nothing was decoded. */
  readonly document: Int32Array | null;
  /** The string table, kept so the property decode does not read it a second time. */
  readonly strings: readonly (string | undefined)[] | null;
  readonly diagnostics: readonly Diagnostic[];
};

// Nothing decoded: the model's objects are whatever its instance records name.
export const noEntityFacts: EntityFacts = {
  declared: 0,
  localId: null,
  name: null,
  category: null,
  document: null,
  strings: null,
  diagnostics: [],
};

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
  const columns = level === 'full' ? ['LocalId', 'Name', 'Category', 'Document'] : ['LocalId'];
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
 *
 * `Document` is a document-table index rather than a label, and is decoded whenever the labels are:
 * it is one more integer column on a table already being read, and it is what says which of a
 * federated model's source files an object came from.
 */
export function entityFactsFrom(
  entities: readonly Readonly<Record<string, unknown>>[],
  strings: readonly (string | undefined)[] | null,
): EntityFacts {
  const declared = entities.length;
  const localId = new Int32Array(declared);
  for (let row = 0; row < declared; row += 1) localId[row] = integerOf(entities[row]?.['LocalId']) ?? 0;
  if (strings === null)
    return { declared, localId, name: null, category: null, document: null, strings: null, diagnostics: [] };
  const name: (string | undefined)[] = [];
  const category: (string | undefined)[] = [];
  const document = new Int32Array(declared).fill(-1);
  for (let row = 0; row < declared; row += 1) {
    const entity = entities[row];
    name.push(labelOf(strings, integerOf(entity?.['Name'])));
    const owner = integerOf(entity?.['Category']);
    category.push(
      owner === undefined || owner < 0 || owner >= declared
        ? undefined
        : labelOf(strings, integerOf(entities[owner]?.['Name'])),
    );
    document[row] = integerOf(entity?.['Document']) ?? -1;
  }
  return { declared, localId, name, category, document, strings, diagnostics: [] };
}

// The BOS string table, or null when the file has none.
async function readStrings(data: BimData): Promise<readonly (string | undefined)[] | null> {
  const rows = await readBimTable(data, 'Strings.parquet', ['Strings']).catch(() => null);
  return rows === null ? null : rows.map((row) => textOf(row['Strings']));
}

/**
 * The source documents of a federated model, one per row of `Documents.parquet`, with the document
 * of each object row.
 *
 * Decoded whenever the entity labels were, because `Entities.Document` is already in hand by then
 * and the document table itself is a handful of rows. An absent table is a warning and no documents,
 * never a failure: a single-document export is a normal file.
 */
export async function readDocuments(
  data: BimData,
  facts: EntityFacts,
  rows: EntityRows,
): Promise<{ readonly documents: ModelDocuments | null; readonly diagnostics: readonly Diagnostic[] }> {
  if (facts.document === null || facts.strings === null) return { documents: null, diagnostics: [] };
  const table = await readBimTable(data, 'Documents.parquet', ['Title', 'Path']).catch(() => null);
  if (table === null)
    return {
      documents: null,
      diagnostics: [
        formatWarning(
          formatCode.missingDocumentTable,
          'This BFAST has no document table, so objects carry no source-document attribution',
          ['Documents.parquet'],
        ),
      ],
    };
  return {
    documents: modelDocumentsFrom(table, facts.strings, facts.document, rows.entityOfRow),
    diagnostics: [],
  };
}

/**
 * Every property of every object, decoded columnar, when the caller asked for it.
 *
 * `Descriptors` and `Parameters` are the two tables that must be there; `Numbers` and `Points` are
 * value pools that a model using neither kind does not carry, so an absent one is an empty pool
 * rather than a problem. A missing descriptor or parameter table is a warning and no properties,
 * which is what a file that carries only geometry looks like.
 *
 * The string table is reused from the entity read when there was one, so the default load path reads
 * it once whatever else is asked for.
 */
export async function readProperties(
  data: BimData,
  facts: EntityFacts,
  rows: EntityRows,
  context: LoadContext,
): Promise<{ readonly properties: ModelProperties | null; readonly diagnostics: readonly Diagnostic[] }> {
  reportProgress(context, 'metadata', 0, 2);
  const strings = facts.strings ?? (await readStrings(data));
  throwIfCancelled(context);
  const descriptors = await readBimTable(data, 'Descriptors.parquet').catch(() => null);
  throwIfCancelled(context);
  const parameters =
    descriptors === null
      ? null
      : await readBimTable(data, 'Parameters.parquet', ['Entity', 'Descriptor', 'Value']).catch(() => null);
  throwIfCancelled(context);
  if (strings === null || descriptors === null || parameters === null)
    return {
      properties: null,
      diagnostics: [
        formatWarning(
          formatCode.missingPropertyTables,
          `This BFAST is missing the ${missingNames(strings, descriptors, parameters)} it would take to read object properties`,
          ['Parameters.parquet'],
        ),
      ],
    };
  reportProgress(context, 'metadata', 1, 2);
  const numbers = await readBimTable(data, 'Numbers.parquet', ['Numbers']).catch(() => []);
  const points = await readBimTable(data, 'Points.parquet', ['X', 'Y', 'Z']).catch(() => []);
  throwIfCancelled(context);
  const properties = modelPropertiesFrom({
    descriptors,
    parameters,
    numbers,
    points,
    strings,
    objectOfEntity: rows.rowOfEntity,
    objects: rows.entityOfRow.length,
  });
  reportProgress(context, 'metadata', 2, 2);
  return {
    properties,
    diagnostics:
      properties.dropped === 0
        ? []
        : [
            formatWarning(
              formatCode.droppedProperties,
              `${properties.dropped} parameter rows name an entity that is not an object of this model and were dropped`,
              ['Parameters.parquet'],
            ),
          ],
  };
}

// Which of the tables the property decode needs were not there, for the warning that says so.
const missingNames = (strings: unknown, descriptors: unknown, parameters: unknown): string =>
  [
    ...(strings === null ? ['string table'] : []),
    ...(descriptors === null ? ['descriptor table'] : []),
    ...(parameters === null ? ['parameter table'] : []),
  ].join(' and ');

// A string-table entry, empty entries read as absent so nothing fabricates a name.
const labelOf = (strings: readonly (string | undefined)[], index: number | undefined): string | undefined => {
  if (index === undefined || index < 0) return undefined;
  const found = strings[index];
  return found === undefined || found.trim() === '' ? undefined : found;
};

// The Parquet cell readers, shared with the property decode so both read the encoding the same way.
const integerOf = parquetInteger;
const textOf = parquetText;

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
 * A prepared BFAST as a `LoadedModel`: a `Geometry.meshTable` over the file's own buffers with no
 * `Geometry.meshes`, one columnar instance row per drawn or geometry-free placement, and one object
 * per entity the file declares or an instance names.
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
  const table = bfastMeshTable(parsed);
  reportProgress(options, 'convert', 0, 2);
  const built = bfastInstances(parsed, table, rows, options);
  reportProgress(options, 'convert', 1, 2);

  const documents = await readDocuments(parsed.bimData, facts, rows);
  throwIfCancelled(options);
  const properties =
    options.properties === true
      ? await readProperties(parsed.bimData, facts, rows, options)
      : { properties: null, diagnostics: [] as readonly Diagnostic[] };
  throwIfCancelled(options);

  const ref = options.ref ?? defaultModelRef(undefined);
  const data: ModelData = {
    ref,
    coordinates: options.coordinates ?? bfastCoordinates,
    objects: bfastObjects(ref, rows, facts, built.firstDrawn),
  };
  reportProgress(options, 'convert', 2, 2);
  return loadedModel(
    'bfast',
    data,
    built.geometry,
    buffer.byteLength,
    [
    ...facts.diagnostics,
    ...documents.diagnostics,
    ...properties.diagnostics,
    ...(built.hidden > 0
      ? [
          formatNote(
            formatCode.hiddenInstances,
            `${built.hidden} placements are marked hidden in the file and are rows with visible 0`,
          ),
        ]
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
    ],
    {
      ...(properties.properties === null ? {} : { properties: properties.properties }),
      ...(documents.documents === null ? {} : { documents: documents.documents }),
    },
  );
}

// Parses the container and the render tables, turning the loader's errors into format diagnostics.
function parseModel(buffer: ArrayBuffer): ReturnType<typeof parseBfastModel> {
  try {
    return parseBfastModel(buffer);
  } catch (error) {
    return fail(formatCode.invalidBfast, messageOf(error));
  }
}
