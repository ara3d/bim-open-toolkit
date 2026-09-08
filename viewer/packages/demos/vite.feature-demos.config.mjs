// Serves the feature demo pages (`feature-demos/<id>.html`) from the demos package with the V2
// packages resolved to source.
//
// The alias rule is the one in `viewer/vitest.shared.ts`, copied rather than imported so that a
// vite run never loads a vitest configuration. `@ara3d/viewer-core` resolves from its built dist,
// which is what tsc sees for the alpha packages. Ports: 5181 show-by, 5182 separate, 5183 the HUD
// pages; a browser test passes its own port to `createServer`, so this default only matters for a
// hand-started server.
//
// Run from `viewer/`: npx vite --config packages/demos/vite.feature-demos.config.mjs
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const demosDir = fileURLToPath(new URL('./', import.meta.url));
const packagesDir = fileURLToPath(new URL('../', import.meta.url));
const viewerDir = fileURLToPath(new URL('../../', import.meta.url));
const viewerCore = fileURLToPath(new URL('../core/dist/index.js', import.meta.url));

export default defineConfig({
  root: demosDir,
  server: {
    port: 5181,
    strictPort: true,
    // Sources live outside the root, in the sibling packages.
    fs: { allow: [viewerDir] },
  },
  resolve: {
    alias: [
      { find: /^@bim-open-toolkit\/(?!visualization)([^/]+)$/, replacement: `${packagesDir}$1/src/index.ts` },
      { find: /^@ara3d\/viewer-core$/, replacement: viewerCore },
    ],
  },
});
