/**
 * The objects of a loaded model as columns instead of records.
 *
 * The alpha loader builds one frozen `ObjectRecord` per entity, each holding a
 * frozen reference object, a generated name, an identity transform and a
 * default appearance. Everything in that record is either constant or derivable
 * from two integers, so this keeps the two integers and derives the rest on
 * demand. A model with 51,139 entities keeps two `Int32Array`s instead of
 * 51,139 objects holding four objects each.
 */
import { columnAt, type IntColumn } from './source.js';

// An entity with no source document id. Matches the loader's "0 or negative means absent".
export const noSourceId = 0;

/**
 * One row per object of the model, in the order the alpha loader creates them:
 * every row of the entity table first, then any further entity an instance
 * record refers to, in instance order.
 */
export type ObjectTable = {
  readonly count: number;
  /** Entity row of the source model, per object row. */
  readonly entityIndex: Int32Array;
  /** Source document id (BOS `LocalId`) per object row, `noSourceId` when the model has none. */
  readonly sourceId: Int32Array;
  /** Object row of each entity index, or -1. Sized to the largest entity seen. */
  readonly rowOfEntity: Int32Array;
};

// The identity an object is addressed by outside the loader.
export type ObjectIdentity = {
  readonly modelId: string;
  readonly objectId: string;
};

/** The alpha loader's normalized object, materialized from the columns for one row. */
export type NormalizedObject = {
  readonly ref: ObjectIdentity;
  readonly name: string;
  readonly sourceId?: string;
};

const requireEntity = (entity: number): number => {
  if (!Number.isInteger(entity) || entity < 0) throw new Error('Invalid model entity index');
  return entity;
};

/**
 * Builds the object rows. `entityLocalIds` is the decoded entity table when the
 * model has one; an instance that names an entity beyond that table is an
 * error, as it is in the alpha loader, because such an object has no identity.
 */
export function buildObjectTable(entityLocalIds: Int32Array | null, instanceEntities: IntColumn): ObjectTable {
  const tableRows = entityLocalIds?.length ?? 0;
  let largest = tableRows - 1;
  for (let i = 0; i < instanceEntities.count; i += 1) {
    const entity = requireEntity(columnAt(instanceEntities, i));
    if (entityLocalIds !== null && entity >= tableRows)
      throw new Error('Model entity index exceeds the entity table');
    if (entity > largest) largest = entity;
  }
  const rowOfEntity = new Int32Array(largest + 1).fill(-1);
  const entityIndex = new Int32Array(largest + 1);
  let count = 0;
  const add = (entity: number): void => {
    if (rowOfEntity[entity] !== -1) return;
    rowOfEntity[entity] = count;
    entityIndex[count] = entity;
    count += 1;
  };
  for (let entity = 0; entity < tableRows; entity += 1) add(entity);
  for (let i = 0; i < instanceEntities.count; i += 1) add(columnAt(instanceEntities, i));
  const sourceId = new Int32Array(count);
  if (entityLocalIds !== null)
    for (let row = 0; row < count; row += 1) {
      const id = entityLocalIds[entityIndex[row] ?? 0] ?? noSourceId;
      sourceId[row] = id > 0 ? id : noSourceId;
    }
  return { count, entityIndex: entityIndex.subarray(0, count), sourceId, rowOfEntity };
}

// The object id the alpha loader gives an entity row.
export const objectIdAt = (table: ObjectTable, row: number): string => `bos:${table.entityIndex[row] ?? -1}`;

// The display name the alpha loader gives an entity row: its source id when it has one.
export const objectNameAt = (table: ObjectTable, row: number): string => {
  const id = table.sourceId[row] ?? noSourceId;
  return id > noSourceId ? `Object ${id}` : `Entity ${table.entityIndex[row] ?? -1}`;
};

// One object materialized from the columns. Bulk code reads the columns instead.
export const objectAt = (table: ObjectTable, row: number, modelId: string): NormalizedObject => {
  const id = table.sourceId[row] ?? noSourceId;
  return {
    ref: { modelId, objectId: objectIdAt(table, row) },
    name: objectNameAt(table, row),
    ...(id > noSourceId ? { sourceId: String(id) } : {}),
  };
};
