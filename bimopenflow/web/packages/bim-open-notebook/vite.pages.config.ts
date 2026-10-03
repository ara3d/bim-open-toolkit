// The static site: notebook.html with the sample notebooks bundled as files,
// for GitHub Pages (https://ara3d.github.io/bim-open-notebook/). No host stands
// behind it; src/page/site.ts turns the page's host features off in this mode.
//
//   npm run build:pages -w @bimopenflow/bim-open-notebook --prefix bimopenflow/web -- --outDir <folder> --emptyOutDir
//
// writes notebook.html, assets/, and notebooks/ (every sample, index.json with
// their file names, catalog.json with one landing-page entry each). The base is
// relative, so the folder works under any path.

import { defineConfig, type Plugin } from "vite";
import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import base, { NOTEBOOK_SUFFIX, samples } from "./vite.config";
import { notebookEntry, orderNotebooks, type NotebookEntry } from "./src/page/nrcCatalog";
import { STATIC_CATALOG, STATIC_INDEX, STATIC_SAMPLES } from "./src/page/sitePaths";

/** Emits every sample notebook under notebooks/, with the two indexes the page and a landing page read. */
function bundleSamples(): Plugin {
  return {
    name: "bundle-sample-notebooks",
    generateBundle() {
      const names = readdirSync(samples).filter((f) => f.endsWith(NOTEBOOK_SUFFIX)).sort();
      const entries: NotebookEntry[] = [];
      for (const name of names) {
        const text = readFileSync(resolve(samples, name), "utf8");
        const entry = notebookEntry(name, text);
        if ("errors" in entry) this.error(`${name} is not a valid notebook: ${entry.errors.join("; ")}`);
        entries.push(entry);
        this.emitFile({ type: "asset", fileName: `${STATIC_SAMPLES}${name}`, source: text });
      }
      const json = (value: unknown) => JSON.stringify(value, null, 2) + "\n";
      this.emitFile({ type: "asset", fileName: `${STATIC_SAMPLES}${STATIC_INDEX}`, source: json(names) });
      this.emitFile({ type: "asset", fileName: `${STATIC_SAMPLES}${STATIC_CATALOG}`, source: json(orderNotebooks(entries)) });
    },
  };
}

export default defineConfig({
  ...base,
  mode: "pages",
  base: "./",
  plugins: [bundleSamples()],
  build: {
    outDir: "dist/pages",
    rollupOptions: { input: { notebook: resolve(__dirname, "notebook.html") } },
  },
});
