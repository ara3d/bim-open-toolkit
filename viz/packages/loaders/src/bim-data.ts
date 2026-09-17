import { parquetMetadataAsync, parquetRead, parquetReadObjects } from 'hyparquet';
import { compressors } from 'hyparquet-compressors';
import type { BFast } from './bfast.js';

/** Original ZIP entry paths mapped to immutable, file-backed Parquet bytes. */
export type BimData = ReadonlyMap<string, Uint8Array>;
export const BOS_BUFFER_PREFIX = 'BOS/';

export function bfastBimData(container: BFast): BimData {
  return new Map(container.buffers
    .filter(b => b.name.startsWith(BOS_BUFFER_PREFIX) && b.name.toLowerCase().endsWith('.parquet'))
    .map(b => [b.name.slice(BOS_BUFFER_PREFIX.length), b.bytes]));
}

/** Exact path preferred; a unique case-insensitive basename is also accepted. */
export function findBimTable(data: BimData, name: string): Uint8Array | undefined {
  const exact = data.get(name);
  if (exact) return exact;
  const matches = [...data].filter(([path]) => path.split('/').pop()?.toLowerCase() === name.toLowerCase());
  if (matches.length > 1) throw new Error(`Ambiguous BIM table: ${name}`);
  return matches[0]?.[1];
}

/** Parquet uses relative file offsets, not offsets into the containing BFAST. */
function parquetFile(bytes: Uint8Array) {
  return { byteLength: bytes.byteLength, slice: (start: number, end = bytes.byteLength) =>
    bytes.buffer.slice(bytes.byteOffset + start, bytes.byteOffset + end) as ArrayBuffer };
}

/** Decode only a requested table/column set. Property tables are never read by rendering. */
export async function readBimTable(data: BimData, name: string, columns?: string[]): Promise<Record<string, unknown>[]> {
  const bytes = findBimTable(data, name);
  if (!bytes) throw new Error(`Missing BIM table: ${name}`);
  return parquetReadObjects({ file: parquetFile(bytes), compressors, ...(columns ? { columns } : {}) });
}

/** Same source-ID mapping for ZIP and BFAST; decode only the LocalId column. */
export async function readEntityLocalIds(source: ArrayBuffer | Uint8Array): Promise<Int32Array> {
  const file = source instanceof ArrayBuffer ? source : parquetFile(source);
  const metadata = await parquetMetadataAsync(file);
  const ids = new Int32Array(Number(metadata.num_rows));
  if (ids.length === 0) return ids;
  await parquetRead({ file, compressors, metadata, columns: ['LocalId'], onChunk(chunk) {
    if (chunk.columnName !== 'LocalId') return;
    for (let i = 0; i < chunk.columnData.length && chunk.rowStart + i < ids.length; i++)
      ids[chunk.rowStart + i] = Number(chunk.columnData[i]);
  } });
  return ids;
}

export async function bimEntityLocalIds(data: BimData): Promise<Int32Array | null> {
  const bytes = findBimTable(data, 'Entities.parquet');
  return bytes ? readEntityLocalIds(bytes) : null;
}
