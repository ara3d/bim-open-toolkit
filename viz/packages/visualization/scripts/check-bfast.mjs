// Read-only parity/CPU gate. Pass a BOS and its BFAST conversion from ara3d-webgl.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { parseBfastModel, bfastToGroups, parseBosGeometry, bosToGroups } from '@ara3d/viewer-loaders';

const [bosPath, bfastPath] = process.argv.slice(2);
assert.ok(bosPath && bfastPath, 'Usage: node scripts/check-bfast.mjs <source.bos> <converted.bfast>');
const results = [];
for (const [kind, path] of [['bos', bosPath], ['bfast', bfastPath]]) {
  if (process.argv.includes('--measure-bos') && kind !== 'bos') continue;
  if (process.argv.includes('--measure-bfast') && kind !== 'bfast') continue;
  const bytes = await readFile(path);
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const start = performance.now();
  const model = kind === 'bos' ? await parseBosGeometry(buffer) : parseBfastModel(buffer);
  const parsed = performance.now();
  const groups = kind === 'bos' ? bosToGroups({ ...model, EntityLocalId: null }) : bfastToGroups(model);
  const converted = performance.now();
  results.push(groups);
  console.log(JSON.stringify({ kind, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'),
    parseMs: parsed - start, convertMs: converted - parsed, groups: groups.groups.length,
    instances: groups.instanceCount, triangles: groups.groups.reduce((n, g) => n + g.mesh.indices.length / 3 * g.instanceCount, 0) }));
}
if (results.length === 1) process.exit(0);
const [bos, bfast] = results;
assert.equal(bfast.instanceCount, bos.instanceCount);
assert.equal(bfast.groups.length, bos.groups.length);
for (let i = 0; i < bos.groups.length; i++) {
  const a = bos.groups[i], b = bfast.groups[i];
  assert.deepEqual(bfast.groupEntities[i].entities, bos.groupEntities[i].entities);
  assert.deepEqual(b.material, a.material);
  for (const [left, right] of [[a.mesh.positions, b.mesh.positions], [a.mesh.indices, b.mesh.indices], [a.transforms, b.transforms], [a.colors, b.colors]]) {
    assert.equal(left.length, right.length);
    for (let j = 0; j < left.length; j++) assert.ok(Math.abs(left[j] - right[j]) <= 1e-5, `group ${i}, value ${j}: ${left[j]} != ${right[j]}`);
  }
}
console.log('PASS: all mesh positions/indices, transforms, colors, materials and entity rows match (tolerance 1e-5). CPU only; excludes fetch, normalization and rendering.');
