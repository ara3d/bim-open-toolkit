// Small file and process helpers shared by the release scripts. Nothing here knows what a release holds.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** Runs a command with its output shown; throws on a non-zero exit. `.cmd` shims (npm) need a shell on Windows. */
export function run(command, args, { cwd = root, env = {} } = {}) {
  console.log(`> ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    cwd, stdio: "inherit", shell: process.platform === "win32" && /^(npm|npx)$/.test(command), env: { ...process.env, ...env },
  });
  if (result.status !== 0) throw new Error(`${command} ${args[0] ?? ""} exited with ${result.status ?? result.error}`);
}

/** A command's stdout, trimmed; null when it fails. */
export function capture(command, args, cwd = root) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : null;
}

/** Every file under `dir`, as paths relative to it. */
export function filesUnder(dir) {
  const out = [];
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      const full = join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else out.push(relative(dir, full));
    }
  };
  if (existsSync(dir)) walk(dir);
  return out;
}

const hashOf = (file) => createHash("sha256").update(readFileSync(file)).digest("hex");

/** Copies one file, creating its folder. */
export function copyInto(from, to) {
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
}

/** The file version of a .dll or .exe, as four numbers; null when it has none. */
export function fileVersion(file) {
  const text = capture("powershell", ["-NoProfile", "-Command", `(Get-Item -LiteralPath '${file}').VersionInfo.FileVersion`]);
  const parts = text?.split(".").map(Number);
  return parts?.length === 4 && parts.every(Number.isInteger) ? parts : null;
}

/** Positive when version a is newer than b. */
const compareVersions = (a, b) => a.reduce((diff, part, i) => diff || part - b[i], 0);

/**
 * Copies the files of `source` into `target`. A file already in `target` with other bytes is a
 * conflict, returned rather than overwritten: two publishes that disagree about a shared assembly
 * must not silently pick one. The one exception is a .dll of the same major and minor version
 * (two publishes of the .NET libraries at different servicing levels), where the newer file
 * stays: those libraries keep to their contract within a major version.
 */
export function mergeTree(source, target, skip = () => false) {
  const conflicts = [];
  for (const file of filesUnder(source).filter((f) => !skip(f))) {
    const from = join(source, file);
    const to = join(target, file);
    if (!existsSync(to)) copyInto(from, to);
    else if (hashOf(to) !== hashOf(from)) {
      const [have, incoming] = file.endsWith(".dll") ? [fileVersion(to), fileVersion(from)] : [null, null];
      if (!have || !incoming || have[0] !== incoming[0] || have[1] !== incoming[1]) conflicts.push(file);
      else if (compareVersions(incoming, have) > 0) copyInto(from, to);
    }
  }
  return conflicts;
}

/** Copies the git-tracked files under `paths` of the repository at `repo` into `target`, keeping their relative paths. */
export function copyTracked(repo, paths, target, strip = "") {
  const listing = spawnSync("git", ["-C", repo, "ls-files", "-z", "--", ...paths], { encoding: "utf8" });
  if (listing.status !== 0) throw new Error(`git ls-files failed in ${repo}`);
  const files = listing.stdout.split("\0").filter(Boolean);
  for (const file of files) copyInto(join(repo, file), join(target, strip && file.startsWith(strip) ? file.slice(strip.length) : file));
  return files.length;
}

export const clean = (dir) => rmSync(dir, { recursive: true, force: true });

/** Total bytes under `dir`. */
export function sizeOf(dir) {
  return filesUnder(dir).reduce((sum, f) => sum + statSync(join(dir, f)).size, 0);
}

export const megabytes = (bytes) => `${(bytes / 1048576).toFixed(0)} MB`;
