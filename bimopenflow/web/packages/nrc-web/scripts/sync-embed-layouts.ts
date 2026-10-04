/// <reference types="node" />
// Copies each graph file's card positions into the graph embeds of the
// toolkit's sample notebooks: the notebook package's
// scripts/sync-embed-layouts.ts over samples/notebooks and samples/nrc-analyses.
// Run from bimopenflow/web/packages/nrc-web after relaying out the sample
// graphs; no host is needed:
//
//   npx vite-node scripts/sync-embed-layouts.ts

import { fileURLToPath } from "node:url";
import { runNotebookScript } from "./notebookScript";

const folder = (path: string): string => fileURLToPath(new URL(`../../../../../${path}`, import.meta.url));

process.exitCode = runNotebookScript("sync-embed-layouts.ts", [
  "--samples",
  folder("samples/notebooks"),
  "--analyses",
  folder("samples/nrc-analyses"),
]);
