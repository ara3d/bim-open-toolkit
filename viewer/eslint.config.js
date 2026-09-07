// Installed by `platonic init`, then scoped to the V2 packages: the alpha packages (core,
// controls, loaders, visualization) are not linted and are removed at the wave 4 cutover.
import tseslint from 'typescript-eslint'

const v2Files = ['packages/*/src/**/*.ts', 'packages/*/test/**/*.ts']
const alpha = ['packages/core/**', 'packages/controls/**', 'packages/loaders/**', 'packages/visualization/**']

export default tseslint.config(
  { ignores: ['node_modules/**', '**/dist/**', 'build/**', 'coverage/**', ...alpha] },
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({
    ...config,
    files: v2Files,
  })),
  {
    files: v2Files,
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
    },
  },
)
