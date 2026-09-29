/// <reference types="node" />
// Copies each graph file's card positions into the graph embeds of the sample
// notebooks (see ./embedLayouts). Run from bimopenflow/web/packages/bim-open-notebook
// after relaying out the sample graphs:
//
//   npx vite-node scripts/sync-embed-layouts.ts

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { sampleGraphFiles, staleLayouts, syncLayouts } from "./embedLayouts";
import { ROOT } from "./outline";

const notebooks = join(ROOT, "samples", "notebooks");
for (const file of readdirSync(notebooks).filter((f) => f.endsWith(".notebook.json"))) {
  const path = join(notebooks, file);
  const text = readFileSync(path, "utf8");
  const graphFiles = sampleGraphFiles(file.replace(/\.notebook\.json$/, ""));
  const stale = staleLayouts(text, graphFiles);
  if (stale.length === 0) continue;
  writeFileSync(path, syncLayouts(text, graphFiles));
  console.log(`${file}: moved ${stale.length} card(s)`);
}
