// The static site: notebook.html with the sample notebooks bundled as files,
// for GitHub Pages (https://ara3d.github.io/bim-open-notebook/). No host stands
// behind it; src/page/site.ts turns the page's host features off in this mode.
//
//   npm run build:pages -w @bimopenflow/bim-open-notebook --prefix bimopenflow/web -- --outDir <folder> --emptyOutDir
//
// writes notebook.html, assets/, and notebooks/ (every sample, index.json with
// their file names, catalog.json with one landing-page entry each). The base is
// relative, so the folder works under any path.

import { defineConfig } from "vite";
import { resolve } from "node:path";
import base, { samples } from "./vite.config";
import { bundleSamples } from "./vite/samples";
import { NRC_LEAD } from "./src/page/nrcCatalog";

export default defineConfig({
  ...base,
  mode: "pages",
  base: "./",
  plugins: [bundleSamples(samples, NRC_LEAD)],
  build: {
    outDir: "dist/pages",
    rollupOptions: { input: { notebook: resolve(__dirname, "notebook.html") } },
  },
});
