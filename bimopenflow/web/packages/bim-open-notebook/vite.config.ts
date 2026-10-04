import { defineConfig } from "vite";
import { resolve } from "node:path";
import { viewerAlias } from "../../viewer.config";
import { flowAlias } from "../../flow.config";
import { sampleNotebooks } from "./vite/samples";

const gratify = resolve(__dirname, "../../../../deps/gratify/src/gratify");
/** The committed sample notebooks, served in dev and copied into the static site (vite.pages.config.ts). */
export const samples = resolve(__dirname, "../../../../samples/notebooks");

// The notebook talks to one host through /api. The default is the tables
// profile of scripts/start-bim-flow.mjs; point BOF_HOST at the studio host
// (bimopenflow-studio) for the request box, which needs /api/ask. Port 5350
// belongs to BIM Open Toolkit's notebook and NRC pages, so this one defaults to 5354.
const host = process.env.BOF_HOST ?? "http://127.0.0.1:5224";
const port = Number(process.env.NOTEBOOK_PORT ?? 5354);

export default defineConfig({
  plugins: [sampleNotebooks(samples)],
  build: {
    rollupOptions: { input: { notebook: resolve(__dirname, "notebook.html") } },
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
