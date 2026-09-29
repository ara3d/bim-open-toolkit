import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { RECORD_FILE, hashGraph, seedFlows } from './seed-store.mjs';

const graph = (path) => ({ structure: { nodes: [{ id: 'src', kind: 'duck.source', version: 1 }], edges: [] }, values: { src: { path } } });
const flow = (id, path) => ({ id, graph: graph(path) });
const quiet = () => {};

function withStore(body) {
  const store = mkdtempSync(join(tmpdir(), 'bof-seed-store-'));
  try { body(store); } finally { rmSync(store, { recursive: true, force: true }); }
}
const current = (store, id) => JSON.parse(readFileSync(join(store, id, 'current.dfg.json'), 'utf8'));
const record = (store) => JSON.parse(readFileSync(join(store, RECORD_FILE), 'utf8'));
/** An edit as the host makes one: archive the current copy, write the new one. */
function edit(store, id, path) {
  mkdirSync(join(store, id, 'versions'), { recursive: true });
  writeFileSync(join(store, id, 'versions', '0001.dfg.json'), readFileSync(join(store, id, 'current.dfg.json')));
  writeFileSync(join(store, id, 'current.dfg.json'), JSON.stringify(graph(path)));
}

test('a fresh store is seeded and the record holds each graph hash', () => withStore((store) => {
  const result = seedFlows(store, 'duckdb-analyses', [flow('doors', 'C:/a.duckdb')], quiet);
  assert.deepEqual(result.seeded, ['doors']);
  assert.deepEqual(current(store, 'doors'), graph('C:/a.duckdb'));
  assert.deepEqual(record(store).doors, { source: 'duckdb-analyses', sha256: hashGraph(graph('C:/a.duckdb')) });
}));

test('a changed sample refreshes an untouched copy and archives the old one', () => withStore((store) => {
  seedFlows(store, 'duckdb-analyses', [flow('doors', 'C:/a.duckdb')], quiet);
  const lines = [];
  const result = seedFlows(store, 'duckdb-analyses', [flow('doors', 'C:/b.duckdb')], (line) => lines.push(line));
  assert.deepEqual(result.refreshed, ['doors']);
  assert.equal(current(store, 'doors').values.src.path, 'C:/b.duckdb');
  assert.deepEqual(readdirSync(join(store, 'doors', 'versions')), ['0001.dfg.json']);
  assert.match(lines.join('\n'), /Refreshed doors/);
}));

test('a changed sample keeps an edited copy and says so', () => withStore((store) => {
  seedFlows(store, 'duckdb-analyses', [flow('doors', 'C:/a.duckdb')], quiet);
  edit(store, 'doors', 'C:/mine.duckdb');
  const lines = [];
  const result = seedFlows(store, 'duckdb-analyses', [flow('doors', 'C:/b.duckdb')], (line) => lines.push(line));
  assert.deepEqual(result.kept, ['doors']);
  assert.equal(current(store, 'doors').values.src.path, 'C:/mine.duckdb');
  assert.match(lines.join('\n'), /Kept your edited copy of doors/);
}));

test('the placeholder path is hashed after substitution, so the same database is no change', () => withStore((store) => {
  // A seeded copy never equals the sample file byte for byte ({DUCKDB} became a local path),
  // yet preparing again with the same database and a re-serialized copy changes nothing.
  seedFlows(store, 'duckdb-analyses', [flow('doors', 'C:/a.duckdb')], quiet);
  writeFileSync(join(store, 'doors', 'current.dfg.json'), JSON.stringify(current(store, 'doors')));
  const result = seedFlows(store, 'duckdb-analyses', [flow('doors', 'C:/a.duckdb')], quiet);
  assert.deepEqual(result.unchanged, ['doors']);
  assert.equal(existsSync(join(store, 'doors', 'versions')), false);
}));

test('a deleted copy stays deleted until its sample changes', () => withStore((store) => {
  seedFlows(store, 'duckdb-analyses', [flow('doors', 'C:/a.duckdb')], quiet);
  mkdirSync(join(store, '.trash'));
  renameSync(join(store, 'doors'), join(store, '.trash', 'doors'));
  assert.deepEqual(seedFlows(store, 'duckdb-analyses', [flow('doors', 'C:/a.duckdb')], quiet).seeded, []);
  assert.deepEqual(seedFlows(store, 'duckdb-analyses', [flow('doors', 'C:/b.duckdb')], quiet).seeded, ['doors']);
}));

test('a store prepared before the record: unedited copies refresh, edited ones are kept', () => withStore((store) => {
  for (const id of ['doors', 'rooms']) {
    mkdirSync(join(store, id));
    writeFileSync(join(store, id, 'current.dfg.json'), JSON.stringify(graph('C:/old.duckdb'), null, 2));
  }
  edit(store, 'rooms', 'C:/mine.duckdb');
  const result = seedFlows(store, 'duckdb-analyses', [flow('doors', 'C:/new.duckdb'), flow('rooms', 'C:/new.duckdb')], quiet);
  assert.deepEqual(result.refreshed, ['doors']);
  assert.deepEqual(result.kept, ['rooms']);
  assert.equal(record(store).rooms.sha256, '');
}));

test('entries the host wrote are kept', () => withStore((store) => {
  writeFileSync(join(store, RECORD_FILE), JSON.stringify({ walls: { source: 'analyses', sha256: 'abc' } }));
  seedFlows(store, 'duckdb-analyses', [flow('doors', 'C:/a.duckdb')], quiet);
  assert.deepEqual(record(store).walls, { source: 'analyses', sha256: 'abc' });
}));
