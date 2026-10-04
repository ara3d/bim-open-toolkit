/// <reference types="node" />
// Copies each graph file's card positions into the graph embeds of the sample
// notebooks (see ./embedLayouts). Run from bimopenflow/web/packages/bim-open-notebook
// after relaying out the sample graphs, naming the notebooks' folder and every
// folder of graphs they embed (--analyses repeats):
//
//   npx vite-node scripts/sync-embed-layouts.ts -- --samples ../../../../samples/notebooks \
//     --analyses ../../../../samples/nrc-analyses

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { NOTEBOOK_EXTENSION } from "../src/document/format";
import { sampleGraphFiles, staleLayouts, syncLayouts } from "./embedLayouts";

/** The values given for `name`, each resolved against the working directory. */
const options = (name: string): string[] =>
  process.argv.flatMap((arg, i) => (arg === name && process.argv[i + 1] ? [resolve(process.argv[i + 1]!)] : []));

const [samples] = options("--samples");
const analyses = options("--analyses");
if (samples === undefined) throw new Error("missing --samples; see the header of scripts/sync-embed-layouts.ts");

for (const file of readdirSync(samples).filter((f) => f.endsWith(NOTEBOOK_EXTENSION))) {
  const path = join(samples, file);
  const text = readFileSync(path, "utf8");
  const graphFiles = sampleGraphFiles(file.slice(0, -NOTEBOOK_EXTENSION.length), samples, analyses);
  const stale = staleLayouts(text, graphFiles);
  if (stale.length === 0) continue;
  writeFileSync(path, syncLayouts(text, graphFiles));
  console.log(`${file}: moved ${stale.length} card(s)`);
}
