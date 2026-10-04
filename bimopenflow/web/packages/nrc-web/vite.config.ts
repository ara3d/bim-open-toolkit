import { defineConfig, type Plugin } from "vite";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { viewerAlias } from "../../viewer.config";
import { flowAlias, notebookAlias } from "../../deps.config";
// By relative path into deps/bim-open-notebook, not "@bimopenflow/bim-open-notebook/vite":
// Node loads this config, and Node cannot load a bare .ts specifier; a relative one is bundled.
import { sampleNotebooks } from "../../../../deps/bim-open-notebook/bimopenflow/web/packages/bim-open-notebook/vite/samples";

const repo = resolve(__dirname, "../../../..");
const gratify = resolve(repo, "deps/gratify/src/gratify");
/** The notebook package, whose public/ folder holds the favicon. */
const notebookPackage = resolve(repo, "deps/bim-open-notebook/bimopenflow/web/packages/bim-open-notebook");
/** The toolkit's sample notebooks, served at /__notebooks/. */
const samples = resolve(repo, "samples/notebooks");
const nrcGraphsReadme = resolve(repo, "samples/nrc-analyses/README.md");

// The pages talk to one host through /api. The default is the tables profile
// of scripts/start-bim-flow.mjs; point BOF_HOST at the studio host
// (bimopenflow-studio) for the request box, which needs /api/ask.
const host = process.env.BOF_HOST ?? "http://127.0.0.1:5224";
const port = Number(process.env.NOTEBOOK_PORT ?? 5350);

/**
 * Serves the README of samples/nrc-analyses at GET /__nrc/graphs.md, the
 * source of the graph list on nrc.html (src/nrcCatalog.ts parses its table).
 */
function nrcGraphs(): Plugin {
  return {
    name: "nrc-graphs",
    configureServer(server) {
      server.middlewares.use("/__nrc/graphs.md", (_req, res) => {
        res.setHeader("content-type", "text/markdown; charset=utf-8");
        if (!existsSync(nrcGraphsReadme)) {
          res.statusCode = 404;
          res.end("No samples/nrc-analyses/README.md");
          return;
        }
        res.end(readFileSync(nrcGraphsReadme, "utf8"));
      });
    },
  };
}

export default defineConfig({
  plugins: [sampleNotebooks(samples), nrcGraphs()],
  publicDir: resolve(notebookPackage, "public"),
  build: {
    rollupOptions: {
      input: { notebook: resolve(__dirname, "notebook.html"), nrc: resolve(__dirname, "nrc.html") },
    },
  },
  resolve: { alias: [...viewerAlias, ...flowAlias, ...notebookAlias, { find: "gratify", replacement: gratify }], dedupe: ["three"] },
  server: {
    // IPv4 loopback explicitly, for the reason given in packages/app/vite.config.ts.
    host: "127.0.0.1",
    port,
    strictPort: true,
    fs: { allow: [repo] },
    proxy: { "/api": host },
  },
});
