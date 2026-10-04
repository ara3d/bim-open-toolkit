import { defineConfig } from "vitest/config";
import { viewerAlias } from "../../viewer.config";
import { flowAlias } from "../../flow.config";

export default defineConfig({
  resolve: { alias: [viewerAlias, ...flowAlias], dedupe: ["three"] },
  test: {
    environment: "jsdom",
  },
});
