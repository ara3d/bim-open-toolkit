/// <reference types="node" />
// Runs one of the notebook package's command-line scripts under vite-node,
// in the working directory, so this package's vite.config.ts supplies the
// aliases and relative paths on the command line keep their meaning. The
// notebook is found by Node's resolution, so the path holds wherever the
// package is installed from.

import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);

/** The path of `name` in the notebook package's scripts/ folder. */
export function notebookScript(name: string): string {
  const entry = require.resolve("@bimopenflow/bim-open-notebook"); // <package>/src/index.ts
  return join(dirname(dirname(entry)), "scripts", name);
}

/** Runs the notebook's script `name` with `args` and returns its exit code. */
export function runNotebookScript(name: string, args: readonly string[]): number {
  const viteNode = require.resolve("vite-node/vite-node.mjs");
  const result = spawnSync(process.execPath, [viteNode, notebookScript(name), "--", ...args], { stdio: "inherit" });
  if (result.error) throw result.error;
  return result.status ?? 1;
}
