// Seeds the DuckDB demo store (artifacts/bim-flow-duckdb/store) with every graph of
// samples/duckdb-analyses/workflows.json, pointing each at its database:
//
//   {PUBLIC_DUCKDB}  graphs with "database": "public", over bim-open-data's public
//                    Schependomlaan export (deps/bim-open-data/samples/public), present
//                    in every checkout after `node deps.mjs`; override with BOF_PUBLIC_DUCKDB
//   {DUCKDB}         graphs with "database": "snowdon", over the private typed Snowdon
//                    export (argv[2] or artifacts/building-model-workflows/snowdon-cli.duckdb);
//                    skipped, with a note, when that file is absent
//
//   node scripts/prepare-bim-flow-duckdb.mjs [snowdon.duckdb] [store]
import { readFile, access } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedFlows } from './seed-store.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// deps.mjs's rule: the siblings when the parent folder is a deps root, else deps/.
const depsDir = existsSync(join(root, '..', '.deps-root')) ? join(root, '..') : join(root, 'deps');
export const PUBLIC_DUCKDB = join(depsDir, 'bim-open-data', 'samples', 'public', 'schependomlaan.duckdb');

const snowdon = resolve(process.argv[2] ?? resolve(root, 'artifacts/building-model-workflows/snowdon-cli.duckdb'));
const publicDb = resolve(process.env.BOF_PUBLIC_DUCKDB ?? PUBLIC_DUCKDB);
const store = resolve(process.argv[3] ?? resolve(root, 'artifacts/bim-flow-duckdb/store'));
await access(publicDb);
const hasSnowdon = existsSync(snowdon);
const databases = { public: publicDb, snowdon: hasSnowdon ? snowdon : undefined };
const placeholders = { '{PUBLIC_DUCKDB}': 'public', '{DUCKDB}': 'snowdon' };

const workflows = JSON.parse(await readFile(resolve(root, 'samples/duckdb-analyses/workflows.json'), 'utf8'));
const flows = [];
const skipped = [];
for (const workflow of workflows) {
  const database = databases[workflow.database];
  if (!database) { skipped.push(workflow.id); continue; }
  const graph = structuredClone(workflow.graph);
  for (const values of Object.values(graph.values))
    if (placeholders[values.path] === workflow.database) values.path = database.replaceAll('\\', '/');
  flows.push({ id: workflow.id, graph });
}
// Untouched copies follow a changed sample or database; copies you edited are kept and named.
seedFlows(store, 'duckdb-analyses', flows);
console.log(`Public database: ${publicDb}\nSnowdon database: ${hasSnowdon ? snowdon : `${snowdon} (absent)`}\nStore: ${store}`);
if (skipped.length) console.log(`Skipped (need the Snowdon export): ${skipped.join(', ')}`);
