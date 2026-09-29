// Performance tests are explicit and long-running: `npm run perf -w @bim-open-toolkit/viewer`.
// They are named *.perf.ts so the default test run never picks them up.
import { mergeConfig } from 'vitest/config';
import shared from '../../vitest.shared.js';

export default mergeConfig(shared, {
  test: { include: ['test/perf/**/*.perf.ts'], testTimeout: 300_000, hookTimeout: 300_000, fileParallelism: false },
});
