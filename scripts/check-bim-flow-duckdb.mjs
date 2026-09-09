import assert from 'node:assert/strict';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { chromium } from '../viewer/node_modules/playwright-core/index.mjs';

const base = process.env.BOF_DUCKDB_URL ?? 'http://127.0.0.1:5308';
const workflows = JSON.parse(await readFile('samples/duckdb-analyses/workflows.json', 'utf8'));
const database = process.env.BOF_DUCKDB ?? 'artifacts/building-model-workflows/snowdon-cli.duckdb';
const hash = async () => createHash('sha256').update(await readFile(database)).digest('hex');
const before = await hash();
const output = resolve('artifacts/bim-flow-duckdb/browser');
await mkdir(output, { recursive: true });
async function json(path) {
  const response = await fetch(base + path);
  assert.ok(response.ok, `${path}: ${response.status} ${await (!response.ok ? response.text() : '')}`);
  return response.json();
}
const result = workflow => json(`/api/analyses/${workflow.id}/results/${workflow.result}/table`);
const rows = new Map();
const scenarios = [];
for (const workflow of workflows) {
  const state = await json(`/api/analyses/${workflow.id}/state`);
  assert.equal(state.nodes.length, workflow.graph.structure.nodes.length);
  assert.ok(state.nodes.every(node => node.status === 'Ok'), JSON.stringify(state));
  const table = await result(workflow);
  assert.ok(table.totalRows > 0, workflow.id);
  rows.set(workflow.id, table);
}
const doors = rows.get('duckdb-door-schedule');
const rooms = rows.get('duckdb-room-schedule');
assert.equal(doors.totalRows, 142);
assert.equal(rooms.totalRows, 290);
const widthColumn = doors.columns.findIndex(column => column.name === 'Width_m');
assert.ok(doors.rows.every(row => row[widthColumn] === null));
assert.equal(rows.get('duckdb-missing-widths').totalRows, doors.totalRows);
assert.equal(rows.get('duckdb-room-distribution').rows.reduce((total, row) => total + row[1], 0), rooms.totalRows);
const roofs = rows.get('duckdb-roof-coverage');
assert.equal(roofs.rows[0][roofs.columns.findIndex(column => column.name === 'Roofs')], 26);
assert.equal(roofs.rows[0][roofs.columns.findIndex(column => column.name === 'KnownArea_m2')], null);
scenarios.push('All 48 nodes across nine source-backed graphs evaluate successfully', 'Schedule counts, room grouping totals and missing quantity semantics verified');

