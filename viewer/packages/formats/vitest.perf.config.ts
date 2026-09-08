// Performance tests are explicit and long-running: `npm run perf -w <package>`.
// They are named *.perf.ts so the default test run never picks them up.
import { mergeConfig } from 'vitest/config';
import shared from '../../vitest.shared.js';

export default mergeConfig(shared, {
  test: { include: ['test/perf/**/*.perf.ts'], testTimeout: 120_000, hookTimeout: 120_000, fileParallelism: false },
});
