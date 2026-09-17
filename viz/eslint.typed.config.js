// Type-aware lint for the packages that do I/O, where unhandled promises are a real risk.
// Slow (builds a TypeScript program per run), so it runs at wave integration, not per chunk:
// `npm run lint:typed`. Extend `ioPackages` when a new package gains I/O.
import tseslint from 'typescript-eslint'

const ioPackages = ['demos', 'mcp', 'viewer', 'ui-react']
const files = ioPackages.flatMap((name) => [`packages/${name}/src/**/*.ts`, `packages/${name}/test/**/*.ts`])

export default tseslint.config(
  { ignores: ['node_modules/**', '**/dist/**'] },
  ...tseslint.configs.recommendedTypeChecked.map((config) => ({ ...config, files })),
  {
    files,
    languageOptions: { parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname } },
    rules: { '@typescript-eslint/no-floating-promises': 'error' },
  },
)
