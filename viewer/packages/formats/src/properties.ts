/**
 * The parameters, quantities and source documents a BOS model records, decoded columnar.
 *
 * BOS keeps object properties in one entity-attribute-value table: `Parameters.parquet` is three
 * integers per row - the entity, the descriptor, and one raw `Value` word - and `Descriptors.parquet`
 * says what a descriptor means: its name, its units as the exporter recorded them, its group, and
 * which pool the `Value` word indexes. The pools are `Strings.parquet`, `Numbers.parquet` and
 * `Points.parquet`; an `Int` value is the word itself and an `Entity` value names another object.
 *
 * WHAT THIS COSTS. On the Snowdon federated model the parameter table is 1,620,524 rows. Held as row
 * objects that would be over a hundred megabytes and a garbage-collector problem in a browser tab, so
 * nothing here keeps one: the rows become two `Int32Array` columns sorted into object order, plus one
 * offset column over the objects. That is `8 bytes x rows + 4 bytes x (objects + 1)`, so about 13 MB
 * for Snowdon, and reading one property allocates nothing until a caller asks for a `PropertyReading`.
 * The transient cost is the Parquet reader's own: it hands back row objects, which is about 175 MB
 * live for the moment between reading and compacting, and released as soon as the decode returns.
 * That transient is why `LoadOptions.properties` defaults to off.
 */

// Which pool a parameter's raw `Value` word indexes. These are the BOS `ParameterType` ordinals.
export type PropertyKind = 'int' | 'number' | 'entity' | 'string' | 'point' | 'unknown';

// `ParameterType` by ordinal. A file recording anything else reads as `unknown` rather than as a guess.
const kindsByOrdinal: readonly PropertyKind[] = ['int', 'number', 'entity', 'string', 'point'];

// The kind an ordinal names, `unknown` for an ordinal this schema version does not define.
export const propertyKindOf = (ordinal: number | undefined): PropertyKind =>
  ordinal === undefined ? 'unknown' : kindsByOrdinal[ordinal] ?? 'unknown';

/**
 * What each descriptor means, as parallel arrays: one entry per row of `Descriptors.parquet`.
 *
 * `units` is the exporter's own unit name - `SQUARE_FEET`, `CUBIC_FEET`, `FEET_AND_FRACTIONAL_INCHES`
 * - carried through unchanged. Nothing here converts, because a converted number that has lost the
 * name it was recorded in cannot be checked by the person reading it.
 */
export type PropertyDescriptors = {
  readonly count: number;
  readonly name: readonly (string | undefined)[];
  readonly units: readonly (string | undefined)[];
  readonly group: readonly (string | undefined)[];
  readonly kind: readonly PropertyKind[];
  /** Descriptor indices of each name. One name repeats across groups and value kinds. */
  readonly byName: ReadonlyMap<string, readonly number[]>;
};

// A model with no descriptor table.
export const noPropertyDescriptors: PropertyDescriptors = {
  count: 0,
  name: [],
  units: [],
  group: [],
  kind: [],
  byName: new Map(),
};

/**
 * Every property of every object of a model, as columns.
 *
 * The parameter rows are sorted into object order, so an object's properties are the half-open range
 * `[start[object], start[object + 1])` of `descriptor` and `value` and no indirection is walked. The
 * `Value` word is kept exactly as the file records it; `readProperty` resolves it through the pools.
 */
export type ModelProperties = {
  readonly descriptors: PropertyDescriptors;
  /** Object rows the offset column covers. `start` has one more entry than this. */
  readonly objects: number;
  /** Parameter rows kept, which is `descriptor.length` and `value.length`. */
  readonly rows: number;
  /** Where each object's rows begin. `objects + 1` entries, the last being `rows`. */
  readonly start: Int32Array;
  /** Descriptor index of each parameter row, in object order. */
  readonly descriptor: Int32Array;
  /** The raw `Value` word of each parameter row. Its meaning is the descriptor's kind. */
  readonly value: Int32Array;
  /** The number pool a `number` value indexes. */
  readonly numbers: Float32Array;
  /** The string pool a `string` value indexes, and the pool descriptor labels come from. */
  readonly strings: readonly (string | undefined)[];
  /** The point pool a `point` value indexes, three floats per point. */
  readonly points: Float32Array;
  /** Object row of each entity index, -1 for an entity index that is not an object of this model. */
  readonly objectOfEntity: Int32Array;
  /** Parameter rows discarded because they named an entity that is not an object of this model. */
  readonly dropped: number;
};

