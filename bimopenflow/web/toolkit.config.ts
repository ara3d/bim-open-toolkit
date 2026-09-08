import { fileURLToPath } from "node:url";

// Both workspaces develop together; use public source entry points without stale dist files.
export const toolkitAlias = {
  find: /^@bim-open-toolkit\/([^/]+)$/,
  replacement: fileURLToPath(new URL("../../viewer/packages/", import.meta.url)) + "$1/src/index.ts",
};
