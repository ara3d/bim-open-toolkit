// Serves `gallery.html` from the demos package with the V2 packages resolved to source.
//
// The alias rule is the one in `viewer/vitest.shared.ts`, copied rather than imported so that a
// vite run never loads a vitest configuration. `@ara3d/viewer-core` resolves from its built dist,
// which is what tsc sees for the alpha packages.
//
// Port 5190 belongs to Track GAL. A demo track passes its own port, either to `createServer` in the
// smoke run (GALLERY_PORT) or on the command line, so two tracks never fight over one socket.
//
// Run from `viewer/`: npx vite --config packages/demos/vite.gallery.config.mjs
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const demosDir = fileURLToPath(new URL('./', import.meta.url));
const packagesDir = fileURLToPath(new URL('../', import.meta.url));
const viewerDir = fileURLToPath(new URL('../../', import.meta.url));
const viewerCore = fileURLToPath(new URL('../core/dist/index.js', import.meta.url));

const port = Number(process.env['GALLERY_PORT'] ?? 5190);

export default defineConfig({
  root: demosDir,
  server: {
    port,
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
