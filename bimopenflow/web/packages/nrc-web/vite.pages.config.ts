// The static NRC walkthrough site, for GitHub Pages (https://ara3d.github.io/nrc-ifc-llm/):
// nrc.html (the landing page), notebook.html, and every sample notebook as files, with no
// host behind them. The notebook package's `bundleSamples` writes the notebooks, their
// catalog, and the model files their 3D views name; the page code switches its host
// features off in this mode (the notebook's src/page/site.ts, and src/nrc.ts here).
//
//   npm run build:pages -w @bimopenflow/nrc-web --prefix bimopenflow/web
//
// writes artifacts/nrc-site (git-ignored): index.html (a redirect to nrc.html), nrc.html,
// notebook.html, assets/, graphs.md (the graph list), NOTICE.md (the building licences),
// and notebooks/: every notebook in samples/notebooks except the ones in OMITTED,
// index.json, catalog.json, node-catalog.json (docs/nodes.catalog.json, so graph cells
// draw their wires), and models/ (the .bos files the 3D views name). The base is relative,
// so the folder works under any path. gates/nrc-pages-smoke.mjs checks it.

import { defineConfig, type Plugin } from "vite";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { resolve } from "node:path";
import base from "./vite.config";
// By relative path into deps/, for the reason given in vite.config.ts.
import { bundleSamples } from "../../../../deps/bim-open-notebook/bimopenflow/web/packages/bim-open-notebook/vite/samples";
import { parseNotebook } from "../../../../deps/bim-open-notebook/bimopenflow/web/packages/bim-open-notebook/src/document/io";
import { MODELS_FOLDER, modelFileName, modelFiles } from "../../../../deps/bim-open-notebook/bimopenflow/web/packages/bim-open-notebook/src/document/paths";
import { NOTICE_FILE, STATIC_NODE_CATALOG } from "../../../../deps/bim-open-notebook/bimopenflow/web/packages/bim-open-notebook/src/page/sitePaths";
import { NRC_LEAD } from "./src/nrcCatalog";

const repo = resolve(__dirname, "../../../..");
const notebookRepo = resolve(repo, "deps/bim-open-notebook");

/** The notebooks to publish; NRC_PAGES_SAMPLES points the build at another folder (to try one out). */
const samples = process.env.NRC_PAGES_SAMPLES ? resolve(process.env.NRC_PAGES_SAMPLES) : resolve(repo, "samples/notebooks");
/**
 * Where the notebooks' 3D views find the models they name as models/<file>, first match wins: the
 * NRC enriched Duplex (samples/nrc, which the host converts from the IFC file), then the public
 * buildings of bim-open-data.
 */
const MODEL_FOLDERS = [resolve(repo, "samples/nrc"), resolve(repo, "deps/bim-open-data/samples/public")];
/**
 * The notebooks that stay out of the site: s10-snowdon works on the Snowdon Towers model (CC BY-NC-SA 3.0,
 * private), and s11-editing-history is kept out by the owner's plan for the NRC notebooks
 * (nrc/paper/planning/notebooks-plan.md, section 4).
 */
const OMITTED = ["s10-snowdon.notebook.json", "s11-editing-history.notebook.json"];
/** The folder the site is written to, and the scratch folder the notebooks to publish are gathered in. */
const outDir = resolve(repo, "artifacts/nrc-site");
const stage = resolve(repo, "artifacts/nrc-site-stage");
const stageModels = resolve(stage, MODELS_FOLDER);

/** The model files the staged notebooks name, each with the first notebook that names it; a path of another shape stops the build. */
function namedModels(plugin: { error: (message: string) => never }): Map<string, string> {
  const named = new Map<string, string>();
  for (const name of readdirSync(stage).filter((f) => f.endsWith(".notebook.json"))) {
    const parsed = parseNotebook(readFileSync(resolve(stage, name), "utf8"));
    if (!parsed.ok) plugin.error(`${name} is not a valid notebook: ${parsed.errors.join("; ")}`);
    else
      for (const path of modelFiles(parsed.notebook)) {
        const file = modelFileName(path);
        if ("problem" in file) plugin.error(`${name}: ${file.problem}`);
        else if (!named.has(file.file)) named.set(file.file, name);
      }
  }
  return named;
}

/**
 * Gathers what `bundleSamples` reads into one folder: every notebook in the samples folder
 * but the OMITTED ones, the node catalog as node-catalog.json, and in models/ each model file
 * a notebook's 3D view names, found in MODEL_FOLDERS. Runs before the bundle is generated,
 * and removes the folder after.
 */
function stageNotebooks(): Plugin {
  return {
    name: "stage-nrc-notebooks",
    buildStart() {
      rmSync(stage, { recursive: true, force: true });
      mkdirSync(stage, { recursive: true });
      for (const name of readdirSync(samples).filter((f) => f.endsWith(".notebook.json") && !OMITTED.includes(f)))
        copyFileSync(resolve(samples, name), resolve(stage, name));
      copyFileSync(resolve(repo, "docs/nodes.catalog.json"), resolve(stage, STATIC_NODE_CATALOG));
      for (const [file, notebook] of namedModels(this)) {
        const found = MODEL_FOLDERS.map((folder) => resolve(folder, file)).find(existsSync);
        if (!found)
          this.error(`${notebook} names ${MODELS_FOLDER}${file}, which is in none of ${MODEL_FOLDERS.join(", ")}. samples/nrc/*.bos are built by the host from the IFC file and not committed; build or commit the file first.`);
        else {
          mkdirSync(stageModels, { recursive: true });
          copyFileSync(found, resolve(stageModels, file));
        }
      }
    },
    closeBundle() {
      rmSync(stage, { recursive: true, force: true });
    },
  };
}

/** Emits the files that sit beside the pages: the graph list, the licences, and index.html, which sends a visitor to nrc.html. */
function siteFiles(): Plugin {
  return {
    name: "nrc-site-files",
    generateBundle() {
      const emit = (fileName: string, source: string) => this.emitFile({ type: "asset", fileName, source });
      emit("graphs.md", readFileSync(resolve(repo, "samples/nrc-analyses/README.md"), "utf8"));
      emit(NOTICE_FILE, readFileSync(resolve(notebookRepo, "NOTICE.md"), "utf8"));
      emit("index.html", '<!doctype html>\n<meta charset="utf-8">\n<meta http-equiv="refresh" content="0; url=nrc.html">\n<title>NRC walkthrough</title>\n<a href="nrc.html">NRC walkthrough</a>\n');
    },
  };
}

export default defineConfig({
  ...base,
  mode: "pages",
  base: "./",
  plugins: [stageNotebooks(), bundleSamples(stage, NRC_LEAD, { models: stageModels }), siteFiles()],
  build: { ...base.build, outDir, emptyOutDir: true },
  server: undefined,
});
