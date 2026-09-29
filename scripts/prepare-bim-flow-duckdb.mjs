import { readFile, access } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedFlows } from './seed-store.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const database = resolve(process.argv[2] ?? resolve(root, 'artifacts/building-model-workflows/snowdon-cli.duckdb'));
const store = resolve(process.argv[3] ?? resolve(root, 'artifacts/bim-flow-duckdb/store'));
await access(database);
const workflows = JSON.parse(await readFile(resolve(root, 'samples/duckdb-analyses/workflows.json'), 'utf8'));
const flows = workflows.map(workflow => {
  const graph = structuredClone(workflow.graph);
  for (const values of Object.values(graph.values))
    if (values.path === '{DUCKDB}') values.path = database.replaceAll('\\', '/');
  return { id: workflow.id, graph };
});
// Untouched copies follow a changed sample or database; copies you edited are kept and named.
seedFlows(store, 'duckdb-analyses', flows);
console.log(`Database: ${database}\nStore: ${store}`);
