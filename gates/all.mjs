// The full pre-release gate: solution build + all C# tests, then web and host smokes.
// Usage: node gates/all.mjs   (from the repo root)
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const run = (cmd, args) => {
  console.log(`\n== ${cmd} ${args.join(" ")} ==`);
  return spawnSync(cmd, args, { cwd: root, stdio: "inherit", shell: true }).status === 0;
};

const ok =
  run("dotnet", ["build", "BimOpenToolkit.sln", "--nologo", "-v", "q"]) &&
  run("dotnet", ["test", "BimOpenToolkit.sln", "--nologo", "--no-build", "-v", "q"]) &&
  run("node", [join("gates", "web-smoke.mjs")]) &&
  run("node", [join("gates", "host-smoke.mjs")]);

console.log(ok ? "\nALL GATES: PASS" : "\nALL GATES: FAIL");
process.exitCode = ok ? 0 : 1;
