# BimOpenToolkit.Layering.Tests

Checks that the folder groups stay layered. It parses every `.csproj` under
`src`, `tests`, `plugins`, `apps`, and `tools` and fails on a project
reference that points up: `data` may reference only itself and submodules,
`flow` adds `data`, `mcp` adds `flow`, `studio` may reference all three, and
`plugins`, `apps`, and `tools` sit on `data`. It also fails if any package
under `viewer/` depends on an `@bimopenflow/*` package.

The rules live in the `Allowed` table in `LayeringTests.cs`. Extending the
layout means extending that table in the same commit.