const endpoint = '/api/analyses/duckdb-door-types';
const original = await (await fetch(base + endpoint)).text();
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const errors = [];
try {
  const page = await browser.newPage({ viewport: { width: 1680, height: 1100 } });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(base + '/duckdb.html');
  await page.locator('#duck-editor tbody tr').first().waitFor();
  const graph = await page.locator('.bof-app-canvas-host canvas').boundingBox();
  const table = await page.locator('.bof-app-panearea').boundingBox();
  assert.ok(graph.x < table.x && graph.width > 500 && table.width > 500);
  assert.ok(graph.height > 450 && graph.height < 1100, `Graph must stay inside the viewport: ${graph.height}`);
  assert.ok(await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight + 2), 'The workspace must scroll its table, not stretch the whole page');
  assert.equal(await page.getByLabel('Preview node').inputValue(), workflows[0].result);
  await page.waitForTimeout(1800); // Let the graph's entrance animation settle before visual capture.
  await page.screenshot({ path: resolve(output, 'door-schedule.png'), fullPage: true });
  for (const workflow of workflows) {
    await page.getByLabel('Open flow').selectOption({ label: workflow.title });
    await page.waitForFunction(id => document.querySelector('select[aria-label="Open flow"]')?.value === id, workflow.id);
    await page.waitForFunction(id => document.querySelector('select[aria-label="Preview node"]')?.value === id, workflow.result);
    await page.locator('#duck-editor tbody tr').first().waitFor();
    assert.equal(await page.locator('.bof-app-tab').count(), 0);
    const document = await json(`/api/analyses/${workflow.id}`);
    const sources = document.structure.nodes.filter(node => node.kind === 'duck.source');
    assert.equal(sources.length, 1);
    for (const query of document.structure.nodes.filter(node => node.kind === 'duck.query')) {
      assert.equal(document.values[query.id].path, undefined);
      assert.ok(document.structure.edges.some(edge => edge.from === sources[0].id + '.source' && edge.to === query.id + '.source'));
    }
  }
  scenarios.push('The flow picker opens all nine editable graphs with a result table on the right');
  await page.getByLabel('Open flow').selectOption({ label: 'Most-used door types' });
  await page.getByLabel('answer count', { exact: true }).fill('3');
  const saved = page.waitForResponse(response => response.url() === base + endpoint && response.request().method() === 'PUT' && response.ok());
  await page.getByLabel('answer count', { exact: true }).press('Enter');
  await saved;
  await page.waitForFunction(() => document.querySelectorAll('#duck-editor tbody tr').length === 3);
  assert.equal((await result(workflows[1])).totalRows, 3);
  await page.waitForTimeout(1800); // Let the graph's entrance animation settle before visual capture.
  await page.screenshot({ path: resolve(output, 'edited-top-three.png'), fullPage: true });
  scenarios.push('Editing the limit on the graph autosaves and recomputes the table to three rows');
  await page.getByLabel('Preview node').selectOption('doors');
  await page.waitForFunction(() => document.querySelectorAll('#duck-editor tbody tr').length === 142);
  scenarios.push('Selecting an upstream node shows its 142 input records');
  const sort = page.getByLabel('rank-types A', { exact: true });
  await sort.waitFor();
  await page.waitForFunction(() => !document.querySelector('select[aria-label="rank-types A"]')?.disabled);
  assert.ok((await sort.locator('option').allTextContents()).includes('Doors'));
  for (const key of ['B', 'C']) assert.equal(await page.getByLabel('rank-types ' + key, { exact: true }).count(), 1);
  // Change the upstream output schema without reopening the flow.
  await page.getByLabel('count-types aggregates', { exact: true }).fill('count(*) as Occurrences');
  await page.getByLabel('count-types aggregates', { exact: true }).press('Enter');
  await page.waitForFunction(() => Array.from(document.querySelector('select[aria-label="rank-types A"]')?.options ?? []).some(option => option.value === 'Occurrences'));
  assert.ok((await sort.locator('option').allTextContents()).includes('Doors (unavailable)'));
  await sort.selectOption('Occurrences');
  await page.getByLabel('rank-types A direction', { exact: true }).click();
  await page.waitForFunction(async endpoint => {
    const graph = await (await fetch(endpoint)).json();
    return graph.values['rank-types'].A === 'Occurrences' && graph.values['rank-types'].descendingA === 'false';
  }, endpoint);
  scenarios.push('A/B/C sort dropdowns refresh after an upstream schema change; column and direction edits save');
  await page.getByLabel('Open flow').selectOption({ label: 'Trace a width to evidence' });
  await page.waitForFunction(() => document.querySelectorAll('#duck-editor tbody tr').length === 156);
  await page.waitForTimeout(1800); // Let the graph's entrance animation settle before visual capture.
  await page.screenshot({ path: resolve(output, 'evidence-trace.png'), fullPage: true });
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download', exact: true }).click();
  assert.equal((await download).suggestedFilename(), 'duckdb-evidence-trace.dfg.json');
  scenarios.push('Current graph downloads as a reusable graph document');
  await page.setViewportSize({ width: 1000, height: 900 });
  await page.getByRole('button', { name: 'Fit graph', exact: true }).click();
  await page.waitForTimeout(1800); // Let the graph's entrance animation settle before visual capture.
  await page.screenshot({ path: resolve(output, 'compact-layout.png'), fullPage: true });
  const offline = await browser.newPage();
  await offline.route('**/api/analyses', route => route.fulfill({ status: 503, body: 'Unavailable' }));
  await offline.goto(base + '/duckdb.html');
  await offline.getByRole('alert').waitFor();
  assert.match(await offline.getByRole('alert').textContent(), /Could not open the DuckDB demo/);
  scenarios.push('Unavailable host displays a visible startup error');
  assert.deepEqual(errors, []);
  assert.equal(await hash(), before, 'The database is unchanged after querying and editing graphs');
  await writeFile(resolve(output, 'evidence.json'), JSON.stringify({ databaseSha256: before, browser: browser.version(), workflows: [...rows].map(([id, table]) => ({ id, rows: table.totalRows })), scenarios }, null, 2));
  console.log(JSON.stringify({ scenarios }, null, 2));
} finally {
  await browser.close();
  const restored = await fetch(base + endpoint, { method: 'PUT', headers: { 'content-type': 'application/json' }, body: original });
  assert.ok(restored.ok, 'Restore the original graph after the edit test');
}
