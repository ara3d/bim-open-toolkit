// Starts BimOpenFlow with one command: builds the host, then launches the host and
// the Vite editor as detached processes that outlive the terminal or agent session
// that started them, and prints the editor URL once both answer. Re-running it
// reuses whatever is already listening, so it is safe to call from any session.
//
//   node scripts/start-bim-flow.mjs                  # bim profile over data/, editor on 5300
//   node scripts/start-bim-flow.mjs --profile tables # tables profile over samples/tables, editor on 5310
//   node scripts/start-bim-flow.mjs --status         # what is listening, and where the logs are
//   node scripts/start-bim-flow.mjs --stop           # stop the profile's host and editor
//   node scripts/start-bim-flow.mjs --restart        # stop, rebuild, start
//   node scripts/start-bim-flow.mjs --no-build       # skip the dotnet build
//   node scripts/start-bim-flow.mjs --keep           # stay in the foreground after starting (for .claude/launch.json)
//
// Ports match .claude/launch.json and docs/DEMOS.md. Logs, store, and cache live under
// artifacts/bim-flow/<profile>/, which git ignores.
import { spawn, spawnSync } from "node:child_process";
import { closeSync, existsSync, mkdirSync, openSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { buildProject, root, waitForUrl } from "./bim-flow-processes.mjs";

const PROFILES = {
  bim: { hostPort: 5214, webPort: 5300, models: [join(root, "data")] },
  tables: { hostPort: 5224, webPort: 5310, models: [join(root, "samples", "tables")] },
};

// BimOpenFlow.Studio is BimOpenFlow.Host plus POST /api/ask (see
// src/studio/BimOpenFlow.Studio/Program.cs): same CLI options, same routes,
// one more endpoint. Starting it here instead of the plain host is what makes
// "one start command" also satisfy TKT-84 (an Ask box in the main editor)
// without a second copy of the ask-endpoint wiring in BimOpenFlow.Host itself.
const HOST_PROJECT = "src/studio/BimOpenFlow.Studio";
const HOST_BUILD = join(root, "artifacts", "bim-flow", "host");
const HOST_DLL = join(HOST_BUILD, "bimopenflow-studio.dll");
const APP_DIR = join(root, "bimopenflow", "web", "packages", "app");

const flag = (name) => process.argv.includes(name);
const option = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
};

/** True when `url` answers 2xx right now. */
async function isUp(url) {
  try { return (await fetch(url)).ok; } catch { return false; }
}

/** PIDs of processes listening on `port`, on Windows via netstat and elsewhere via lsof. */
function pidsOnPort(port) {
  if (process.platform === "win32") {
    const out = spawnSync("netstat", ["-ano"], { encoding: "utf8" }).stdout ?? "";
    const pids = out.split("\n")
      .filter((line) => /LISTENING/.test(line) && new RegExp(`:${port}\\s`).test(line))
      .map((line) => Number(line.trim().split(/\s+/).pop()));
    return [...new Set(pids.filter(Boolean))];
  }
  const out = spawnSync("lsof", ["-ti", `:${port}`], { encoding: "utf8" }).stdout ?? "";
  return out.split("\n").map(Number).filter(Boolean);
}

/** Kills the process tree behind every PID (vite and dotnet both spawn children). */
function killPids(pids) {
  for (const pid of pids) {
    if (process.platform === "win32") spawnSync("taskkill", ["/pid", String(pid), "/t", "/f"], { stdio: "ignore" });
    else process.kill(pid, "SIGTERM");
  }
}

/** Spawns `cmd args` detached from this process, appending its output to `log`; returns the child. */
function spawnDetached(cmd, args, { cwd = root, env = {}, log }) {
  mkdirSync(join(log, ".."), { recursive: true });
  const fd = openSync(log, "a");
  const child = spawn(cmd, args, {
    cwd, env: { ...process.env, ...env }, detached: true, stdio: ["ignore", fd, fd], windowsHide: true,
  });
  child.unref();
  closeSync(fd);
  return child;
}

