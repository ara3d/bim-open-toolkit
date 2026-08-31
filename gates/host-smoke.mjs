// Headless smoke: start the real host, drive the HTTP API end to end, shut down.
// Usage: node gates/host-smoke.mjs   (from the repo root; needs dotnet + a built or buildable host)
import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const port = 5300 + Math.floor(Math.random() * 2000);
const base = `http://127.0.0.1:${port}`;
const work = mkdtempSync(join(tmpdir(), "bof-gate-"));

// The same model-free graph the host unit tests use: view3d.camera -> table.sort.
const graph = {
  formatVersion: "0.1.0",
  structure: {
    nodes: [
      { id: "cam", kind: "view3d.camera", version: 1 },
      { id: "sort", kind: "table.sort", version: 1 },
    ],
    edges: [{ from: "cam.camera", to: "sort.table" }],
  },
  values: { cam: { name: "front" }, sort: { by: "name" } },
};

const fail = (msg) => { throw new Error(msg); };
const expect = (cond, msg) => cond || fail(msg);

const waitForHost = async (child, timeoutMs = 120000) => {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (child.exitCode !== null) fail(`host exited early with code ${child.exitCode}`);
    try {
      const res = await fetch(`${base}/api/models`);
      if (res.ok) return;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500));
  }
  fail(`host did not start within ${timeoutMs}ms`);
};

const run = async () => {
  const catalog = await (await fetch(`${base}/api/catalog/nodes`)).json();
  const kinds = catalog.nodes.map((n) => n.kind);
  expect(kinds.includes("view3d.camera") && kinds.includes("bos.load") && kinds.includes("check.rule"),
    `catalog missing expected node kinds; got ${kinds.length} kinds`);
  console.log(`catalog: ${kinds.length} node kinds`);

  const models = await (await fetch(`${base}/api/models`)).json();
  expect(Array.isArray(models) && models.length === 0, "expected empty model list");

  const put = await fetch(`${base}/api/analyses/smoke`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(graph),
  });
  if (!put.ok) fail(`PUT analysis failed: ${put.status} ${await put.text()}`);
  const summary = await put.json();
  expect(/^[0-9a-f]{64}$/.test(summary.graphHash), `bad graphHash: ${summary.graphHash}`);
  console.log(`put analysis: hash ${summary.graphHash.slice(0, 12)}…`);

  const state = await (await fetch(`${base}/api/analyses/smoke/state`)).json();
  const statuses = Object.fromEntries(state.nodes.map((n) => [n.nodeId, n.status]));
  expect(statuses.cam === "Ok" && statuses.sort === "Ok",
    `expected cam/sort Ok, got ${JSON.stringify(statuses)}`);
  console.log("state: all nodes Ok");

  const slice = await (await fetch(`${base}/api/analyses/smoke/results/sort/table?take=5`)).json();
  expect(Array.isArray(slice.columns) && Array.isArray(slice.rows), "bad result slice shape");
  console.log(`result slice: ${slice.totalRows} rows total`);

  const created = await (await fetch(`${base}/api/analyses/smoke/runs`, { method: "POST" })).json();
  expect(created.graphHash === summary.graphHash, "run hash mismatch");
  const runs = await (await fetch(`${base}/api/analyses/smoke/runs`)).json();
  expect(runs.length === 1 && runs[0].fileName === created.fileName, "run not listed");
  const record = await (await fetch(`${base}/api/analyses/smoke/runs/${created.fileName}`)).text();
  expect(record.includes(summary.graphHash), "run record missing graph hash");
  console.log(`run recorded: ${created.fileName}`);

  const bos = await fetch(`${base}/api/models/nope/bos`);
  expect(bos.status === 404, `expected 404 for unknown model bytes, got ${bos.status}`);
  console.log("unknown model bytes -> 404");
};

const child = spawn("dotnet", ["run", "--project", join(root, "src", "BimOpenFlow.Host"), "--",
  "--port", String(port),
  "--models", join(work, "models"),
  "--cache", join(work, "cache"),
  "--store", join(work, "store")],
  { cwd: root, stdio: ["ignore", "pipe", "pipe"] });
child.stderr.on("data", (d) => process.stderr.write(d));

try {
  await waitForHost(child);
  await run();
  console.log("HOST SMOKE: PASS");
} catch (err) {
  console.error("HOST SMOKE: FAIL —", err.message);
  process.exitCode = 1;
} finally {
  child.kill();
  try { rmSync(work, { recursive: true, force: true }); } catch { /* host may hold locks briefly */ }
}
