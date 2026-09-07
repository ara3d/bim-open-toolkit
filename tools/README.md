# tools

Command-line tools and probes that are not part of a published package.

- `bim-data-model`, `building-model-source-probe`, `building-model-workflows`: C# tools with their own READMEs.
- `platonic-mcp.mts` starts the platonic-ts MCP server (sibling checkout `../platonic-ts`) over the `viewer/` workspace. Registered in `.mcp.json`; run by hand with `node ../platonic-ts/node_modules/tsx/dist/cli.mjs tools/platonic-mcp.mts`.
- `platonic-check.mts` runs the platonic-ts check gate (typecheck, lint, escape-hatch ratchet, V2 tests) over `viewer/`. Run with `node ../platonic-ts/node_modules/tsx/dist/cli.mjs tools/platonic-check.mts`.

The platonic wrappers exist because the platonic-ts entry points target their own repository. The `.mts` extension makes tsx load them as ES modules, since this repository root has no `package.json`. See `docs/plans/visualization/V2-PLAN.md`, section Toolset.
