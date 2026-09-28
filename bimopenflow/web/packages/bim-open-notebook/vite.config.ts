import { defineConfig, type Plugin } from "vite";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { resolve, basename } from "node:path";
import { toolkitAlias } from "../../toolkit.config";

const gratify = resolve(__dirname, "../../../../submodules/gratify/src/gratify");
const samples = resolve(__dirname, "../../../../samples/notebooks");

// The notebook talks to one host through /api. The default is the tables
// profile of scripts/start-bim-flow.mjs; point BOF_HOST at the studio host
// (bimopenflow-studio) for the request box, which needs /api/ask.
const host = process.env.BOF_HOST ?? "http://127.0.0.1:5224";
const port = Number(process.env.NOTEBOOK_PORT ?? 5350);

const NOTEBOOK_SUFFIX = ".notebook.json";

/**
 * Serves the committed sample notebooks in dev: GET /__notebooks/ lists their
 * names, GET /__notebooks/<name> returns one. Read-only; saving goes through
 * the browser's download.
 */
function sampleNotebooks(): Plugin {
  return {
    name: "sample-notebooks",
    configureServer(server) {
      server.middlewares.use("/__notebooks", (req, res) => {
        const name = decodeURIComponent((req.url ?? "/").replace(/^\/+/, "").split("?")[0]);
        res.setHeader("content-type", "application/json");
        if (name === "") {
          const names = existsSync(samples)
            ? readdirSync(samples).filter((f) => f.endsWith(NOTEBOOK_SUFFIX)).sort()
            : [];
          res.end(JSON.stringify(names));
          return;
        }
        const file = resolve(samples, basename(name));
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

export default defineConfig({
  plugins: [sampleNotebooks()],
  build: { rollupOptions: { input: { notebook: resolve(__dirname, "notebook.html") } } },
  resolve: { alias: [toolkitAlias, { find: "gratify", replacement: gratify }], dedupe: ["three"] },
  server: {
    // IPv4 loopback explicitly, for the reason given in packages/app/vite.config.ts.
    host: "127.0.0.1",
    port,
    strictPort: true,
    fs: { allow: [resolve(__dirname, "../../../..")] },
    proxy: { "/api": host },
  },
});
