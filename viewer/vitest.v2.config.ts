// V2 test run: `npm run test:v2`. Named so per-package vitest runs in the alpha packages do not pick it up.
import { mergeConfig } from 'vitest/config';
import shared, { v2Packages } from './vitest.shared.js';

export default mergeConfig(shared, {
  test: { include: v2Packages.map((name) => `packages/${name}/test/**/*.test.ts`) },
});
