// Replays, over the IFC MCP server's real stdio transport, the tool calls an agent
// makes to answer four of the NRC paper's questions about an analytics-enriched IFC
// model, checks the numbers against the paper's expected answers, and writes the
// session as a Markdown transcript. Proves the MCP connection end to end with no
// language model in the loop.
//
//   node scripts/demo-ifc-mcp.mjs [--model samples/nrc/duplex-enriched.ifc] [--dll <bimopenmcp-ifc.dll>] [--out <transcript.md>]
//
// Build the server first: dotnet build src/mcp/BimOpenMcp.Ifc -o artifacts/bim-flow-ifc/mcp
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { root } from "./bim-flow-processes.mjs";

const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : fallback;
};
const dll = resolve(root, arg("--dll", process.env.BOF_IFC_MCP_DLL ?? "artifacts/bim-flow-ifc/mcp/bimopenmcp-ifc.dll"));
const model = resolve(root, arg("--model", "samples/nrc/duplex-enriched.ifc")).replaceAll("\\", "/");
const out = resolve(root, arg("--out", "artifacts/bim-flow-ifc/transcript-replay.md"));

if (!existsSync(dll)) exit(`IFC MCP server not built: ${dll}. Run: dotnet build src/mcp/BimOpenMcp.Ifc -o artifacts/bim-flow-ifc/mcp`);
if (!existsSync(model)) exit(`Model not found: ${model}`);

