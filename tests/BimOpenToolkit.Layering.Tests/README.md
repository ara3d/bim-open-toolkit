# BimOpenToolkit.Layering.Tests

Checks that the folder groups stay layered. It parses every `.csproj` under
`src`, `tests`, `plugins`, and `tools` and fails on a project reference that
points up: `flow` may reference `data`, `mcp` adds `flow`, `studio` may
reference all three, and `plugins` and `tools` sit on `data`. The `data`
layer is bim-open-data, reached as `$(DepsRoot)bim-open-data/src/data/...`;
every other dependency (`deps/`, `submodules/`) is external and allowed. It also fails if any package
under `deps/bim-open-viewer/packages` depends on an `@bimopenflow/*` package.

- `LayeringTests.cs`: the folder rules, in the `Allowed` table. Extending the
  layout means extending that table in the same commit.
- `FlowLayeringTests.cs`: the seams inside `src/flow` (packs, run records, relations).
- `BimSeamTests.cs`: the projects that move to `bim-open-flow` reference no BIM
  pack, no `Ara3D.Ifc.Mesher`, and nothing in `studio`; the generic node notes
  name only generic kinds; and the two vitest files that hold the web side of the
  seam still exist. The `Stays` list names what remains in the toolkit.
