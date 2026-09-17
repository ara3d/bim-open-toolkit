// Performance tests are explicit and long-running: `npm run perf -w @bim-open-toolkit/testing`.
// They are named *.perf.ts so the default test run never picks them up. Workers get --expose-gc
// so heap measurements can force a collection between repetitions.
import { mergeConfig } from 'vitest/config';
import shared from '../../vitest.shared.js';

export default mergeConfig(shared, {
  test: {
    include: ['test/perf/**/*.perf.ts'],
    testTimeout: 120_000,
    hookTimeout: 120_000,
    fileParallelism: false,
    poolOptions: { forks: { execArgv: ['--expose-gc'] } },
  },
});