// A model whose property tables were absent or not asked for.
export const noModelProperties: ModelProperties = {
  descriptors: noPropertyDescriptors,
  objects: 0,
  rows: 0,
  start: new Int32Array(1),
  descriptor: new Int32Array(0),
  value: new Int32Array(0),
  numbers: new Float32Array(0),
  strings: [],
  points: new Float32Array(0),
  objectOfEntity: new Int32Array(0),
  dropped: 0,
};

/**
 * Which source file each object came from.
 *
 * A federated model is several documents in one file - Snowdon is seven - and `Entities.Document`
 * says which one an object belongs to. `ofObject` is indexed by object row, -1 where the file names
 * no document, so a roll-up groups by an integer rather than by a string.
 */
export type ModelDocuments = {
  readonly count: number;
  readonly title: readonly (string | undefined)[];
  readonly path: readonly (string | undefined)[];
  /** Document index of each object row, -1 when the file names none. */
  readonly ofObject: Int32Array;
};

// The document of an object row, or -1 when the file names none.
export const documentOfObject = (documents: ModelDocuments, objectRow: number): number =>
  documents.ofObject[objectRow] ?? -1;

// The rows a decode reads. Kept separate from any file access so the decoding can be tested directly.
export type PropertyTables = {
  readonly descriptors: readonly Readonly<Record<string, unknown>>[];
  readonly parameters: readonly Readonly<Record<string, unknown>>[];
  /** Rows of `Numbers.parquet`, each holding one `Numbers` float. */
  readonly numbers: readonly Readonly<Record<string, unknown>>[];
  /** Rows of `Points.parquet`, each holding `X`, `Y` and `Z`. */
  readonly points: readonly Readonly<Record<string, unknown>>[];
  readonly strings: readonly (string | undefined)[];
  /** Object row of each entity index, -1 for an entity that is not an object. */
  readonly objectOfEntity: Int32Array;
  readonly objects: number;
};

/**
 * The descriptor rows read as labels, without any file access.
 *
 * `Name`, `Units` and `Group` are string-table indices; an index that is absent, out of range or
 * names an empty string reads as no value rather than as a made-up one, which is what the entity
 * reader does with the same encoding.
 */
export function propertyDescriptorsFrom(
  rows: readonly Readonly<Record<string, unknown>>[],
  strings: readonly (string | undefined)[],
): PropertyDescriptors {
  const count = rows.length;
  const name: (string | undefined)[] = [];
  const units: (string | undefined)[] = [];
  const group: (string | undefined)[] = [];
  const kind: PropertyKind[] = [];
  const byName = new Map<string, number[]>();
  for (let row = 0; row < count; row += 1) {
    const each = rows[row];
    const label = poolText(strings, parquetInteger(each?.['Name']));
    name.push(label);
    units.push(poolText(strings, parquetInteger(each?.['Units'])));
    group.push(poolText(strings, parquetInteger(each?.['Group'])));
    kind.push(propertyKindOf(parquetInteger(each?.['Type'])));
    if (label === undefined) continue;
    const found = byName.get(label);
    if (found === undefined) byName.set(label, [row]);
    else found.push(row);
  }
  return { count, name, units, group, kind, byName };
}

/**
 * The parameter rows compacted into object-ordered columns, without any file access.
 *
 * Two passes over the rows: one counting per object, one scattering into the counted places. Nothing
 * is sorted and nothing per row is allocated, so the whole decode is `O(rows)` and its only lasting
 * allocation is the three columns. A row naming an entity that is not an object of this model is
 * counted in `dropped` and discarded, because there is no object to hang it on.
 */
