// Headless end-to-end smoke (TKT-67): one studio host, one studio MCP server, and a fake
// Anthropic Messages API, all on isolated ports over a temp store. Against them it runs
//   1. a SQL query        (table.inline -> sql.query, read back through the result slice)
//   2. a write-back       (sink.writePsets stays EffectPending until POST runs writes the IFC copy)
//   3. an MCP intent      (addNode, setParam, evaluate over JSON-RPC; the host sees the graph)
//   4. an Ask request     (POST /api/ask against the fake model, which answers with tool calls)
// and prints "E2E SMOKE: PASS" or the first failure, exiting non-zero on any failure.
// Usage: node gates/e2e-smoke.mjs   (from the repo root; needs dotnet and a buildable studio)
import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const studio = join(root, "src", "studio", "BimOpenFlow.Studio");
const sampleIfc = join(root, "samples", "nrc", "duplex-base.ifc");
// A wall in duplex-base.ifc (STEP id #4131); writePsets addresses entities by STEP id.
const wallId = 4131;
const fakeKey = "e2e-fake-key";
const fakeModel = "e2e-fake-model";

const fail = (msg) => { throw new Error(msg); };
const expect = (cond, msg) => cond || fail(msg);
const randomPort = () => 5300 + Math.floor(Math.random() * 2000);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const getJson = async (url) => {
  const res = await fetch(url);
  if (!res.ok) fail(`GET ${url} -> ${res.status} ${await res.text()}`);
  return res.json();
};

