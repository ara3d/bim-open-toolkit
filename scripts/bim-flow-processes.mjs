// Starts and stops the processes a headless BimOpenFlow demo needs: a host built
// into a private output folder, the Vite editor pointed at it, and a bounded wait
// for either to answer. Shared by the walkthrough and capture scripts; nothing here
// knows about graphs or screenshots.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const shell = process.platform === "win32";

/** dotnet build of one project into `output`; throws on a non-zero exit. */
export function buildProject(project, output) {
  const result = spawnSync("dotnet", ["build", join(root, project), "-o", output, "--verbosity", "quiet", "--nologo"],
    { cwd: root, stdio: "inherit", shell });
  if (result.status !== 0) throw new Error(`dotnet build ${project} failed with code ${result.status}`);
  return output;
}

/** Starts `dotnet <dll> args...` with its stderr echoed under a prefix; stdout is kept for the caller. */
export function startDotnet(dll, args, { prefix = "host", cwd = root, env = {} } = {}) {
  if (!existsSync(dll)) throw new Error(`${dll} does not exist; build it first`);
  const child = spawn("dotnet", [dll, ...args], { cwd, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, ...env } });
  child.stdout.on("data", (d) => process.stdout.write(`[${prefix}] ${d}`));
  child.stderr.on("data", (d) => process.stderr.write(`[${prefix}] ${d}`));
  return child;
}

/** A bim- or tables-profile host on `port` over fresh store and cache folders under `work`. */
export function startHost(dll, { port, profile, models, work, prefix = profile, env = {} }) {
  for (const dir of ["store", "cache"]) mkdirSync(join(work, dir), { recursive: true });
  return startDotnet(dll, [
    "--port", String(port), "--profile", profile,
    "--models", models.join(";"),
    "--store", join(work, "store"), "--cache", join(work, "cache"),
  ], { prefix, env });
}

/** The Vite editor on `port`, proxying /api to `hostUrl`. */
export function startWeb(port, hostUrl, { prefix = "web", config, env = {} } = {}) {
  const app = join(root, "bimopenflow", "web", "packages", "app");
  const args = ["vite", "--port", String(port), "--strictPort", ...(config ? ["--config", config] : [])];
  const child = spawn("npx", args, { cwd: app, stdio: ["ignore", "pipe", "pipe"], shell,
    env: { ...process.env, BOF_HOST: hostUrl, BOF_DUCKDB_HOST: hostUrl, ...env } });
  child.stdout.on("data", (d) => process.stdout.write(`[${prefix}] ${d}`));
  child.stderr.on("data", (d) => process.stderr.write(`[${prefix}] ${d}`));
  return child;
}

/** Polls `url` until it answers 2xx, failing if the child exits or the budget runs out. */
export async function waitForUrl(url, child, { timeoutMs = 180000, intervalMs = 500, label = url } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (child && child.exitCode !== null) throw new Error(`${label}: process exited early with code ${child.exitCode}`);
    try {
      const res = await fetch(url);
      if (res.ok) return res;
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`${label} did not answer within ${timeoutMs} ms`);
}

/** Polls an analysis until every node is Ok (the host prepares generated inputs in the background). */
export async function waitForAnalysisOk(base, id, { timeoutMs = 300000 } = {}) {
  const start = Date.now();
  let last = "";
  while (Date.now() - start < timeoutMs) {
    const res = await fetch(`${base}/api/analyses/${encodeURIComponent(id)}/state`);
    if (res.ok) {
      const state = await res.json();
      const notOk = state.nodes.filter((n) => n.status !== "Ok");
      if (notOk.length === 0) return state;
      last = notOk.map((n) => `${n.nodeId} ${n.status}${n.error ? ": " + n.error : ""}`).join("; ");
      if (notOk.some((n) => n.status === "Error" && !/not ready|preparing/i.test(n.error ?? "")))
        throw new Error(`${id} failed: ${last}`);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`${id} did not reach Ok within ${timeoutMs} ms; last: ${last}`);
}

/** Kills the process tree on Windows (vite and dotnet spawn children) or the process elsewhere. */
export function stop(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(child.pid), "/t", "/f"], { stdio: "ignore" });
  else child.kill();
}

/** A free-looking port: a random offset in a private range, so parallel runs do not collide. */
export const randomPort = (base = 5400) => base + Math.floor(Math.random() * 400);
