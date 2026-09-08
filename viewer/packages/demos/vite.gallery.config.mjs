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
import { createReadStream, statSync } from 'node:fs';
import { basename, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

const demosDir = fileURLToPath(new URL('./', import.meta.url));
const packagesDir = fileURLToPath(new URL('../', import.meta.url));
const viewerDir = fileURLToPath(new URL('../../', import.meta.url));
const viewerCore = fileURLToPath(new URL('../core/dist/index.js', import.meta.url));

const port = Number(process.env['GALLERY_PORT'] ?? 5190);

// Where the real models are. They are large and private, so they are never copied into the
// repository and never bundled; the dev server hands them out from where they already sit, which
// is the same directory the fixture server's default list starts with.
//
// `V2_FIXTURES_DIRS` overrides it, with the same meaning it has for the fixture server, so a
// machine that keeps its models elsewhere sets one variable rather than editing this file.
const fixtureDirs = (process.env['V2_FIXTURES_DIRS'] ?? '')
  .split(';')
  .map((dir) => dir.trim())
  .filter((dir) => dir.length > 0);
const modelDirs = fixtureDirs.length > 0 ? fixtureDirs : [fileURLToPath(new URL('../visualization/artifacts/bfast/', import.meta.url))];

// Serves `/fixtures/<name>` from the first directory that holds it. A demo asks for a model by
// name, so nothing in the gallery holds an absolute path, and a machine without the model gets a
// 404 the demo reports rather than a broken build.
const serveFixtures = () => ({
  name: 'gallery-fixtures',
  configureServer(server) {
    server.middlewares.use('/fixtures/', (request, response, next) => {
      // `basename` is the whole of the path handling: a fixture is a file in a known directory,
      // never a path, so `..` cannot address anything.
      const name = basename(decodeURIComponent((request.url ?? '').split('?')[0] ?? ''));
      if (name === '') return next();
      for (const dir of modelDirs) {
        const path = join(dir, name);
        try {
          const found = statSync(path);
          if (!found.isFile()) continue;
          response.setHeader('content-type', 'application/octet-stream');
          response.setHeader('content-length', String(found.size));
          createReadStream(path).pipe(response);
          return undefined;
        } catch {
          // Not in this directory; try the next.
        }
      }
      response.statusCode = 404;
      response.end(`No fixture called "${name}" in ${modelDirs.join(', ')}`);
      return undefined;
    });
  },
});

export default defineConfig({
  root: demosDir,
  plugins: [serveFixtures()],
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
