import { fileURLToPath } from "node:url";

const packagesDir = fileURLToPath(new URL("../../deps/bim-open-viewer/packages/", import.meta.url));

// The editor and the viewer (deps/bim-open-viewer, see deps.json) develop together: the viewer's
// packages resolve to their source entry points, so no stale dist is read. The three alpha
// packages (core, controls, loaders) resolve to their built dist, as they do inside the viewer's
// own workspace, through their package folder rather than node_modules: a file reached in
// deps/ (the 3D pane, from deps/bim-open-notebook) resolves bare imports from its real path,
// where this workspace's node_modules is not on the way up.
export const viewerAlias = [
  { find: /^@bim-open-viewer\/(?!(?:core|controls|loaders)$)([^/]+)$/, replacement: `${packagesDir}$1/src/index.ts` },
  { find: /^@bim-open-viewer\/(core|controls|loaders)$/, replacement: `${packagesDir}$1` },
];
