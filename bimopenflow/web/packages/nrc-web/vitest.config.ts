import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { viewerAlias } from "../../viewer.config";
import { flowAlias, notebookAlias } from "../../deps.config";

// The same gratify source alias as packages/app/vitest.config.ts.
const gratify = fileURLToPath(
  new URL("../../../../deps/gratify/src/gratify", import.meta.url),
);

export default defineConfig({
  resolve: { alias: [...viewerAlias, ...flowAlias, ...notebookAlias, { find: "gratify", replacement: gratify }], dedupe: ["three"] },
  test: { environment: "jsdom" },
});
