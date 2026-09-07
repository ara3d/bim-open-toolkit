// Read-only verification of a BOS and its combined BFAST conversion.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import JSZip from 'jszip';
import { parseBfastModel, parseBosGeometry, readBimTable } from '@ara3d/viewer-loaders';
import { loadBosModel } from '../dist/loading.js';

const [bosPath, bfastPath] = process.argv.slice(2);
assert.ok(bosPath && bfastPath, 'Usage: node scripts/check-bfast-bim.mjs <source.bos> <combined.bfast>');
const sourceBytes = await readFile(bosPath), preparedBytes = await readFile(bfastPath);
const buffer = bytes => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
const source = buffer(sourceBytes), prepared = buffer(preparedBytes);
const zip = await JSZip.loadAsync(source), parsed = parseBfastModel(prepared);
const tables = Object.values(zip.files).filter(f => !f.dir && f.name.toLowerCase().endsWith('.parquet'));
assert.equal(parsed.bimData.size, tables.length);
for (const table of tables) assert.deepEqual(parsed.bimData.get(table.name), await table.async('uint8array'), table.name);
const ids = (await parseBosGeometry(source)).EntityLocalId;
const start = performance.now();
const result = await loadBosModel(prepared, { id: 'snowdon', revision: 'combined' }, { sourceUp: 'Z' });
const loadMs = performance.now() - start;
assert.ok(result.ok, JSON.stringify(result.diagnostics));
assert.equal(result.value.model.objects.length, ids.length);
result.value.model.objects.forEach((object, row) => {
  assert.equal(object.ref.objectId, `bos:${row}`);
  assert.equal(object.sourceId, ids[row] > 0 ? String(ids[row]) : undefined);
});
// A non-identity property table must also be usable through the returned model.
const parameters = await readBimTable(result.value.bimData, 'Parameters.parquet');
assert.ok(parameters.length > 0);
console.log(JSON.stringify({ bytes: preparedBytes.length, sha256: createHash('sha256').update(preparedBytes).digest('hex'),
  parquetFiles: tables.length, objects: result.value.model.objects.length, instances: result.value.bindings.length,
  parameterRows: parameters.length, normalizedLoadMs: loadMs }));
console.log('PASS: every original Parquet byte, all entity rows/source IDs, and on-demand parameter decoding.');
