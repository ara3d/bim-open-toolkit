// The release smoke: starts the published host from a release folder, evaluates sample graphs to Ok,
// fetches the pages and notebooks it serves, and calls an IFC tool through the published MCP server.
//
//   node scripts/release/smoke-release.mjs <release-folder> [--prepare]
//
// --prepare waits for the host to build the NRC databases and BOS file in the background (about a
// minute) and then evaluates a graph that reads them; the build runs it so the zip ships them built.
// The host's store and cache go to a temporary folder, so the smoke leaves no analyses behind.
import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { callMcpTool } from "./mcpClient.mjs";

const folder = resolve(process.argv[2] ?? "");
const prepare = process.argv.includes("--prepare");
if (!existsSync(join(folder, "bin", "bimopenflow-studio.exe"))) {
  console.error(`${folder} is not a release folder (no bin/bimopenflow-studio.exe)`);
  process.exit(2);
}

const failures = [];
const check = (ok, what) => {
  console.log(`${ok ? "ok  " : "FAIL"} ${what}`);
  if (!ok) failures.push(what);
};

const freePort = () => new Promise((done) => {
  const server = createServer().listen(0, "127.0.0.1", () => {
    const { port } = server.address();
    server.close(() => done(port));
  });
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function until(what, probe, seconds) {
  const end = Date.now() + seconds * 1000;
  while (Date.now() < end) {
    if (await probe()) return true;
    await sleep(1000);
  }
  check(false, `${what} (waited ${seconds} s)`);
  return false;
}

/** Every node of the analysis reports Ok. */
async function evaluatesToOk(base, id) {
  const response = await fetch(`${base}/api/analyses/${id}/state`);
  if (!response.ok) return check(false, `${id}: GET state answered ${response.status}`);
  const nodes = (await response.json()).nodes ?? [];
  const bad = nodes.filter((n) => n.status !== "Ok").map((n) => `${n.id}=${n.status}`);
  return check(nodes.length > 0 && bad.length === 0, `${id}: ${nodes.length} nodes Ok${bad.length ? `, not Ok: ${bad.join(", ")}` : ""}`);
}

const get = async (base, path) => {
  const response = await fetch(`${base}${path}`);
  return { ok: response.ok, status: response.status, body: await response.text() };
};

const scratch = mkdtempSync(join(tmpdir(), "bimopen-smoke-"));
const port = await freePort();
const base = `http://127.0.0.1:${port}`;
const host = spawn(join(folder, "bin", "bimopenflow-studio.exe"), [
  "--profile", "bim", "--port", String(port), "--web", join(folder, "web"),
  "--store", join(scratch, "store"), "--cache", join(scratch, "cache"),
  "--models", [join(folder, "samples", "nrc"), join(folder, "samples", "public")].join(";"),
], { cwd: folder, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, Logging__LogLevel__Default: "Warning" } });
host.stdout.on("data", (d) => process.stdout.write(`[host] ${d}`));
host.stderr.on("data", (d) => process.stderr.write(`[host] ${d}`));

try {
  const up = await until("the host answers /api/analyses", async () => (await fetch(`${base}/api/analyses`).catch(() => null))?.ok, 120);
  if (up) {
    await evaluatesToOk(base, "bim-level-summary");
    for (const page of ["/", "/studio.html", "/nrc.html", "/notebook.html", "/__nrc/graphs.md"])
      check((await get(base, page)).ok, `GET ${page}`);
    const list = await get(base, "/__notebooks/");
    const names = list.ok ? JSON.parse(list.body) : [];
    check(names.length >= 10, `/__notebooks/ lists ${names.length} notebooks`);
    const missing = [];
    for (const name of names) if (!(await get(base, `/__notebooks/${encodeURIComponent(name)}`)).ok) missing.push(name);
    check(missing.length === 0, `every listed notebook is served${missing.length ? `; missing: ${missing.join(", ")}` : ""}`);
    check(!names.some((n) => /snowdon/i.test(n)), "no Snowdon notebook is served");
    const nodes = await get(base, "/api/catalog/nodes");
    check(nodes.ok && nodes.body.includes("view3d."), "the node catalog answers with the bim packs");

    if (prepare) {
      const ready = ["duplex-enriched.duckdb", "duplex-base.duckdb", "duplex-enriched.bos"].map((f) => join(folder, "samples", "nrc", f));
      if (await until("the NRC databases are built", () => ready.every(existsSync), 600)) {
        await sleep(3000);
        await evaluatesToOk(base, "nrc-q1-building-total");
      }
    }
  }
  const ifc = join(folder, "samples", "nrc", "duplex-enriched.ifc");
  const counts = await callMcpTool(join(folder, "bin", "bimopenmcp-ifc.exe"), [], "ifc_type_counts", { path: ifc.replaceAll("\\", "/") });
  check(/IfcDoor/i.test(counts), "ifc_type_counts through bimopenmcp-ifc.exe lists IfcDoor");
} catch (e) {
  check(false, String(e?.stack ?? e));
} finally {
  host.kill();
  await sleep(500);
  rmSync(scratch, { recursive: true, force: true });
}

console.log(failures.length === 0 ? "\nrelease smoke passed" : `\nrelease smoke FAILED (${failures.length})`);
process.exit(failures.length === 0 ? 0 : 1);
