import { fileURLToPath } from "node:url";

// The editor and the viewer (deps/bim-open-viewer, see deps.json) develop together: the viewer's
// packages resolve to their source entry points, so no stale dist is read. The three alpha
// packages (core, controls, loaders) are left out and resolve through node_modules to their
// built dist, as they do inside the viewer's own workspace.
export const viewerAlias = {
  find: /^@bim-open-viewer\/(?!(?:core|controls|loaders)$)([^/]+)$/,
  replacement: fileURLToPath(new URL("../../deps/bim-open-viewer/packages/", import.meta.url)) + "$1/src/index.ts",
};
