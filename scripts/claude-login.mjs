// Finds the Claude Code command-line executable the Ask box and the IFC ask use
// (ASK_PROVIDER=claude-cli, docs/bim-flow-mcp-demo.md), signs it in if needed, and sends
// one tiny request the same way the host does, so a person can confirm the whole path
// works before starting a demo. Logging in this way through this Claude Code copy also
// signs in the studio's Ask box, because both read the same %USERPROFILE%\.claude\ login.
//
//   node scripts/claude-login.mjs [--check] [--dry-run]
//
// --check     after finding a signed-in executable, also sends the tiny test request
//             (this happens anyway right after a login)
// --dry-run   never runs the interactive `auth login`; prints what would run instead,
//             so the not-logged-in path can be exercised without waiting on a browser
import { existsSync, readdirSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";

const shell = process.platform === "win32";
const NAMES_ON_PATH = ["claude.exe", "claude.cmd"];

// The host runs every claude invocation from %TEMP%\bimopenflow-ask\claude-cli
// (ClaudeCliSettings.DefaultWorkDirectory), not the repository, so the repo's own
// CLAUDE.md and AGENTS.md never become part of the model's context. The test request
// below runs from the same kind of neutral directory for the same reason: from the
// repository root, "-p" picks up this repository's CLAUDE.md and the model answers in
// character as the coding assistant instead of literally, which looks like a failure
// but only means the sandbox context leaked in.
const NEUTRAL_WORK_DIRECTORY = join(tmpdir(), "bimopenflow-ask", "claude-login-check");

/** Lists `dir`'s entries, or []  if it does not exist or cannot be read. */
function safeReaddir(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

/** Parses a "2.1.281"-style folder name into comparable numeric parts, or null if it is not one. */
export function parseVersion(name) {
  if (!name) return null;
  const parts = name.split(".").map(Number);
  if (parts.length === 0 || parts.some((n) => !Number.isFinite(n))) return null;
  return parts;
}

/** -1 / 0 / 1 comparing two parsed versions part by part; the shorter one is padded with zeros. */
export function compareVersions(a, b) {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const diff = (a[i] ?? 0) - (b[i] ?? 0);
    if (diff !== 0) return diff > 0 ? 1 : -1;
  }
  return 0;
}

/**
 * Picks the Claude Code executable to use from candidates the caller already gathered,
 * so this stays a pure function that needs no filesystem or process access to test.
 *
 *   override: { path, exists } | undefined       — ASK_CLAUDE_CLI, if set
 *   onPath:   { path, runs } | undefined         — the first claude.exe/.cmd found on PATH
 *   bundled:  [{ root, version, exe }]           — every packaged and %APPDATA% copy found
 *
 * Returns { path, reason, candidates }; path is null when nothing usable was found, and
 * candidates lists every entry looked at (for reporting what to install).
 */
export function chooseClaudeCli({ override, onPath, bundled }) {
  const candidates = [];
  if (override) candidates.push({ root: "ASK_CLAUDE_CLI", exe: override.path, ok: override.exists });
  if (onPath) candidates.push({ root: "PATH", exe: onPath.path, ok: onPath.runs });
  for (const b of bundled) candidates.push({ root: b.root, exe: b.exe, ok: true, version: b.version });

  if (override) {
    return override.exists
      ? { path: override.path, reason: `ASK_CLAUDE_CLI=${override.path}`, candidates }
      : { path: null, reason: `ASK_CLAUDE_CLI names a missing file: ${override.path}`, candidates };
  }

  if (onPath) {
    if (onPath.runs) return { path: onPath.path, reason: `on PATH: ${onPath.path}`, candidates };
    // A PATH hit that does not run is the MSIX-virtualized launcher case: it points at
    // %APPDATA%\Claude\claude-code, which an ordinary terminal cannot see. Fall through
    // to the bundled search instead of trusting it.
  }

  const parsed = bundled.map((b) => ({ ...b, parsed: parseVersion(b.version) })).filter((b) => b.parsed);
  parsed.sort((x, y) => compareVersions(y.parsed, x.parsed));
  const best = parsed[0];
  return best
    ? { path: best.exe, reason: `newest bundled copy (${best.root}, version ${best.version})`, candidates }
    : { path: null, reason: "no candidate found", candidates };
}

/** The first claude.exe/claude.cmd on PATH, and whether it actually runs `--version`. */
function findOnPath() {
  const pathVar = process.env.PATH ?? process.env.Path ?? "";
  for (const dir of pathVar.split(process.platform === "win32" ? ";" : ":")) {
    if (!dir) continue;
    for (const name of NAMES_ON_PATH) {
      const candidate = join(dir, name);
      if (existsSync(candidate)) {
        const result = spawnSync(candidate, ["--version"], { shell, timeout: 10000, encoding: "utf8" });
        return { path: candidate, runs: result.status === 0 };
      }
    }
  }
  return undefined;
}

/**
 * claude.exe directly in a version folder (older desktop apps) or one folder below it (2.1.284
 * and later, such as 2.1.286\635c1867224a\claude.exe); undefined when neither exists.
 */
function bundledExe(versionDir) {
  return [versionDir, ...safeReaddir(versionDir).map((name) => join(versionDir, name))]
    .map((dir) => join(dir, "claude.exe"))
    .find((exe) => existsSync(exe));
}

/** Every packaged (MSIX) and %APPDATA% copy of claude.exe, with its version folder name. */
function findBundled() {
  const bundled = [];
  const localAppData = process.env.LOCALAPPDATA;
  if (localAppData) {
    const packagesRoot = join(localAppData, "Packages");
    for (const pkg of safeReaddir(packagesRoot).filter((name) => name.startsWith("Claude_"))) {
      const claudeCodeRoot = join(packagesRoot, pkg, "LocalCache", "Roaming", "Claude", "claude-code");
      for (const version of safeReaddir(claudeCodeRoot)) {
        const exe = bundledExe(join(claudeCodeRoot, version));
        if (exe) bundled.push({ root: "packaged", version, exe });
      }
    }
  }
  const appData = process.env.APPDATA;
  if (appData) {
    const claudeCodeRoot = join(appData, "Claude", "claude-code");
    for (const version of safeReaddir(claudeCodeRoot)) {
      const exe = bundledExe(join(claudeCodeRoot, version));
      if (exe) bundled.push({ root: "appdata", version, exe });
    }
  }
  return bundled;
}

/** Gathers every candidate this machine has, ready for chooseClaudeCli. */
export function gatherCandidates() {
  const overridePath = process.env.ASK_CLAUDE_CLI;
  const override = overridePath ? { path: overridePath, exists: existsSync(overridePath) } : undefined;
  return { override, onPath: findOnPath(), bundled: findBundled() };
}

function describeCandidate(c) {
  const status = c.ok ? "ok" : c.root === "ASK_CLAUDE_CLI" ? "does not exist" : "found but did not run";
  const version = c.version ? ` (version ${c.version})` : "";
  return `  - ${c.root}: ${c.exe}${version} — ${status}`;
}

function fail(message) {
  console.error(`FAIL: ${message}`);
  process.exit(1);
}

function parseAuthStatus(result) {
  if (result.status !== 0 || !result.stdout) return { loggedIn: false, raw: result.stdout ?? result.stderr ?? "" };
  try {
    return { ...JSON.parse(result.stdout), raw: result.stdout };
  } catch {
    return { loggedIn: false, raw: result.stdout };
  }
}

/** Runs the whole find/login/check flow against argv; the only impure entry point. */
function main() {
  const args = process.argv.slice(2);
  const checkFlag = args.includes("--check");
  const dryRun = args.includes("--dry-run");

  const found = chooseClaudeCli(gatherCandidates());

  if (!found.path) {
    console.log("No Claude Code executable found. Looked at:");
    if (found.candidates.length === 0) console.log("  (nothing: no ASK_CLAUDE_CLI, nothing on PATH, no bundled copy)");
    for (const c of found.candidates) console.log(describeCandidate(c));
    console.log("\nInstall it with: npm install -g @anthropic-ai/claude-code");
    console.log("Or open the Claude desktop app once, which bundles its own copy.");
    fail(found.reason);
  }

  console.log(`Using ${found.path}`);
  console.log(`Chosen because: ${found.reason}`);

  const runCli = (cliArgs, opts = {}) =>
    spawnSync(found.path, cliArgs, { shell, encoding: "utf8", timeout: 60000, ...opts });

  let status = parseAuthStatus(runCli(["auth", "status"]));

  if (status.loggedIn) {
    console.log("Already logged in.");
  } else if (dryRun) {
    console.log(`Not logged in. (dry run) would run: ${found.path} auth login`);
  } else {
    console.log("Not logged in. Opening the browser sign-in (auth login)...");
    const login = spawnSync(found.path, ["auth", "login"], { shell, stdio: "inherit" });
    if (login.status !== 0) fail(`auth login exited with code ${login.status}`);
    status = parseAuthStatus(runCli(["auth", "status"]));
    if (!status.loggedIn) fail(`still not logged in after auth login: ${status.raw}`);
    console.log("Logged in.");
  }

  if (status.loggedIn && (checkFlag || !dryRun)) {
    console.log("Sending a tiny test request (model haiku)...");
    mkdirSync(NEUTRAL_WORK_DIRECTORY, { recursive: true });
    const test = runCli(["-p", "Reply with the single word ok", "--model", "haiku"],
      { timeout: 60000, cwd: NEUTRAL_WORK_DIRECTORY });
    const answer = (test.stdout ?? "").trim();
    // The host's ChatBackend reads whatever the model wrote and does not require an exact
    // word; a global ~/.claude/CLAUDE.md still loads outside a project, so the model may
    // answer in character ("Hi! What would you like to work on?") rather than literally.
    // What matters here is that the executable ran, logged in, and returned something.
    if (test.status !== 0 || answer.length === 0) {
      fail(`test request did not answer (exit ${test.status}): ${test.stderr || "(empty output)"}`);
    }
    console.log(`Answered: ${answer}`);
  }

  console.log(`\nSet this for the host: ASK_CLAUDE_CLI=${found.path.replaceAll("\\", "/")}`);
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) main();
