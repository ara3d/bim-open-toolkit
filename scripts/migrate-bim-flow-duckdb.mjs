import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { upgradeDuckDbGraph } from './duckdb-graph.mjs';

const base = process.env.BOF_DUCKDB_URL ?? 'http://127.0.0.1:5308';
const workflows = JSON.parse(await readFile('samples/duckdb-analyses/workflows.json', 'utf8'));
const backup = resolve('artifacts/bim-flow-duckdb/migrations', new Date().toISOString().replaceAll(':', '-'));
await mkdir(backup, { recursive: true });
for (const workflow of workflows) {
  const url = base + '/api/analyses/' + workflow.id;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${workflow.id}: ${response.status}`);
  const original = await response.text();
  const upgraded = upgradeDuckDbGraph(JSON.parse(original));
  await writeFile(resolve(backup, workflow.id + '.dfg.json'), original, { flag: 'wx' });
  const saved = await fetch(url, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify(upgraded) });
  if (!saved.ok) throw new Error(await saved.text());
  console.log(`Upgraded ${workflow.id}`);
}
console.log(`Original graphs preserved in ${backup}`);