export function modelPropertiesFrom(tables: PropertyTables): ModelProperties {
  const { parameters, objectOfEntity, objects } = tables;
  const descriptors = propertyDescriptorsFrom(tables.descriptors, tables.strings);

  const start = new Int32Array(objects + 1);
  let dropped = 0;
  for (let row = 0; row < parameters.length; row += 1) {
    const object = objectOfEntity[parquetInteger(parameters[row]?.['Entity']) ?? -1] ?? -1;
    if (object < 0 || object >= objects) dropped += 1;
    else start[object + 1] = (start[object + 1] ?? 0) + 1;
  }
  for (let object = 0; object < objects; object += 1) start[object + 1] = (start[object + 1] ?? 0) + (start[object] ?? 0);

  const rows = parameters.length - dropped;
  const descriptor = new Int32Array(rows);
  const value = new Int32Array(rows);
  const cursor = start.slice(0, objects);
  for (let row = 0; row < parameters.length; row += 1) {
    const each = parameters[row];
    const object = objectOfEntity[parquetInteger(each?.['Entity']) ?? -1] ?? -1;
    if (object < 0 || object >= objects) continue;
    const at = cursor[object] ?? 0;
    cursor[object] = at + 1;
    descriptor[at] = parquetInteger(each?.['Descriptor']) ?? -1;
    value[at] = parquetInteger(each?.['Value']) ?? 0;
  }

  const numbers = new Float32Array(tables.numbers.length);
  for (let row = 0; row < numbers.length; row += 1) numbers[row] = parquetNumber(tables.numbers[row]?.['Numbers']) ?? 0;
  const points = new Float32Array(tables.points.length * 3);
  for (let row = 0; row < tables.points.length; row += 1) {
    const each = tables.points[row];
    points[row * 3] = parquetNumber(each?.['X']) ?? 0;
    points[row * 3 + 1] = parquetNumber(each?.['Y']) ?? 0;
    points[row * 3 + 2] = parquetNumber(each?.['Z']) ?? 0;
  }
  return {
    descriptors,
    objects,
    rows,
    start,
    descriptor,
    value,
    numbers,
    strings: tables.strings,
    points,
    objectOfEntity,
    dropped,
  };
}

/**
 * The document rows read as titles and paths, with the document of each object row.
 *
 * `entityDocument` is indexed by entity, which is how the file records it; `entityOfObject` is the
 * object rows in their own order, which is how a caller reads it.
 */
export function modelDocumentsFrom(
  rows: readonly Readonly<Record<string, unknown>>[],
  strings: readonly (string | undefined)[],
  entityDocument: Int32Array,
  entityOfObject: Int32Array,
): ModelDocuments {
  const count = rows.length;
  const title: (string | undefined)[] = [];
  const path: (string | undefined)[] = [];
  for (let row = 0; row < count; row += 1) {
    title.push(poolText(strings, parquetInteger(rows[row]?.['Title'])));
    path.push(poolText(strings, parquetInteger(rows[row]?.['Path'])));
  }
  const ofObject = new Int32Array(entityOfObject.length);
  for (let object = 0; object < entityOfObject.length; object += 1) {
    const document = entityDocument[entityOfObject[object] ?? -1] ?? -1;
    ofObject[object] = document >= 0 && document < count ? document : -1;
  }
  return { count, title, path, ofObject };
}

// Where an object's parameter rows begin, and where they end. An object outside the table has none.
export const propertyRowStart = (properties: ModelProperties, objectRow: number): number =>
  objectRow < 0 || objectRow >= properties.objects ? 0 : properties.start[objectRow] ?? 0;
export const propertyRowEnd = (properties: ModelProperties, objectRow: number): number =>
  objectRow < 0 || objectRow >= properties.objects ? 0 : properties.start[objectRow + 1] ?? 0;

// How many properties an object has.
export const propertyCount = (properties: ModelProperties, objectRow: number): number =>
  propertyRowEnd(properties, objectRow) - propertyRowStart(properties, objectRow);

/**
 * One parameter row read whole: what the property is called, what unit it was recorded in, and its
 * value resolved through the pools.
 *
 * This allocates one object, which is why it is not what the columns are made of: a caller showing a
 * property sheet reads a few dozen of these, and a caller scanning a million rows uses the columns
 * and `propertyNumber` instead.
 */
export type PropertyReading = {
  readonly descriptor: number;
  readonly name: string | undefined;
  /** The unit exactly as the exporter recorded it, such as `SQUARE_FEET`. Nothing is converted. */
  readonly units: string | undefined;
  readonly group: string | undefined;
  readonly kind: PropertyKind;
  /**
   * The value: a number for `int` and `number`, the text for `string`, the object row for `entity`,
   * and undefined for `point` - which reads through `point` - and for anything the pools cannot resolve.
   */
  readonly value: number | string | undefined;
  /** X, Y and Z of a `point` value. */
  readonly point?: readonly [number, number, number];
  /** The `Value` word exactly as the file records it, for a caller that wants the encoding. */
  readonly raw: number;
};

