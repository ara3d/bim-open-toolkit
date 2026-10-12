// Seeds sample graphs into a BimOpenFlow analysis store by the rules of the host's
// SampleSeeding.Seed (deps/bim-open-flow/src/flow/BimOpenFlow.Host/SampleSeeding.cs, used by the studio's BimSampleSeeding), for the DuckDB
// studio's workflows, which scripts/prepare-bim-flow-duckdb.mjs seeds before any host runs:
//
//   - a flow the store lacks is written, unless the user deleted it and the sample is unchanged;
//   - a copy whose structure and values are still what was seeded is refreshed when the sample
//     changed, keeping the user's node positions, and the old copy is archived under versions/
//     as the store itself does; moving or resizing nodes is not an edit;
//   - a copy the user edited is kept, and the log says the sample changed.
//
// Every flow's {ARTIFACTS} becomes this checkout's artifacts folder, as the host's seeder
// does for every seeding source; the caller substitutes the source's own placeholder.
//
// What each copy was seeded from lives in <store>/.samples.json as { id: { source, graphSha256 } },
// shared with the host (SampleSeedRecord.cs), which keeps entries it does not own. The hash is of
// the structure and values after placeholder substitution, with object keys sorted, so a copy
// compares by content, not bytes, and never by layout. A record written before 2026-10-11 holds
// sha256, the hash of the whole graph with its layout; its copy is compared through the seeded
// graph found among the copy and its versions. A store prepared before the record existed has no
// entries, or an empty hash once a copy was kept: its oldest saved graph is taken as the seed;
// one in .trash stays deleted.
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rewritePlaceholder } from './duckdb-graph.mjs';

export const RECORD_FILE = '.samples.json';
const CURRENT = 'current.dfg.json';

/** Stands for ARTIFACTS_DIR in a sample graph: where a writer's Run puts its file. */
export const ARTIFACTS_PLACEHOLDER = '{ARTIFACTS}';
/** The git-ignored artifacts folder at the root of the checkout holding this script. */
export const ARTIFACTS_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'artifacts');

/** Object keys in sorted order at every depth, so equal graphs serialize identically. */
const sorted = (value) => Array.isArray(value) ? value.map(sorted)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, sorted(value[key])]))
    : value;

const sha256 = (value) => createHash('sha256').update(JSON.stringify(sorted(value))).digest('hex');

/** The hash the record keeps: structure and values only, so a moved node is no edit. */
export const hashGraph = (graph) => sha256({ structure: graph.structure, values: graph.values });

/** True when the record entry describes what graph holds; a legacy entry hashed the whole graph. */
const isSeedOf = (entry, graph) => 'graphSha256' in entry
  ? entry.graphSha256 === hashGraph(graph)
  : entry.sha256 === sha256(graph);

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

/** Writes via a temporary file and rename, so a reader never sees half a file. */
function writeAtomic(path, text) {
  writeFileSync(path + '.tmp', text);
  renameSync(path + '.tmp', path);
}

const versionNumbers = (dir) => existsSync(dir)
  ? readdirSync(dir).map((name) => /^(\d+)\.dfg\.json$/.exec(name)).filter(Boolean).map((m) => Number(m[1]))
  : [];

/** The analysis's archived versions, oldest first, then its current graph. */
const savedGraphs = (dir) => [
  ...versionNumbers(join(dir, 'versions')).sort((a, b) => a - b)
    .map((n) => readJson(join(dir, 'versions', `${String(n).padStart(4, '0')}.dfg.json`))),
  readJson(join(dir, CURRENT)),
];

/** True when the copy's structure and values are still those it was seeded with, whatever its layout. */
function isUntouched(dir, copy, entry) {
  const graph = hashGraph(copy);
  if (!entry || !(entry.graphSha256 ?? entry.sha256)) return hashGraph(savedGraphs(dir)[0]) === graph;
  if ('graphSha256' in entry) return entry.graphSha256 === graph;
  return savedGraphs(dir).some((saved) => isSeedOf(entry, saved) && hashGraph(saved) === graph);
}

/** The sample with the copy's position and size for every node both hold; a new node keeps the sample's. */
const withLayoutOf = (sample, copy) => {
  const layout = Object.fromEntries((sample.structure?.nodes ?? [])
    .map(({ id }) => [id, copy.layout?.[id] ?? sample.layout?.[id]])
    .filter(([, place]) => place));
  return Object.keys(layout).length > 0 ? { ...sample, layout } : sample;
};

/** Moves the current copy into versions/ under the next four-digit number, as AnalysisStore does. */
function archiveCurrent(dir) {
  const versions = join(dir, 'versions');
  mkdirSync(versions, { recursive: true });
  const next = Math.max(0, ...versionNumbers(versions)) + 1;
  copyFileSync(join(dir, CURRENT), join(versions, `${String(next).padStart(4, '0')}.dfg.json`));
}

/**
 * Seeds `flows` ([{ id, graph }], the source's placeholder already substituted; {ARTIFACTS} is
 * rewritten here) from the sample folder named `source` into `store`. Returns { seeded, refreshed, kept, unchanged } id lists; `log` receives
 * one line per flow.
 */
export function seedFlows(store, source, flows, log = console.log) {
  mkdirSync(store, { recursive: true });
  const recordPath = join(store, RECORD_FILE);
  const record = existsSync(recordPath) ? readJson(recordPath) : {};
  const result = { seeded: [], refreshed: [], kept: [], unchanged: [] };
  for (const { id, graph: sample } of flows) {
    const graph = rewritePlaceholder(sample, ARTIFACTS_PLACEHOLDER, ARTIFACTS_DIR);
    const dir = join(store, id);
    const current = join(dir, CURRENT);
    const hash = hashGraph(graph);
    const entry = record[id];
    const write = (written) => {
      mkdirSync(dir, { recursive: true });
      writeAtomic(current, JSON.stringify(written, null, 2) + '\n');
      record[id] = { source, graphSha256: hash };
    };
    if (!existsSync(current)) {
      const deleted = entry ? isSeedOf(entry, graph) : existsSync(join(store, '.trash', id));
      if (deleted) { log(`Left deleted: ${id}`); result.unchanged.push(id); continue; }
      write(graph);
      log(`Prepared ${id}`);
      result.seeded.push(id);
      continue;
    }
    const copy = readJson(current);
    if (hashGraph(copy) === hash) {
      record[id] = { source, graphSha256: hash };
      log(`Up to date: ${id}`);
      result.unchanged.push(id);
    } else if (isUntouched(dir, copy, entry)) {
      archiveCurrent(dir);
      write(withLayoutOf(graph, copy));
      log(`Refreshed ${id}: the sample changed; the previous copy is in its versions/`);
      result.refreshed.push(id);
    } else {
      // An empty hash stands for "seeded from a version nobody recorded", so deleting the kept
      // copy lets the next run seed the new sample.
      record[id] = entry ?? { source, graphSha256: '' };
      log(`Kept your edited copy of ${id}: samples/${source} has changed since. `
        + 'To take the new sample, delete the analysis (it moves to .trash) and prepare again.');
      result.kept.push(id);
    }
  }
  writeAtomic(recordPath, JSON.stringify(sorted(record), null, 2) + '\n');
  return result;
}