const putGraph = async (base, id, graph) => {
  const res = await fetch(`${base}/api/analyses/${id}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(graph),
  });
  if (!res.ok) fail(`PUT analysis ${id} failed: ${res.status} ${await res.text()}`);
  return res.json();
};

const statuses = async (base, id) => {
  const state = await getJson(`${base}/api/analyses/${id}/state`);
  return Object.fromEntries(state.nodes.map((n) => [n.nodeId, n.status]));
};

const graphOf = (nodes, edges, values) => ({ formatVersion: "0.1.0", structure: { nodes, edges }, values });

// ---------------------------------------------------------------- processes

// The studio builds into the gate's own temp folder, not its bin/: a dev studio that is
// already running locks bin/, and the gate must not depend on it being stopped. Outside the
// checkout the studio finds no repo root, so it seeds no samples and the temp store stays clean.
const build = (out) => {
  console.log("-- building the studio");
  const res = spawnSync("dotnet", ["build", studio, "--nologo", "-v", "q", "-o", out], { cwd: root, stdio: "inherit", shell: true });
  if (res.status !== 0) fail(`dotnet build exited with ${res.status}`);
};

// Both processes are the one built studio executable, so the host and the MCP server share a build.
const start = (exe, name, args, env) => {
  const child = spawn(exe, args, { cwd: root, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, ...env } });
  child.stdout.on("data", () => {});
  child.stderr.on("data", (d) => process.stderr.write(`[${name}] ${d}`));
  return child;
};

const waitFor = async (child, name, probe, timeoutMs = 180000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (child.exitCode !== null) fail(`${name} exited early with code ${child.exitCode}`);
    try {
      if (await probe()) return;
    } catch { /* not up yet */ }
    await sleep(500);
  }
  fail(`${name} did not start within ${timeoutMs}ms`);
};

// ---------------------------------------------------------------- fake Anthropic

// A Messages API stand-in. Turn 1 and 2 answer with one tool_use each (addNode, setParam), so
// the Ask agent builds a one-node graph called 'answer' through the real MCP tools; turn 3
// answers in text. Every request is checked for the headers and shape the real API needs.
const fakeAnthropic = () => {
  const requests = [];
  const problems = [];
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (d) => { body += d; });
    req.on("end", () => {
      if (req.method !== "POST" || req.url !== "/v1/messages") {
        res.writeHead(404).end();
        return;
      }
      const request = JSON.parse(body);
      requests.push(request);
      if (req.headers["x-api-key"] !== fakeKey) problems.push(`x-api-key was '${req.headers["x-api-key"]}'`);
      if (!req.headers["anthropic-version"]) problems.push("anthropic-version header missing");
      if (request.model !== fakeModel) problems.push(`model was '${request.model}'`);
      if (!Array.isArray(request.system) || !request.system[0]?.cache_control) problems.push("system block has no cache_control");
      const toolNames = (request.tools ?? []).map((t) => t.name);
      for (const name of ["addNode", "setParam", "connect", "evaluate"])
        if (!toolNames.includes(name)) problems.push(`tool '${name}' not offered`);
      if (toolNames.includes("getNodeCatalog")) problems.push("hidden tool getNodeCatalog was offered");
      const first = request.messages.find((m) => m.role === "user");
      const text = typeof first?.content === "string" ? first.content : "";
      const id = /Analysis id: (\S+)/.exec(text)?.[1] ?? "ask-missing";
      const turn = requests.length;
      const content = turn === 1
        ? [{ type: "tool_use", id: "call_1", name: "addNode", input: { id, nodeId: "answer", kind: "table.inline" } }]
        : turn === 2
          ? [{ type: "tool_use", id: "call_2", name: "setParam",
              input: { id, nodeId: "answer", name: "rows", value: '[{"storey":"Level 1","doors":3}]' } }]
          : [{ type: "text", text: "One row: Level 1 has 3 doors." }];
      const reply = {
        id: `msg_${turn}`, type: "message", role: "assistant", model: fakeModel, content,
        stop_reason: turn < 3 ? "tool_use" : "end_turn",
        usage: { input_tokens: 10, output_tokens: 5 },
      };
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(reply));
    });
  });
  return { server, requests, problems };
};

// ---------------------------------------------------------------- steps

const sqlQuery = async (base) => {
  const id = "e2e-sql";
  await putGraph(base, id, graphOf(
    [{ id: "rows", kind: "table.inline", version: 1 }, { id: "q", kind: "sql.query", version: 1 }],
    [{ from: "rows.table", to: "q.t1" }],
    {
      rows: { rows: '[{"type":"Wall","rate":120.5},{"type":"Door","rate":50},{"type":"Wall","rate":30}]' },
      q: { sql: "SELECT type, count(*) AS n, sum(rate) AS total FROM t GROUP BY type ORDER BY type" },
    }));
  const s = await statuses(base, id);
  expect(s.rows === "Ok" && s.q === "Ok", `sql: expected rows/q Ok, got ${JSON.stringify(s)}`);
  const slice = await getJson(`${base}/api/analyses/${id}/results/q/table?take=10`);
  const names = slice.columns.map((c) => c.name ?? c);
  expect(names.join(",") === "type,n,total", `sql: columns were ${names.join(",")}`);
  expect(slice.totalRows === 2, `sql: expected 2 groups, got ${slice.totalRows}`);
  const [door, wall] = slice.rows;
  expect(door[0] === "Door" && Number(door[1]) === 1 && Number(door[2]) === 50, `sql: Door row was ${JSON.stringify(door)}`);
  expect(wall[0] === "Wall" && Number(wall[1]) === 2 && Number(wall[2]) === 150.5, `sql: Wall row was ${JSON.stringify(wall)}`);
  console.log("sql query: 2 groups, counts and sums right");
};

const writeBack = async (base, models) => {
  const id = "e2e-writeback";
  const source = join(models, "duplex-base.ifc");
  const target = join(models, "duplex-e2e.ifc");
  const before = createHash("sha256").update(readFileSync(source)).digest("hex");
  await putGraph(base, id, graphOf(
    [{ id: "psets", kind: "table.inline", version: 1 }, { id: "write", kind: "sink.writePsets", version: 1 }],
    [{ from: "psets.table", to: "write.in" }],
    {
      psets: { rows: JSON.stringify([
        { entityId: wallId, psetName: "E2E_Smoke", paramName: "Checked", paramValue: "yes" },
        { entityId: wallId, psetName: "E2E_Smoke", paramName: "Gate", paramValue: "e2e-smoke" },
      ]) },
      write: { sourcePath: source, targetPath: target },
    }));
  const pending = await statuses(base, id);
  expect(pending.psets === "Ok" && pending.write === "EffectPending",
    `write-back: expected psets Ok and write EffectPending before Run, got ${JSON.stringify(pending)}`);
  expect(!existsSync(target), "write-back: target file existed before Run (nothing writes until Run)");

  const run = await fetch(`${base}/api/analyses/${id}/runs`, { method: "POST" });
  if (!run.ok) fail(`write-back: POST runs failed: ${run.status} ${await run.text()}`);
  const created = await run.json();
  expect(/^[0-9a-f]{64}$/.test(created.graphHash), `write-back: bad run graphHash ${created.graphHash}`);
  expect(existsSync(target), "write-back: Run did not write the target IFC");
  const written = readFileSync(target, "latin1");
  expect(written.includes("E2E_Smoke") && written.includes("Gate"), "write-back: target IFC lacks the new property set");
  expect(statSync(target).size > statSync(source).size, "write-back: target IFC is not larger than the source");
  expect(createHash("sha256").update(readFileSync(source)).digest("hex") === before, "write-back: the source IFC changed");
  const record = await (await fetch(`${base}/api/analyses/${id}/runs/${created.fileName}`)).text();
  expect(record.includes(created.graphHash), "write-back: run record missing graph hash");
  console.log(`write-back: ${created.fileName} wrote ${statSync(target).size - statSync(source).size} extra bytes`);
};

const mcpIntent = async (mcp, base) => {
  const id = "e2e-mcp-intent";
  let next = 1;
  const rpc = async (method, params, notification = false) => {
    const message = { jsonrpc: "2.0", method, params };
    if (!notification) message.id = next++;
    const res = await fetch(mcp, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(message) });
    if (notification) return null;
    expect(res.ok, `mcp: ${method} -> HTTP ${res.status}`);
    const reply = await res.json();
    if (reply.error) fail(`mcp: ${method} error ${reply.error.code}: ${reply.error.message}`);
    return reply.result;
  };
  const call = async (name, args) => {
    const result = await rpc("tools/call", { name, arguments: args });
    const text = result.content?.[0]?.text ?? "";
    expect(!result.isError, `mcp: ${name} failed: ${text.slice(0, 300)}`);
    return text;
  };

  const init = await rpc("initialize", { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "e2e-smoke", version: "0" } });
  expect(init.serverInfo?.name === "bimopenflow", `mcp: server is ${init.serverInfo?.name}`);
  await rpc("notifications/initialized", {}, true);
  const tools = (await rpc("tools/list", {})).tools.map((t) => t.name);
  for (const name of ["addNode", "setParam", "connect", "evaluate", "getResult", "listDatabases"])
    expect(tools.includes(name), `mcp: tools/list lacks ${name} (${tools.length} tools)`);

  await call("addNode", { id, nodeId: "rows", kind: "table.inline" });
  await call("setParam", { id, nodeId: "rows", name: "rows", value: '[{"name":"front"},{"name":"back"}]' });
  const evaluated = await call("evaluate", { id });
  expect(evaluated.includes("Ok"), `mcp: evaluate did not report Ok: ${evaluated.slice(0, 300)}`);
  const result = await call("getResult", { id, nodeId: "rows", port: "table", take: 10 });
  expect(result.includes("front") && result.includes("back"), `mcp: getResult lacks the rows: ${result.slice(0, 300)}`);

  // The MCP server and the host share the store, so the intent's graph is now the host's too.
  const s = await statuses(base, id);
  expect(s.rows === "Ok", `mcp: host sees ${JSON.stringify(s)} for the MCP-built graph`);
  console.log(`mcp intent: ${tools.length} tools; addNode, setParam, evaluate, getResult; host sees the graph`);
};

const askRequest = async (base, fake) => {
  const info = await getJson(`${base}/api/ask/model`);
  expect(info.provider === "anthropic" && info.configured === true && info.model === fakeModel,
    `ask: model info was ${JSON.stringify(info)}`);
  const res = await fetch(`${base}/api/ask`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ request: "How many doors are on each storey?" }),
  });
  expect(res.ok, `ask: POST -> ${res.status}`);
  expect((res.headers.get("content-type") ?? "").startsWith("text/event-stream"), "ask: response is not an event stream");
  const events = (await res.text()).split("\n").filter((l) => l.startsWith("data: ")).map((l) => JSON.parse(l.slice(6)));
  const types = events.map((e) => e.type);
  expect(types[0] === "start", `ask: first event was ${types[0]}`);
  const error = events.find((e) => e.type === "error");
  expect(!error, `ask: error event: ${error?.message}`);
  const toolEvents = events.filter((e) => e.type === "tool");
  expect(toolEvents.map((e) => e.name).join(",") === "addNode,setParam",
    `ask: tool events were ${toolEvents.map((e) => `${e.name}:${e.ok}`).join(",")}`);
  expect(toolEvents.every((e) => e.ok === true), "ask: a tool call failed");
  const done = events.at(-1);
  expect(done?.type === "done", `ask: last event was ${done?.type}`);
  expect(done.analysisId.startsWith("ask-"), `ask: analysis id was ${done.analysisId}`);
  expect(done.built === true && done.verified === true && done.problem == null,
    `ask: done was built=${done.built} verified=${done.verified} problem=${done.problem}`);
  expect(done.text.includes("3 doors"), `ask: answer text was '${done.text}'`);
  expect(done.turns === 3, `ask: expected 3 model turns, got ${done.turns}`);
  expect(fake.requests.length === 3, `ask: fake model saw ${fake.requests.length} requests`);
  expect(fake.problems.length === 0, `ask: fake model saw bad requests: ${fake.problems.join("; ")}`);
  const s = await statuses(base, done.analysisId);
  expect(s.answer === "Ok", `ask: built graph state ${JSON.stringify(s)}`);
  const slice = await getJson(`${base}/api/analyses/${done.analysisId}/results/answer/table?take=5`);
  expect(slice.totalRows === 1, `ask: answer table has ${slice.totalRows} rows`);
  console.log(`ask: ${done.analysisId} built and verified in ${done.turns} turns`);
};

// ---------------------------------------------------------------- main

const main = async () => {
  const work = mkdtempSync(join(tmpdir(), "bof-e2e-"));
  const models = join(work, "models");
  mkdirSync(models);
  copyFileSync(sampleIfc, join(models, "duplex-base.ifc"));
  const hostPort = randomPort();
  const mcpPort = hostPort + 1;
  const base = `http://127.0.0.1:${hostPort}`;
  const mcpUrl = `http://127.0.0.1:${mcpPort}/mcp`;
  const common = ["--models", models, "--cache", join(work, "cache"), "--store", join(work, "store")];
  const fake = fakeAnthropic();
  await new Promise((r) => fake.server.listen(0, "127.0.0.1", r));
  const fakeUrl = `http://127.0.0.1:${fake.server.address().port}`;
  let host = null;
  let mcp = null;
  try {
    const out = join(work, "bin");
    build(out);
    const exe = join(out, "bimopenflow-studio.exe");
    host = start(exe, "host", ["--port", String(hostPort), ...common], {
      ASK_PROVIDER: "anthropic",
      ANTHROPIC_API_KEY: fakeKey,
      ANTHROPIC_BASE_URL: fakeUrl,
      ANTHROPIC_MODEL: fakeModel,
      ANTHROPIC_EFFORT: "",
    });
    mcp = start(exe, "mcp", ["mcp", "--http", String(mcpPort), ...common], {});
    await waitFor(host, "host", async () => (await fetch(`${base}/api/models`)).ok);
    // Any HTTP reply means the MCP server is listening; the protocol is checked in mcpIntent.
    await waitFor(mcp, "mcp server", async () => (await fetch(mcpUrl, { method: "POST", body: "{}" })).status > 0);
    await sqlQuery(base);
    await writeBack(base, models);
    await mcpIntent(mcpUrl, base);
    await askRequest(base, fake);
    console.log("E2E SMOKE: PASS");
  } catch (err) {
    console.error("E2E SMOKE: FAIL —", err.message);
    process.exitCode = 1;
  } finally {
    host?.kill();
    mcp?.kill();
    fake.server.close();
    await sleep(500);
    try { rmSync(work, { recursive: true, force: true }); } catch { /* a process may hold a lock briefly */ }
  }
};

await main();