// One parameter row, resolved. `row` is an index into the `descriptor` and `value` columns.
export function readProperty(properties: ModelProperties, row: number): PropertyReading {
  const index = properties.descriptor[row] ?? -1;
  const { name, units, group, kind } = properties.descriptors;
  const raw = properties.value[row] ?? 0;
  const point = kind[index] === 'point' ? pointAt(properties, raw) : undefined;
  return {
    descriptor: index,
    name: name[index],
    units: units[index],
    group: group[index],
    kind: kind[index] ?? 'unknown',
    value: propertyValue(properties, row),
    ...(point === undefined ? {} : { point }),
    raw,
  };
}

// One parameter row's value, resolved through the pools. Allocates nothing.
export function propertyValue(properties: ModelProperties, row: number): number | string | undefined {
  const index = properties.descriptor[row] ?? -1;
  const raw = properties.value[row] ?? 0;
  switch (properties.descriptors.kind[index] ?? 'unknown') {
    case 'int':
      return raw;
    case 'number':
      return raw >= 0 && raw < properties.numbers.length ? properties.numbers[raw] : undefined;
    case 'string':
      return poolText(properties.strings, raw);
    case 'entity': {
      const object = properties.objectOfEntity[raw] ?? -1;
      return object < 0 ? undefined : object;
    }
    default:
      return undefined;
  }
}

/**
 * One parameter row's value as a number, for the quantities.
 *
 * `int` and `number` rows read as themselves and everything else reads as undefined, so a caller
 * summing a quantity never adds a string index to a total by accident.
 */
export function propertyNumber(properties: ModelProperties, row: number): number | undefined {
  const value = propertyValue(properties, row);
  return typeof value === 'number' && properties.descriptors.kind[properties.descriptor[row] ?? -1] !== 'entity'
    ? value
    : undefined;
}

// The point a `point` value names, or undefined when the pool does not hold it.
function pointAt(properties: ModelProperties, index: number): readonly [number, number, number] | undefined {
  const at = index * 3;
  if (index < 0 || at + 3 > properties.points.length) return undefined;
  return [properties.points[at] ?? 0, properties.points[at + 1] ?? 0, properties.points[at + 2] ?? 0];
}

/**
 * The parameter row of one named property of one object, or -1 when the object does not carry it.
 *
 * The name is looked up once in the descriptor index and the object's own rows - a few dozen, not a
 * million - are scanned for a descriptor in that set. A name recorded under more than one group or
 * value kind matches whichever the object carries first.
 */
export function findPropertyRow(properties: ModelProperties, objectRow: number, name: string): number {
  const wanted = properties.descriptors.byName.get(name);
  if (wanted === undefined) return -1;
  const end = propertyRowEnd(properties, objectRow);
  for (let row = propertyRowStart(properties, objectRow); row < end; row += 1) {
    const index = properties.descriptor[row] ?? -1;
    for (const each of wanted) if (each === index) return row;
  }
  return -1;
}

// One named property of one object, resolved, or undefined when the object does not carry it.
export function findProperty(
  properties: ModelProperties,
  objectRow: number,
  name: string,
): PropertyReading | undefined {
  const row = findPropertyRow(properties, objectRow, name);
  return row < 0 ? undefined : readProperty(properties, row);
}

// Every property of one object, resolved. Allocates one reading per property; a sheet's worth.
export function objectProperties(properties: ModelProperties, objectRow: number): readonly PropertyReading[] {
  const readings: PropertyReading[] = [];
  const end = propertyRowEnd(properties, objectRow);
  for (let row = propertyRowStart(properties, objectRow); row < end; row += 1)
    readings.push(readProperty(properties, row));
  return readings;
}

// A pooled string, empty entries read as absent so nothing fabricates a label.
const poolText = (strings: readonly (string | undefined)[], index: number | undefined): string | undefined => {
  if (index === undefined || index < 0) return undefined;
  const found = strings[index];
  return found === undefined || found.trim() === '' ? undefined : found;
};

// A Parquet cell read as an integer. BOS stores some ids as 64-bit values, which arrive as bigints.
export const parquetInteger = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === 'bigint') return Number(value);
  return undefined;
};

// A Parquet cell read as a float.
export const parquetNumber = (value: unknown): number | undefined => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'bigint') return Number(value);
  return undefined;
};

// A Parquet cell read as text.
export const parquetText = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined);