function exit(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

// The paper's questions this replay answers, with the SQL the recorded session used and the
// expected values from nrc-ifc-llm/poc/results/expected_answers.json (copied into
// tests/flow/BimOpenFlow.NrcWorkflows.Tests as cited numbers).
const ELEMENTS = "e.Category NOT IN ('IFCBUILDING','IFCBUILDINGSTOREY','IFCPROJECT')";
const OC = "p.ParameterGroup='Pset_NRCOperationalCarbon' AND p.Name='OperationalCarbon_kgCO2e_per_year'";
const JOIN = "FROM ParameterText p JOIN EntityText e ON e.EntityIndex = p.EntityIndex";
const QUESTIONS = [
  {
    id: "Q1", question: "What is the total operational carbon for the building?",
    sql: `SELECT round(sum(CAST(p.Value AS DOUBLE)),1) AS total_kgCO2e_per_year, count(*) AS elements ${JOIN} WHERE ${OC} AND ${ELEMENTS}`,
    check: (rows) => near(cell(rows[0], "total_kgCO2e_per_year"), 37196.2) && Number(cell(rows[0], "elements")) === 218,
    expected: "37,196.2 kgCO2e/yr over 218 elements",
  },
  {
    id: "Q5", question: "How much operational carbon is in each category?",
    sql: `SELECT e.Category, round(sum(CAST(p.Value AS DOUBLE)),1) AS oc, count(*) AS n ${JOIN} WHERE ${OC} AND ${ELEMENTS} GROUP BY e.Category ORDER BY oc DESC`,
    check: (rows) => rows.length >= 9 && near(cell(rows[0], "oc"), 17547.4) && cell(rows[0], "Category") === "IFCWALLSTANDARDCASE",
    expected: "walls first at 17,547.4 (IFCWALLSTANDARDCASE), 14 IFC classes",
  },
  {
    id: "Q7", question: "What is the embodied carbon of the roof?",
    sql: "SELECT e.GlobalId, p.ParameterGroup, p.Name AS prop, p.Value FROM EntityText e LEFT JOIN ParameterText p ON p.EntityIndex=e.EntityIndex AND p.ParameterGroup LIKE 'Pset_NRC%' WHERE e.Category='IFCROOF' ORDER BY p.ParameterGroup, prop",
    check: (rows) => rows.length > 0 && rows.every((r) => cell(r, "ParameterGroup") !== "Pset_NRCEmbodiedCarbon"),
    expected: "not available: the roof carries no Pset_NRCEmbodiedCarbon set",
  },
  {
    id: "Q8", question: "What is the total embodied carbon (A1-A3) per storey?",
    sql: `SELECT e.Name AS storey, CAST(p.Value AS DOUBLE) AS a1a3 ${JOIN} WHERE e.Category='IFCBUILDINGSTOREY' AND p.ParameterGroup='Pset_NRCEmbodiedCarbon' AND p.Name='EmbodiedCarbon_A1A3_kgCO2e' ORDER BY a1a3 DESC`,
    check: (rows) => rows.length === 4 && cell(rows[0], "storey") === "Level 1" && near(cell(rows[0], "a1a3"), 49451.2) && near(cell(rows[1], "a1a3"), 48696.8),
    expected: "Level 1 49,451.2; Level 2 48,696.8; T/FDN 11,761.3; Roof 5,821.0",
  },
];

const near = (value, expected, tolerance = 0.06) => Math.abs(Number(value) - expected) <= tolerance;
let columns = [];
const cell = (row, name) => Array.isArray(row) ? row[columns.indexOf(name)] : row[name];

const server = spawn("dotnet", [dll], { cwd: root, stdio: ["pipe", "pipe", "pipe"] });
server.stderr.on("data", (chunk) => process.stderr.write(`[server] ${chunk}`));
const lines = createInterface({ input: server.stdout });
const pending = new Map();
lines.on("line", (line) => {
  let message;
  try { message = JSON.parse(line); } catch { return; }
  const waiter = pending.get(message.id);
  if (!waiter) return;
  pending.delete(message.id);
  message.error ? waiter.reject(new Error(`${message.error.code}: ${message.error.message}`)) : waiter.resolve(message.result);
});

let nextId = 1;
function rpc(method, params = {}) {
  const id = nextId++;
  return new Promise((resolveResult, reject) => {
    pending.set(id, { resolve: resolveResult, reject });
    server.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
  });
}

const transcript = [];
function note(text) { transcript.push(text, ""); }

async function call(name, args) {
  const started = Date.now();
  const result = await rpc("tools/call", { name, arguments: args });
  const envelope = JSON.parse(result.content[0].text);
  const shown = JSON.stringify(envelope, null, 1);
  transcript.push(`**Agent calls** \`${name}\` with`, "```json", JSON.stringify(args, null, 1), "```",
    `**Result** (${Date.now() - started} ms)`, "```json", shown.length > 3000 ? shown.slice(0, 3000) + `\n... (${shown.length} chars total)` : shown, "```", "");
  if (!envelope.ok) throw new Error(`${name} failed: ${envelope.error}`);
  return envelope.data;
}

function fail(message) {
  throw new Error(message);
}

const verdicts = [];
try {
  const init = await rpc("initialize", { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "demo-ifc-mcp", version: "0" } });
  console.log(`Connected to ${init.serverInfo.name} ${init.serverInfo.version} over stdio.`);
  const { tools } = await rpc("tools/list");
  console.log(`Tools: ${tools.length} (${tools.map((t) => t.name).slice(0, 6).join(", ")}, ...)`);
  for (const name of ["ifc_open", "ifc_spatial_tree", "ifc_table", "ifc_sql"])
    if (!tools.some((t) => t.name === name)) fail(`tool ${name} is not registered`);

  transcript.push(`# IFC MCP replay over ${model}`, "",
    `Server ${init.serverInfo.name} ${init.serverInfo.version} over stdio, ${tools.length} tools, ${new Date().toISOString()}.`,
    "Every call and its result are recorded verbatim; the SQL is the recorded session's. No language model is involved.", "");

  note("### Setup: open the model and list the query views");
  const opened = await call("ifc_open", { path: model });
  console.log(`Opened ${opened.schema}, ${opened.entityCount} entities.`);
  const tables = await call("ifc_table", { path: model, take: 50 });
  const names = (tables.items ?? []).map((t) => t.table);
  console.log(`Views: ${names.filter((n) => /Text|StoreyOf/.test(n)).join(", ")}`);
  for (const view of ["EntityText", "ParameterText", "RelationText", "StoreyOfEntity"])
    if (!names.includes(view)) fail(`view ${view} missing from ifc_table`);

  for (const q of QUESTIONS) {
    note(`### ${q.id}: ${q.question}`);
    console.log(`\n${q.id}: ${q.question}`);
    const result = await call("ifc_sql", { path: model, sql: q.sql, take: 50 });
    columns = (result.columns ?? []).map((c) => c.name ?? c);
    const rows = result.rows ?? [];
    const ok = q.check(rows);
    verdicts.push({ id: q.id, ok, rows: result.total ?? rows.length });
    console.log(`  ${rows.length} of ${result.total ?? rows.length} rows; expected ${q.expected}: ${ok ? "MATCH" : "MISMATCH"}`);
    note(`**Expected:** ${q.expected}\n\n**Verdict:** ${ok ? "match" : "MISMATCH"}`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  server.stdin.end();
  server.kill();
}

transcript.push("## Summary", "", "| Question | Rows | Verdict |", "|---|---|---|",
  ...verdicts.map((v) => `| ${v.id} | ${v.rows} | ${v.ok ? "match" : "mismatch"} |`), "");
await mkdir(dirname(out), { recursive: true });
await writeFile(out, transcript.join("\n"));
console.log(`\nTranscript: ${out}`);
if (verdicts.length !== QUESTIONS.length || verdicts.some((v) => !v.ok)) { console.error("IFC MCP REPLAY: FAIL"); process.exitCode = 1; }
else console.log("IFC MCP REPLAY: PASS");
