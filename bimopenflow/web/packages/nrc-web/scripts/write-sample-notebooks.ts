/// <reference types="node" />
// Writes one of the toolkit's sample notebooks: the notebook package's
// scripts/write-sample-notebooks.ts (its header gives the options), with
// {SNOWDON} filled from the toolkit's Snowdon model when one is found
// (snowdon.ts). Run from bimopenflow/web/packages/nrc-web:
//
//   npx vite-node scripts/write-sample-notebooks.ts -- --host http://127.0.0.1:5224 \
//     --outline ../../../../samples/notebooks/outlines/nrc-eight-questions.outline.json

import { runNotebookScript } from "./notebookScript";
import { snowdonPath, withSnowdonPlaceholder } from "./snowdon";

process.exitCode = runNotebookScript("write-sample-notebooks.ts", withSnowdonPlaceholder(process.argv.slice(2), snowdonPath()));
