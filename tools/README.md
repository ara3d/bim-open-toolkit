# tools

Command-line tools and probes that are not part of a published package.

- The C# tools that were here (`bim-data-model`, `building-model-source-probe`, `building-model-workflows`, and `Ara3D.IfcTypeGen`, the generator behind `Ara3D.IfcTypes`) moved to [bim-open-data](https://github.com/ara3d/bim-open-data) on 2026-10-03; in a checkout they are under `deps/bim-open-data/tools/`. The Snowdon prepare step runs `deps/bim-open-data/tools/building-model-workflows/run-samples.ps1 -OutputRoot artifacts/building-model-workflows`.
- `platonic-mcp.mts` starts the platonic-ts MCP server (sibling checkout `../platonic-ts`) over the `deps/bim-open-viewer/` workspace. Registered in `.mcp.json`; run by hand with `node ../platonic-ts/node_modules/tsx/dist/cli.mjs tools/platonic-mcp.mts`.
- `platonic-check.mts` runs the platonic-ts check gate (typecheck, lint, escape-hatch ratchet, V2 tests) over `deps/bim-open-viewer/`. Run with `node ../platonic-ts/node_modules/tsx/dist/cli.mjs tools/platonic-check.mts`.

The platonic wrappers exist because the platonic-ts entry points target their own repository. The `.mts` extension makes tsx load them as ES modules, since this repository root has no `package.json`. See `docs/plans/visualization/V2-PLAN.md`, section Toolset.
