// Headless smoke: typecheck + test every web/viewer package, then build the editor app.
// Usage: node gates/web-smoke.mjs   (from the repo root; needs prior npm install in both workspaces)
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const viewer = join(root, "viewer");
const web = join(root, "bimopenflow", "web");

const steps = [
  [viewer, ["test", "-w", "@ara3d/viewer-core"]],
  [viewer, ["test", "-w", "@ara3d/viewer-loaders"]],
  [viewer, ["test", "-w", "@ara3d/viewer-controls"]],
  [web, ["test", "-w", "@bimopenflow/viz"]],
  [web, ["test", "-w", "@bimopenflow/state"]],
  [web, ["test", "-w", "@bimopenflow/panes"]],
  [web, ["test", "-w", "@bimopenflow/app"]],
  [web, ["run", "build", "-w", "@bimopenflow/app"]],
];

let failed = false;
for (const [cwd, args] of steps) {
  console.log(`\n== npm ${args.join(" ")} (${cwd}) ==`);
  const res = spawnSync("npm", args, { cwd, stdio: "inherit", shell: true });
  if (res.status !== 0) { failed = true; console.error(`FAILED: npm ${args.join(" ")}`); }
}
console.log(failed ? "\nWEB SMOKE: FAIL" : "\nWEB SMOKE: PASS");
process.exitCode = failed ? 1 : 0;
