// Replays, over the real MCP stdio transport, the tool calls an agent makes when
// asked in plain language for a door schedule. Proves the server end to end
// without a language model, and leaves the graph in the demo store so it shows
// up in the DuckDB workflow studio. Run after duckdb:prepare and duckdb:mcp-build.
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { existsSync, rmSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dll = resolve(process.env.BOF_MCP_DLL ?? resolve(root, 'artifacts/bim-flow-duckdb/mcp/bimopenflow-mcp.dll'));
const store = resolve(process.env.BOF_DUCKDB_STORE ?? resolve(root, 'artifacts/bim-flow-duckdb/store'));
const cache = resolve(root, 'artifacts/bim-flow-duckdb/cache');
const models = resolve(process.env.BOF_DUCKDB_MODELS ?? resolve(root, 'artifacts/building-model-workflows'));
const databaseName = process.env.BOF_DUCKDB ? basename(process.env.BOF_DUCKDB) : 'snowdon-cli.duckdb';
const id = process.env.BOF_MCP_ANALYSIS ?? 'agent-door-schedule';

const PROMPT = 'Using the Snowdon database, build me a door schedule: every door with its mark, '
  + 'type and storey name, plus the width in metres and why it is missing when it is. '
  + 'Sort by storey, then mark.';

if (!existsSync(dll)) fail(`MCP server not built: ${dll}. Run: npm run duckdb:mcp-build --prefix bimopenflow/web`);
if (!existsSync(store)) fail(`Demo store missing: ${store}. Run: npm run duckdb:prepare --prefix bimopenflow/web`);

// "From scratch": the demo store is disposable, so an earlier run's graph goes away.
const analysisDir = resolve(store, id);
if (existsSync(analysisDir)) {
  rmSync(analysisDir, { recursive: true, force: true });
  console.log(`(removed previous ${id} from the demo store)\n`);
}

const server = spawn('dotnet', [dll, '--profile', 'tables', '--store', store, '--cache', cache, '--models', models],
  { cwd: root, stdio: ['pipe', 'pipe', 'pipe'] });
server.stderr.on('data', chunk => process.stderr.write(`[server] ${chunk}`));
const lines = createInterface({ input: server.stdout });
const pending = new Map();
lines.on('line', line => {
  let message;
  try { message = JSON.parse(line); } catch { return; }
  const waiter = pending.get(message.id);
  if (!waiter) return;
  pending.delete(message.id);
  message.error ? waiter.reject(new Error(`${message.error.code}: ${message.error.message}`)) : waiter.resolve(message.result);
});

let nextId = 1;
function rpc(method, params = {}) {
  const idNumber = nextId++;
  return new Promise((resolveResult, reject) => {
    pending.set(idNumber, { resolve: resolveResult, reject });
    server.stdin.write(JSON.stringify({ jsonrpc: '2.0', id: idNumber, method, params }) + '\n');
  });
}

async function call(name, args = {}) {
  const shown = Object.entries(args).map(([k, v]) => `${k}=${JSON.stringify(v)}`).join(', ');
  const result = await rpc('tools/call', { name, arguments: args });
  const envelope = JSON.parse(result.content[0].text);
  if (!envelope.ok) throw new Error(`${name}(${shown}) failed: ${envelope.error}`);
  console.log(`  → ${name}(${shown})`);
  return envelope.data;
}

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function expect(condition, message) {
  if (!condition) fail(message);
}

let failed = false;
try {
  const init = await rpc('initialize');
  console.log(`Connected to ${init.serverInfo.name} ${init.serverInfo.version} over stdio.`);
  const { tools } = await rpc('tools/list');
  console.log(`Tools: ${tools.map(t => t.name).join(', ')}\n`);
  for (const name of ['listDatabases', 'describeDatabase', 'addNode', 'connect', 'setParam', 'evaluate', 'getResult'])
    expect(tools.some(t => t.name === name), `tool ${name} is not registered`);

  console.log(`User: "${PROMPT}"\n`);

  console.log('Agent: first, what databases and tables are there?');
  const databases = await call('listDatabases');
  const database = databases.find(d => d.name === databaseName);
  expect(database, `${databaseName} not found under ${models}; found ${databases.map(d => d.name).join(', ') || 'nothing'}`);
  const schema = await call('describeDatabase', { path: database.path });
  const door = schema.tables.find(t => t.name === 'door');
  const storey = schema.tables.find(t => t.name === 'storey');
  expect(door && storey, 'expected door and storey tables');
  const columns = door.columns;
  for (const name of ['element_mark', 'element_name', 'element_location_primary_storey', 'nominal_width', 'nominal_width_reason'])
    expect(columns.includes(name), `door table has no ${name} column`);
  console.log(`    ${schema.tables.length} tables; door has ${door.rowCount} rows and ${door.columns.length} columns`);
  const doorDetail = await call('describeDatabase', { path: database.path, table: 'door' });
  const width = doorDetail.tables[0].columns.find(c => c.name === 'nominal_width');
  expect(width?.type, 'describeDatabase with table should give column types');
  console.log(`    door.nominal_width is ${width.type}\n`);

  console.log(`Agent: building the graph "${id}" node by node.`);
  await call('addNode', { id, nodeId: 'database', kind: 'duck.source' });
  await call('setParam', { id, nodeId: 'database', name: 'path', value: database.path });
  await call('addNode', { id, nodeId: 'doors', kind: 'duck.query' });
  await call('setParam', { id, nodeId: 'doors', name: 'sql', value:
    'SELECT element_mark AS Mark, element_name AS DoorType, element_location_primary_storey AS StoreyKey, '
    + 'nominal_width AS Width_m, nominal_width_reason AS WidthStatus FROM door' });
  await call('addNode', { id, nodeId: 'levels', kind: 'duck.query' });
  await call('setParam', { id, nodeId: 'levels', name: 'sql', value: 'SELECT id AS StoreyKey, element_name AS Storey FROM storey' });
  await call('addNode', { id, nodeId: 'attach-level', kind: 'table.join' });
  await call('setParam', { id, nodeId: 'attach-level', name: 'aKey', value: 'StoreyKey' });
  await call('setParam', { id, nodeId: 'attach-level', name: 'bKey', value: 'StoreyKey' });
  await call('setParam', { id, nodeId: 'attach-level', name: 'mode', value: 'left' });
  await call('addNode', { id, nodeId: 'schedule-fields', kind: 'table.project' });
  await call('setParam', { id, nodeId: 'schedule-fields', name: 'columns', value: 'Mark, DoorType, Storey, Width_m, WidthStatus' });
  await call('addNode', { id, nodeId: 'answer', kind: 'table.sort' });
  await call('setParam', { id, nodeId: 'answer', name: 'A', value: 'Storey' });
  await call('setParam', { id, nodeId: 'answer', name: 'B', value: 'Mark' });
  await call('connect', { id, from: 'database.source', to: 'doors.source' });
  await call('connect', { id, from: 'database.source', to: 'levels.source' });
  await call('connect', { id, from: 'doors.table', to: 'attach-level.a' });
  await call('connect', { id, from: 'levels.table', to: 'attach-level.b' });
  await call('connect', { id, from: 'attach-level.table', to: 'schedule-fields.table' });
  const saved = await call('connect', { id, from: 'schedule-fields.table', to: 'answer.table' });
  console.log(`    graph hash ${saved.graphHash}\n`);

  console.log('Agent: evaluating and reading the answer.');
  const evaluation = await call('evaluate', { id });
  for (const node of evaluation.nodes)
    expect(node.status === 'Ok', `node ${node.nodeId} is ${node.status}: ${node.error ?? ''}`);
  console.log(`    ${evaluation.nodes.length} nodes Ok`);
  const answer = await call('getResult', { id, nodeId: 'answer', port: 'table', take: 5 });
  console.log(`    ${answer.totalRows} rows; columns ${answer.columns.map(c => c.name).join(', ')}`);
  for (const row of answer.rows) console.log(`    ${row.map(v => v ?? 'NULL').join(' | ')}`);
  expect(answer.columns.map(c => c.name).join(',') === 'Mark,DoorType,Storey,Width_m,WidthStatus', 'unexpected answer columns');
  if (databaseName === 'snowdon-cli.duckdb') expect(answer.totalRows === 142, `expected 142 doors, got ${answer.totalRows}`);

  const listed = await call('listAnalyses');
  expect(listed.some(a => a.id === id), `${id} is not in the store listing`);
  console.log(`\nOK: "${id}" is in ${store}; open the DuckDB workflow studio and pick it from the flow list.`);
} catch (error) {
  failed = true;
  console.error(`FAIL: ${error.message}`);
} finally {
  server.stdin.end();
  await new Promise(done => server.once('exit', done));
}
process.exit(failed ? 1 : 0);
