// Seeds sample graphs into a BimOpenFlow analysis store by the rules of the host's
// SampleSeeding.Seed (src/flow/BimOpenFlow.Host/SampleSeeding.cs, used by the studio's BimSampleSeeding), for the DuckDB
// studio's workflows, which scripts/prepare-bim-flow-duckdb.mjs seeds before any host runs:
//
//   - a flow the store lacks is written, unless the user deleted it and the sample is unchanged;
//   - a copy still identical to what was seeded is refreshed when the sample changed, and the
//     old copy is archived under versions/ as the store itself does;
//   - a copy the user edited is kept, and the log says the sample changed.
//
// What each copy was seeded from lives in <store>/.samples.json as { id: { source, sha256 } },
// shared with the host, which keeps entries it does not own. The hash is of the graph after
// placeholder substitution, with object keys sorted, so a copy compares by content, not bytes.
// A store prepared before the record existed has no entries: a copy with no saved versions was
// never edited and is refreshed, one with versions is kept, one in .trash stays deleted.
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const RECORD_FILE = '.samples.json';
const CURRENT = 'current.dfg.json';

/** Object keys in sorted order at every depth, so equal graphs serialize identically. */
const sorted = (value) => Array.isArray(value) ? value.map(sorted)
  : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map((key) => [key, sorted(value[key])]))
    : value;

export const hashGraph = (graph) => createHash('sha256').update(JSON.stringify(sorted(graph))).digest('hex');

const readJson = (path) => JSON.parse(readFileSync(path, 'utf8'));

/** Writes via a temporary file and rename, so a reader never sees half a file. */
function writeAtomic(path, text) {
  writeFileSync(path + '.tmp', text);
  renameSync(path + '.tmp', path);
}

const versionNumbers = (dir) => existsSync(dir)
  ? readdirSync(dir).map((name) => /^(\d+)\.dfg\.json$/.exec(name)).filter(Boolean).map((m) => Number(m[1]))
  : [];

/** Moves the current copy into versions/ under the next four-digit number, as AnalysisStore does. */
function archiveCurrent(dir) {
  const versions = join(dir, 'versions');
  mkdirSync(versions, { recursive: true });
  const next = Math.max(0, ...versionNumbers(versions)) + 1;
  copyFileSync(join(dir, CURRENT), join(versions, `${String(next).padStart(4, '0')}.dfg.json`));
}

/**
 * Seeds `flows` ([{ id, graph }], placeholders already substituted) from the sample folder named
 * `source` into `store`. Returns { seeded, refreshed, kept, unchanged } id lists; `log` receives
 * one line per flow.
 */
export function seedFlows(store, source, flows, log = console.log) {
  mkdirSync(store, { recursive: true });
  const recordPath = join(store, RECORD_FILE);
  const record = existsSync(recordPath) ? readJson(recordPath) : {};
  const result = { seeded: [], refreshed: [], kept: [], unchanged: [] };
  for (const { id, graph } of flows) {
    const dir = join(store, id);
    const current = join(dir, CURRENT);
    const hash = hashGraph(graph);
    const entry = record[id];
    const write = () => {
      mkdirSync(dir, { recursive: true });
      writeAtomic(current, JSON.stringify(graph, null, 2) + '\n');
      record[id] = { source, sha256: hash };
    };
    if (!existsSync(current)) {
      const deleted = entry ? entry.sha256 === hash : existsSync(join(store, '.trash', id));
      if (deleted) { log(`Left deleted: ${id}`); result.unchanged.push(id); continue; }
      write();
      log(`Prepared ${id}`);
      result.seeded.push(id);
      continue;
    }
    const currentHash = hashGraph(readJson(current));
    if (currentHash === hash) {
      record[id] = { source, sha256: hash };
      log(`Up to date: ${id}`);
      result.unchanged.push(id);
    } else if (entry ? currentHash === entry.sha256 : versionNumbers(join(dir, 'versions')).length === 0) {
      archiveCurrent(dir);
      write();
      log(`Refreshed ${id}: the sample changed; the previous copy is in its versions/`);
      result.refreshed.push(id);
    } else {
      // An empty hash stands for "seeded from a version nobody recorded", so deleting the kept
      // copy lets the next run seed the new sample.
      record[id] = entry ?? { source, sha256: '' };
      log(`Kept your edited copy of ${id}: samples/${source} has changed since. `
        + 'To take the new sample, delete the analysis (it moves to .trash) and prepare again.');
      result.kept.push(id);
    }
  }
  writeAtomic(recordPath, JSON.stringify(sorted(record), null, 2) + '\n');
  return result;
}
