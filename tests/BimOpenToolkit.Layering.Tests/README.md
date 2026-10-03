# BimOpenToolkit.Layering.Tests

Checks that the folder groups stay layered. It parses every `.csproj` under
`src`, `tests`, `plugins`, and `tools` and fails on a project reference that
points up: `flow` may reference `data`, `mcp` adds `flow`, `studio` may
reference all three, and `plugins` and `tools` sit on `data`. The `data`
layer is bim-open-data, reached as `$(DepsRoot)bim-open-data/src/data/...`;
every other dependency (`deps/`, `submodules/`) is external and allowed. It also fails if any package
under `viewer/` depends on an `@bimopenflow/*` package.

The rules live in the `Allowed` table in `LayeringTests.cs`. Extending the
layout means extending that table in the same commit.
