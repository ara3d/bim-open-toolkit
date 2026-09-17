// Shared vitest configuration for the V2 packages: sibling @bim-open-toolkit packages resolve to
// source so no build order is needed for tests. The alpha @ara3d packages resolve through their
// built dist, matching what tsc sees, so build them before running V2 tests.
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export const v2Packages = ['model', 'synthetic', 'formats', 'render', 'interact', 'features', 'workflows', 'viewer', 'ui-gratify', 'ui-react', 'mcp', 'testing', 'demos'] as const;

const packagesDir = fileURLToPath(new URL('./packages/', import.meta.url));

export default defineConfig({
  resolve: {
    alias: [{ find: /^@bim-open-toolkit\/(?!visualization)([^/]+)$/, replacement: `${packagesDir}$1/src/index.ts` }],
  },
});
