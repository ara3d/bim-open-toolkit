// BOS container decode: a .bos file is a ZIP of parquet tables.
// Ported from @ara3d/ara3d-webgl 1.3.15 (src/loader/bimOpenSchemaLoader.ts,
// recovered from the package's published source map).
// Source repo: https://github.com/ara3d/ara3d-webgl

import JSZip from 'jszip';
import { parquetMetadataAsync, parquetRead } from 'hyparquet';
import { compressors } from 'hyparquet-compressors';
import { ViewerScene } from '@ara3d/viewer-core';
import { LoadOptions, LoadSource } from './progress.js';
import { toArrayBuffer } from './fetch-buffer.js';
import { BosConvertResult, BosGeometry, bosToGroups } from './bos-geometry.js';
import { readEntityLocalIds } from './bim-data.js';
import { isBFast } from './bfast.js';
import { loadBfast } from './bfast-loader.js';

type TypedArrayCtor =
  | Int32ArrayConstructor
  | Uint32ArrayConstructor
  | Uint8ArrayConstructor
  | Float32ArrayConstructor;

const findEntry = (zip: JSZip, suffix: string): string => {
  const lower = suffix.toLowerCase();
  const name = Object.keys(zip.files).find((n) => n.toLowerCase().endsWith(lower));
  if (!name) throw new Error(`Could not find "${suffix}" in BOS archive`);
  return name;
};

/** Reads one parquet table's columns into `target`, coercing to `ctor` arrays. */
async function readTable(
  zip: JSZip,
  table: string,
  target: Record<string, unknown>,
  ctor: TypedArrayCtor,
): Promise<void> {
  const entry = findEntry(zip, `${table}.parquet`);
  const file = await zip.files[entry].async('arraybuffer');
  const metadata = await parquetMetadataAsync(file);
  if (Number(metadata.num_rows) === 0) {
    for (const el of metadata.schema)
      if (el.name && el.type !== undefined) target[el.name] = new ctor(0);
    return;
  }
  await parquetRead({
    file,
    compressors,
    metadata,
    onChunk(chunk) {
      const data = chunk.columnData;
      // Parquet may deliver several chunks, and callbacks need not arrive in row order.
      const column = target[chunk.columnName] as InstanceType<TypedArrayCtor> | undefined;
      const output = column ?? new ctor(Number(metadata.num_rows));
      output.set(data.constructor === ctor ? data as ArrayLike<number> : ctor.from(data as ArrayLike<number>), chunk.rowStart);
      target[chunk.columnName] = output;
    },
  });
}

/** Decodes the six BOS geometry tables from .bos (ZIP-of-parquet) bytes. */
export async function parseBosGeometry(buffer: ArrayBuffer): Promise<BosGeometry> {
  const zip = await JSZip.loadAsync(buffer);
  return parseBosGeometryFromZip(zip);
}

/** Shared by the loader and BOS-to-BFAST converter; opens the ZIP only once. */
export async function parseBosGeometryFromZip(zip: JSZip): Promise<BosGeometry> {
  const bg: Record<string, unknown> = {};
  await readTable(zip, 'Instances', bg, Int32Array);
  await readTable(zip, 'VertexBuffer', bg, Int32Array);
  await readTable(zip, 'IndexBuffer', bg, Uint32Array);
  await readTable(zip, 'Meshes', bg, Int32Array);
  await readTable(zip, 'Materials', bg, Uint8Array);
  await readTable(zip, 'Transforms', bg, Float32Array);
  const entities = Object.values(zip.files).find(file => !file.dir && file.name.split('/').pop()?.toLowerCase() === 'entities.parquet');
  bg.EntityLocalId = entities ? await readEntityLocalIds(await entities.async('arraybuffer')) : null;
  return bg as unknown as BosGeometry;
}

/**
 * Loads a BOS model into the scene: fetch (when `source` is a URL), decode the
 * ZIP-of-parquet container, then convert the geometry tables to
 * InstancedGroups (instances merged per mesh + material). Groups are added to
 * `scene` one by one; `onProgress` reports each stage.
 *
 * Geometry plus the Entities table's LocalId column (the ids instances are
 * reported under); the rest of the BOS entity/parameter data is out of scope.
 */
export async function loadBos(
  source: LoadSource,
  scene: ViewerScene,
  options: LoadOptions = {},
): Promise<BosConvertResult> {
  const onProgress = options.onProgress;
  const buffer = await toArrayBuffer(source, onProgress);
  if (isBFast(buffer)) return loadBfast(buffer, scene, options);
  onProgress?.({ stage: 'parse', loaded: 0, total: 1 });
  const bos = await parseBosGeometry(buffer);
  onProgress?.({ stage: 'parse', loaded: 1, total: 1 });
  return bosToGroups(bos, (group, index, total) => {
    scene.addGroup(group);
    onProgress?.({ stage: 'convert', loaded: index + 1, total });
  });
}
