# BimOpenToolkit.Layering.Tests

Checks that the folder groups stay layered. It parses every `.csproj` under
`src`, `tests`, `plugins`, and `tools` and fails on a project reference that
points up: `flow` may reference `data`, `mcp` adds `flow`, `studio` may
reference all three, and `plugins` and `tools` sit on `data`. The `data`
layer is bim-open-data, reached as `$(DepsRoot)bim-open-data/src/data/...`;
every other dependency under `deps/` (the engine among them) is external and allowed. It also fails if any package
under `deps/bim-open-viewer/packages` depends on an `@bimopenflow/*` package.

- `LayeringTests.cs`: the folder rules, in the `Allowed` table. Extending the
  layout means extending that table in the same commit.
- `FlowLayeringTests.cs`: the seams of the BIM packs in `src/flow` (packs, run records).
  A reference into `deps/bim-open-flow/src/<group>` counts as that group.
- `WebSeamTests.cs`: the notebook's vitest layering file, which keeps the 3D pane
  out of its embeds, still exists and names what it forbids. The rules that kept
  BIM out of the generic graph tool moved with it to bim-open-flow's layering test.
