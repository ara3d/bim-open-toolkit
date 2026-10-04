import { defineConfig, type Plugin } from "vite";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { viewerAlias } from "../../viewer.config";
import { flowAlias } from "../../flow.config";
import { sampleNotebooks } from "./vite/samples";

const gratify = resolve(__dirname, "../../../../deps/gratify/src/gratify");
/** The committed sample notebooks, served in dev and copied into the static site (vite.pages.config.ts). */
export const samples = resolve(__dirname, "../../../../samples/notebooks");
const nrcGraphsReadme = resolve(__dirname, "../../../../samples/nrc-analyses/README.md");

// The notebook talks to one host through /api. The default is the tables
// profile of scripts/start-bim-flow.mjs; point BOF_HOST at the studio host
// (bimopenflow-studio) for the request box, which needs /api/ask.
const host = process.env.BOF_HOST ?? "http://127.0.0.1:5224";
const port = Number(process.env.NOTEBOOK_PORT ?? 5350);

/**
 * Serves the README of samples/nrc-analyses at GET /__nrc/graphs.md, the
 * source of the graph list on nrc.html (src/page/nrcCatalog.ts parses its table).
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
  build: {
    rollupOptions: {
      input: { notebook: resolve(__dirname, "notebook.html"), nrc: resolve(__dirname, "nrc.html") },
    },
  },
  resolve: { alias: [viewerAlias, ...flowAlias, { find: "gratify", replacement: gratify }], dedupe: ["three"] },
  server: {
    // IPv4 loopback explicitly, for the reason given in packages/app/vite.config.ts.
    host: "127.0.0.1",
    port,
    strictPort: true,
    fs: { allow: [resolve(__dirname, "../../../..")] },
    proxy: { "/api": host },
  },
});
