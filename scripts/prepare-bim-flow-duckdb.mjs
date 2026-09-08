import { readFile, mkdir, writeFile, access } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const database = resolve(process.argv[2] ?? resolve(root, 'artifacts/building-model-workflows/snowdon-cli.duckdb'));
const store = resolve(process.argv[3] ?? resolve(root, 'artifacts/bim-flow-duckdb/store'));
await access(database);
const workflows = JSON.parse(await readFile(resolve(root, 'samples/duckdb-analyses/workflows.json'), 'utf8'));
for (const workflow of workflows) {
  const graph = structuredClone(workflow.graph);
  for (const values of Object.values(graph.values))
    if (values.path === '{DUCKDB}') values.path = database.replaceAll('\\', '/');
  const directory = resolve(store, workflow.id);
  await mkdir(directory, { recursive: true });
  try {
    await writeFile(resolve(directory, 'current.dfg.json'), JSON.stringify(graph, null, 2) + '\n', { flag: 'wx' });
    console.log(`Prepared ${workflow.id}`);
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
    console.log(`Preserved existing edits: ${workflow.id}`);
  }
}
console.log(`Database: ${database}\nStore: ${store}`);
