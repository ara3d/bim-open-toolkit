// The full pre-release gate: solution build + all C# tests, then web and host smokes.
// Usage: node gates/all.mjs   (from the repo root)
//
// The "dotnet test" step below already runs tests/flow/BimOpenFlow.SampleFlows.Tests
// (TKT-85: every sample flow, in both host profiles, evaluated, lint-checked, and
// compared with a golden file), because it is part of BimOpenToolkit.sln; see
// docs/sample-flows-test.md for what it checks and how to re-approve its golden files.
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