/** The paths one profile writes to: store, cache, and a log per process. */
function workDirs(profile) {
  const work = join(root, "artifacts", "bim-flow", profile);
  return { store: join(work, "store"), cache: join(work, "cache"), logs: join(work, "logs") };
}

/** Vite's CLI entry inside the web workspace, so no shell or npx wrapper sits between us and it. */
function viteBin() {
  const pkg = createRequire(join(APP_DIR, "package.json")).resolve("vite/package.json");
  return join(dirname(pkg), "bin", "vite.js");
}

function urls(profile) {
  const { hostPort, webPort } = PROFILES[profile];
  return { host: `http://127.0.0.1:${hostPort}`, web: `http://127.0.0.1:${webPort}` };
}

async function status(profile) {
  const { hostPort, webPort } = PROFILES[profile];
  const { host, web } = urls(profile);
  const { logs } = workDirs(profile);
  const line = async (label, url, port) =>
    `${label.padEnd(6)} ${url}  ${(await isUp(`${url}${label === "host" ? "/api/models" : "/"}`)) ? "up" : "down"}  pids ${pidsOnPort(port).join(",") || "-"}`;
  console.log(`profile ${profile}`);
  console.log(await line("host", host, hostPort));
  console.log(await line("editor", web, webPort));
  console.log(`logs   ${logs}`);
}

function stopProfile(profile) {
  const { hostPort, webPort } = PROFILES[profile];
  for (const [label, port] of [["editor", webPort], ["host", hostPort]]) {
    const pids = pidsOnPort(port);
    if (pids.length === 0) { console.log(`${label} on ${port}: nothing listening`); continue; }
    killPids(pids);
    console.log(`${label} on ${port}: stopped ${pids.join(",")}`);
  }
}

async function start(profile, { build }) {
  const { hostPort, webPort, models } = PROFILES[profile];
  const { host, web } = urls(profile);
  const { store, cache, logs } = workDirs(profile);
  for (const dir of [store, cache, logs]) mkdirSync(dir, { recursive: true });

  const hostWasUp = await isUp(`${host}/api/models`);
  if (hostWasUp) {
    console.log(`host already answering at ${host}; not rebuilding`);
  } else {
    if (build || !existsSync(HOST_DLL)) {
      console.log(`building ${HOST_PROJECT} into ${HOST_BUILD}`);
      buildProject(HOST_PROJECT, HOST_BUILD);
    }
    const log = join(logs, "host.log");
    const child = spawnDetached("dotnet", [
      HOST_DLL, "--port", String(hostPort), "--profile", profile,
      "--models", models.join(";"), "--store", store, "--cache", cache,
    ], { log });
    console.log(`host starting on ${host} (pid ${child.pid}, log ${log})`);
    await waitForUrl(`${host}/api/models`, child, { label: "host" });
  }

  if (await isUp(`${web}/`)) {
    console.log(`editor already answering at ${web}`);
  } else {
    const log = join(logs, "web.log");
    const child = spawnDetached(process.execPath, [viteBin(), "--port", String(webPort), "--strictPort"],
      { cwd: APP_DIR, env: { BOF_HOST: host, BOF_DUCKDB_HOST: host }, log });
    console.log(`editor starting on ${web} (pid ${child.pid}, log ${log})`);
    await waitForUrl(`${web}/`, child, { label: "editor" });
  }

  console.log(`\nBimOpenFlow (${profile}) is up: ${web}`);
  console.log(`stop it with: node scripts/start-bim-flow.mjs --profile ${profile} --stop`);
}

async function main() {
  const profile = option("--profile", "bim");
  if (!PROFILES[profile]) throw new Error(`unknown profile ${profile}; choose ${Object.keys(PROFILES).join(" or ")}`);
  if (flag("--status")) return status(profile);
  if (flag("--stop")) return stopProfile(profile);
  if (flag("--restart")) stopProfile(profile);
  await start(profile, { build: !flag("--no-build") });
  if (flag("--keep")) {
    console.log("--keep: staying in the foreground; the servers keep running if this process is stopped");
    await new Promise(() => {});
  }
}

main().catch((err) => { console.error(err.message ?? err); process.exit(1); });
