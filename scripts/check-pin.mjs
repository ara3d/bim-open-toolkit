#!/usr/bin/env node
// Checks that deps.json pins a dependency at the commit its deps/ checkout is
// on, and that the commit is pushed, so a change made in that repository is
// what this one builds and tests against. A close gate (tickets/close-gates.toml)
// runs it for every ticket that touches the dependency: the ticket that changes
// bim-open-flow also moves its pin.
//
//   node scripts/check-pin.mjs <name> [<name> ...]
//
// Exit 0 when every named pin matches a pushed checkout, 1 otherwise, with
// what to do printed for each mismatch.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pins = JSON.parse(readFileSync(join(root, "deps.json"), "utf8"));
const git = (cwd, ...args) => execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

const names = process.argv.slice(2);
if (!names.length) {
  console.error("usage: node scripts/check-pin.mjs <name> [<name> ...]");
  process.exit(2);
}
let failed = false;
for (const name of names) {
  const pin = pins[name]?.commit;
  const dir = join(root, "deps", name);
  const head = git(dir, "rev-parse", "HEAD");
  const pushed = git(dir, "branch", "-r", "--contains", head) !== "";
  if (!pin) {
    console.log(`${name}: not in deps.json`);
    failed = true;
  } else if (head !== pin) {
    console.log(`${name}: deps.json pins ${pin.slice(0, 7)}, the checkout is at ${head.slice(0, 7)}; ` +
      `run the toolkit's tests against the checkout, then set the pin to ${head} and commit deps.json`);
    failed = true;
  } else if (!pushed) {
    console.log(`${name}: ${head.slice(0, 7)} is pinned but not pushed; push deps/${name}`);
    failed = true;
  } else {
    console.log(`${name}: pinned at ${head.slice(0, 7)}, pushed`);
  }
}
process.exit(failed ? 1 : 0);
