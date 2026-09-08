// Installed by `platonic init`, then scoped to the V2 packages and switched to the untyped rule
// set (decision 2026-09-07, see docs/plans/visualization/TOOLING-LEDGER.md): type-aware rules
// rebuild a TypeScript program on every run, cost 8 to 28 s per package regardless of file
// count, and caught nothing that tsc did not. This run takes about 2 s for every V2 package.
// The type-aware rules that matter for I/O code run separately: `npm run lint:typed`
// (eslint.typed.config.js) over the packages that do I/O, at wave integration only.
import tseslint from 'typescript-eslint'

export const v2Files = ['packages/*/src/**/*.ts', 'packages/*/test/**/*.ts']
export const alphaPackages = ['packages/core/**', 'packages/controls/**', 'packages/loaders/**', 'packages/visualization/**']

export default tseslint.config(
  { ignores: ['node_modules/**', '**/dist/**', 'build/**', 'coverage/**', ...alphaPackages] },
  ...tseslint.configs.recommended.map((config) => ({
    ...config,
    files: v2Files,
  })),
  {
    files: v2Files,
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
)
