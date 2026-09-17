// Opt-in, read-only private-fixture gate. Importing this file never loads the fixture.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import { cpus, platform, release } from 'node:os';

export const snowdonSha256 = 'fc31c4463d9eb958ae8de3d853cfc8224b9469477b419857fbc929956c9cc51d';

export async function checkNormalizedSnowdon(fixture) {
  assert.ok(fixture, 'Supply an explicit Snowdon fixture path');
  const { loadBosModel } = await import('../dist/loading.js');
  const { parseBosGeometry } = await import('@ara3d/viewer-loaders');
  const { groupBounds, unionBounds } = await import('@ara3d/viewer-core');
  const started = performance.now();
  const bytes = await readFile(fixture), hash = createHash('sha256').update(bytes).digest('hex');
  assert.equal(hash, snowdonSha256, 'Fixture revision differs from the pinned Snowdon baseline');
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  const ref = { id: 'snowdon-gate', revision: hash };
  // Keep just the source-ID column after a baseline parse, not another complete geometry copy.
  const sourceIds = await (async () => {
    const source = await parseBosGeometry(buffer);
    assert.equal(source.InstanceEntityIndex.length, 471462);
    assert.equal(source.EntityLocalId?.length, 51139);
    return source.EntityLocalId;
  })();

  for (const malformed of [new TextEncoder().encode('<!doctype html>').buffer, new Uint8Array([80,75,3,4]).buffer]) {
    const result = await loadBosModel(malformed, ref);
    assert.equal(result.ok, false, 'Malformed data was accepted');
    assert.equal(result.diagnostics[0]?.code, 'load-failed');
    assert.equal('value' in result, false);
  }
  const controller = new AbortController(); let timer, completedProgress = false;
  const abortStarted = performance.now();
  let aborted;
  try {
    aborted = await loadBosModel(buffer, ref, { signal: controller.signal, sourceUp: 'Z', onProgress(progress) {
      if (progress.stage !== 'convert') return;
      if (timer === undefined) timer = setTimeout(() => controller.abort(), 0);
      if (progress.loaded === progress.total) completedProgress = true;
    } });
  } finally { if (timer !== undefined) clearTimeout(timer); }
  assert.equal(aborted.ok, false, 'Normalization failed to yield to queued cancellation');
  assert.equal(aborted.diagnostics[0]?.code, 'aborted');
  assert.equal('value' in aborted, false, 'Cancelled load published partial data');
  assert.equal(completedProgress, false, 'Cancelled load reported complete normalization');
  const abortMs = performance.now() - abortStarted;

  const loadStarted = performance.now();
  const loaded = await loadBosModel(buffer, ref, { sourceUp: 'Z' });
  assert.equal(loaded.ok, true, JSON.stringify(loaded.diagnostics));
  const loadMs = performance.now() - loadStarted;
  const { model, bindings } = loaded.value;
  assert.deepEqual(model.ref, ref);
  assert.deepEqual(model.coordinates, { units: 'unknown', up: 'Y', registration: 'unknown' });
  assert.equal(model.objects.length, 51139); assert.equal(bindings.length, 456598);
  const identity = [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1];
  const objects = new Set();
  for (const object of model.objects) {
    assert.equal(object.ref.modelId, ref.id);
    assert.match(object.ref.objectId, /^bos:\d+$/);
    assert.equal(objects.has(object.ref.objectId), false, 'Duplicate logical identity'); objects.add(object.ref.objectId);
    const row = Number(object.ref.objectId.slice(4));
    assert.ok(row >= 0 && row < sourceIds.length);
    assert.equal(object.sourceId, sourceIds[row] > 0 ? String(sourceIds[row]) : undefined, 'Source LocalId mapping changed');
    assert.deepEqual(object.transform, identity);
    assert.deepEqual(object.appearance, { color: [1,1,1], opacity: 1, visible: true });
  }
  const groups = new Map(), represented = new Set();
  for (const binding of bindings) {
    assert.equal(binding.ref.modelId, ref.id); assert.ok(objects.has(binding.ref.objectId)); represented.add(binding.ref.objectId);
    let entry = groups.get(binding.group);
    if (!entry) {
      entry = { index: groups.size, seen: new Uint8Array(binding.group.instanceCount), transforms: binding.group.transforms, colors: binding.group.colors };
      groups.set(binding.group, entry);
    }
    const index = binding.instanceIndex;
    assert.ok(Number.isInteger(index) && index >= 0 && index < entry.seen.length);
    assert.equal(entry.seen[index], 0, 'Multiple bindings address one representation'); entry.seen[index] = 1;
    assert.equal(binding.representationId, `bos:${entry.index}:${index}`);
    assert.equal(binding.localTransform?.length, 16);
    assert.ok(binding.localTransform.every((value, axis) => Number.isFinite(value) && Math.fround(value) === entry.transforms[index * 16 + axis]));
    assert.equal(binding.colorFactor?.length, 4);
    assert.ok(binding.colorFactor.every((value, axis) => Number.isFinite(value) && value >= 0 && value <= 1 && value === entry.colors[index * 4 + axis]));
  }
  assert.equal(groups.size, 158055);
  const meshes = new Set(); let bounds = null, triangles = 0;
  for (const [group, entry] of groups) {
    assert.ok(entry.seen.every(value => value === 1), 'Unbound representation');
    assert.equal(group.material.opacity, 1, 'Source alpha would be applied more than once');
    assert.ok(group.transforms.every(Number.isFinite)); assert.ok(group.colors.every(Number.isFinite));
    if (!meshes.has(group.mesh)) {
      meshes.add(group.mesh); assert.ok(group.mesh.positions.every(Number.isFinite));
      if (group.mesh.normals) assert.ok(group.mesh.normals.every(Number.isFinite));
      if (group.mesh.indices) assert.ok(group.mesh.indices.every(index => index >= 0 && index < group.mesh.positions.length / 3), 'Mesh index out of range');
    }
    triangles += (group.mesh.indices?.length ?? group.mesh.positions.length / 3) / 3 * group.instanceCount;
    bounds = unionBounds(bounds, groupBounds(group));
  }
  assert.equal(triangles, 6185680); assert.ok(bounds);
  const expected = { min: [-244.280197, -58.666599, -195.444504], max: [240.934296, 85.069901, 274.774181] };
  for (const side of ['min', 'max']) for (let axis = 0; axis < 3; axis++) assert.ok(Math.abs(bounds[side][axis] - expected[side][axis]) < 0.01, 'Normalized Y-up bounds changed');
  return {
    sha256: hash, bytes: bytes.byteLength,
    counts: { objects: objects.size, objectsWithoutBindings: objects.size - represented.size, bindings: bindings.length, groups: groups.size, triangles },
    bounds, cancellation: 'queued abort observed; no partial value or completed progress',
    timingMs: { abortedLoad: abortMs, normalizedLoad: loadMs, completeGate: performance.now() - started },
    environment: { os: `${platform()} ${release()}`, cpu: cpus()[0]?.model, node: process.version },
    protocol: 'Explicit private-fixture gate: one baseline ID parse, one cancelled load, one complete normalized load. CPU verification only; no GPU/display timing.',
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log(JSON.stringify(await checkNormalizedSnowdon(process.argv[2] ?? process.env.BIM_SNOWDON_FIXTURE), null, 2));
}
