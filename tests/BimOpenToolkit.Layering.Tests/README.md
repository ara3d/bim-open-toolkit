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
- `WebSeamTests.cs`: the web seam now lives in `deps/bim-open-notebook`. Its vitest
  layering file (which keeps the 3D pane out of the notebook's embeds), the shared
  `seam.ts`, and the two `seam.test.ts` files still exist and name what they forbid. The
  rules that kept BIM out of the generic graph tool moved to bim-open-flow's layering test.
- `DepsCycleTests.cs`: fails if any `deps/*/deps.json` pins `bim-open-toolkit`, so no
  dependency loops back.
