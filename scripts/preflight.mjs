// Names what a clean checkout is missing before the first demo starts: the Node
// and .NET versions the web editor and host need, the dependencies deps.mjs fills
// from deps.json (the engine among them), and
// the private Snowdon model the BIM-profile demos read. Run it before following
// docs/START.md.
//
//   node scripts/preflight.mjs
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const shell = process.platform === "win32";

// Matches the Vite version pinned in bimopenflow/web/package-lock.json.
const MIN_NODE_MAJOR = 20;
const MIN_NODE_20_MINOR = 19;
const MIN_NODE_22_MINOR = 12;

/** The repositories deps.json pins; node deps.mjs puts each at deps/<name>. */
const DEPS = Object.keys(JSON.parse(readFileSync(resolve(root, "deps.json"), "utf8")));

const SNOWDON_ENV_VARS = ["BIMOPENFLOW_SNOWDON", "SNOWDON_BOS_PATH"];
const SNOWDON_DEFAULT_PATH = () =>
  resolve(process.env.USERPROFILE ?? process.env.HOME ?? ".", "Documents", "BIM Open Schema",
    "Snowdon Towers Sample Architectural.bos");

/** {pass, detail} for the Node major/minor Vite's engines field accepts. */
function checkNode() {
  const [major, minor] = process.versions.node.split(".").map(Number);
  const pass = major > 22 || (major === 22 && minor >= MIN_NODE_22_MINOR)
    || (major === MIN_NODE_MAJOR && minor >= MIN_NODE_20_MINOR);
  return { pass, detail: `found ${process.versions.node}, need ^20.19.0 or >=22.12.0 (Vite's requirement)` };
}

/** {pass, detail} for a .NET 8+ SDK being installed and on PATH. */
function checkDotnetSdk() {
  const result = spawnSync("dotnet", ["--list-sdks"], { cwd: root, encoding: "utf8", shell });
  if (result.error || result.status !== 0)
    return { pass: false, detail: "`dotnet` was not found on PATH; install the .NET 8 SDK" };
  const versions = result.stdout.split("\n").map((line) => line.trim().split(" ")[0]).filter(Boolean);
  const hasEight = versions.some((v) => Number(v.split(".")[0]) >= 8);
  return {
    pass: hasEight,
    detail: hasEight
      ? `found ${versions.join(", ")}`
      : `found ${versions.join(", ") || "no SDKs"}; the host targets net8.0-windows and needs the .NET 8 SDK or newer`,
  };
}

/** {pass, detail} for every deps.json entry being present under deps/ (cloned or linked by deps.mjs). */
function checkDeps() {
  const missing = DEPS.filter((name) => {
    try {
      return readdirSync(resolve(root, "deps", name)).length === 0;
    } catch {
      return true;
    }
  });
  return {
    pass: missing.length === 0,
    detail: missing.length === 0
      ? `all ${DEPS.length} present (${DEPS.join(", ")})`
      : `missing under deps/: ${missing.join(", ")}; run: node deps.mjs`,
  };
}

/** {pass, detail, optional} for the private Snowdon BOS model an env var or the documented default path names. */
function checkSnowdonModel() {
  const namedByEnv = SNOWDON_ENV_VARS.map((name) => process.env[name]).find(Boolean);
  const path = namedByEnv ?? SNOWDON_DEFAULT_PATH();
  const pass = existsSync(path);
  return {
    pass,
    optional: true,
    detail: pass
      ? `found at ${path}`
      : `not found at ${path}; needed only for the BIM-profile Snowdon demos. Set BIMOPENFLOW_SNOWDON to a copy, or skip to the tables-profile demo, which needs no private model`,
  };
}

const checks = [
  { name: "Node.js version", ...checkNode() },
  { name: ".NET SDK", ...checkDotnetSdk() },
  { name: "deps.json dependencies", ...checkDeps() },
  { name: "private Snowdon model", ...checkSnowdonModel() },
];

for (const { name, pass, optional, detail } of checks) {
  const status = pass ? "PASS" : optional ? "SKIP" : "FAIL";
  console.log(`${status.padEnd(4)} ${name}: ${detail}`);
}

const failed = checks.filter((c) => !c.pass && !c.optional);
if (failed.length > 0) {
  console.error(`\n${failed.length} required prerequisite(s) missing. Fix them, then re-run this check.`);
  process.exit(1);
}
console.log("\nAll required prerequisites are present. See docs/START.md for the commands to run.");
