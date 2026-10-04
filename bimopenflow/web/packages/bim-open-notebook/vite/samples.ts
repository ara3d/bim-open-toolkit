/// <reference types="node" />
// The Vite plugins that hand a page its sample notebooks, exported as
// "@bimopenflow/bim-open-notebook/vite". The caller names the folder of
// *.notebook.json files and, for the static build, which notebooks lead the
// landing-page catalog; nothing here knows which repository it runs in.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import type { Plugin } from "vite";
import { NOTEBOOK_EXTENSION } from "../src/document/format";
import { notebookEntry, orderNotebooks, type NotebookEntry } from "../src/page/catalog";
import { STATIC_CATALOG, STATIC_INDEX, STATIC_SAMPLES } from "../src/page/sitePaths";

export const NOTEBOOK_SUFFIX = NOTEBOOK_EXTENSION;

/** The notebook file names in `dir`, sorted; empty when the folder does not exist. */
function notebookFiles(dir: string): string[] {
  return existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith(NOTEBOOK_SUFFIX)).sort() : [];
}

/**
 * Serves the notebooks in `dir` in dev: GET /__notebooks/ lists their names,
 * GET /__notebooks/<name> returns one. Read-only; saving goes through the
 * browser's download.
 */
export function sampleNotebooks(dir: string): Plugin {
  return {
    name: "sample-notebooks",
    configureServer(server) {
      server.middlewares.use("/__notebooks", (req, res) => {
        const name = decodeURIComponent((req.url ?? "/").replace(/^\/+/, "").split("?")[0]);
        res.setHeader("content-type", "application/json");
        if (name === "") {
          res.end(JSON.stringify(notebookFiles(dir)));
          return;
        }
        const file = resolve(dir, basename(name));
        if (!file.endsWith(NOTEBOOK_SUFFIX) || !existsSync(file)) {
          res.statusCode = 404;
          res.end(JSON.stringify({ error: `No sample notebook ${name}` }));
          return;
        }
        res.end(readFileSync(file, "utf8"));
      });
    },
  };
}

/**
 * Emits every notebook in `dir` under notebooks/ (sitePaths.ts), with
 * index.json (the file names) and catalog.json (one NotebookEntry each, the
 * `lead` names first). A notebook that does not parse fails the build.
 */
export function bundleSamples(dir: string, lead: readonly string[] = []): Plugin {
  return {
    name: "bundle-sample-notebooks",
    generateBundle() {
      const names = notebookFiles(dir);
      const entries: NotebookEntry[] = [];
      for (const name of names) {
        const text = readFileSync(resolve(dir, name), "utf8");
        const entry = notebookEntry(name, text);
        if ("errors" in entry) this.error(`${name} is not a valid notebook: ${entry.errors.join("; ")}`);
        entries.push(entry);
        this.emitFile({ type: "asset", fileName: `${STATIC_SAMPLES}${name}`, source: text });
      }
      const json = (value: unknown) => JSON.stringify(value, null, 2) + "\n";
      this.emitFile({ type: "asset", fileName: `${STATIC_SAMPLES}${STATIC_INDEX}`, source: json(names) });
      this.emitFile({ type: "asset", fileName: `${STATIC_SAMPLES}${STATIC_CATALOG}`, source: json(orderNotebooks(entries, lead)) });
    },
  };
}
