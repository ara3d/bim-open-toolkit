// Headless smoke: test the viewer packages, test and typecheck the toolkit's web packages, then build the toolkit pages.
// Usage: node gates/web-smoke.mjs   (from the repo root; needs prior npm install in both workspaces)
import { spawnSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const viewer = join(root, "deps", "bim-open-viewer");
const web = join(root, "bimopenflow", "web");

// The eight generic editor packages (api-client, viz, state, panes, client, graph, app,
// contracts) are bim-open-flow's, and the notebook and the 3D pane are bim-open-notebook's,
// each tested by its own repository's web smoke; here they are linked from deps/, and the
// toolkit's packages are tested and built against them.
const steps = [
  [viewer, ["test", "-w", "@bim-open-viewer/core"]],
  [viewer, ["test", "-w", "@bim-open-viewer/loaders"]],
  [viewer, ["test", "-w", "@bim-open-viewer/controls"]],
  ...["studio-web", "nrc-web"].flatMap((p) => [
    [web, ["test", "-w", `@bimopenflow/${p}`]],
    [web, ["run", "typecheck", "-w", `@bimopenflow/${p}`]],
  ]),
  [web, ["run", "build", "-w", "@bimopenflow/studio-web"]],
];

let failed = false;
for (const [cwd, args] of steps) {
  console.log(`\n== npm ${args.join(" ")} (${cwd}) ==`);
  const res = spawnSync("npm", args, { cwd, stdio: "inherit", shell: true });
  if (res.status !== 0) { failed = true; console.error(`FAILED: npm ${args.join(" ")}`); }
}
console.log(failed ? "\nWEB SMOKE: FAIL" : "\nWEB SMOKE: PASS");
process.exitCode = failed ? 1 : 0;
