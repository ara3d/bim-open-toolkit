# Track T: shared test support and a BFAST reader

Checkpoint for the flow-demos follow-through wave. Checkout
`.claude/worktrees/table-graph-layers`, branch `worktree-table-graph-layers`,
builds under `--artifacts-path artifacts/agent-t`.

## State

| Chunk | State | Commit |
|---|---|---|
| T1a `tests/BimOpenToolkit.TestSupport` (RepoPaths, MiniIfc), solution entry, layering rule | committed | (below) |
| T1b replace the repo-root and mini-IFC copies in the test projects | pending | |
| T2 `bfast.read`, `bfast.buffer`, fixture, demo graph, docs | pending | |

## T1a

Files: `tests/BimOpenToolkit.TestSupport/{BimOpenToolkit.TestSupport.csproj,RepoPaths.cs,MiniIfc.cs,README.md}`,
`BimOpenToolkit.sln`, `tests/BimOpenToolkit.Layering.Tests/{LayeringTests.cs,BimOpenToolkit.Layering.Tests.csproj}`.

Layering: `tests/BimOpenToolkit.TestSupport` sits outside the four groups, so
`Layering.GroupOf` names it by its folder. The rule now lets any group reference
that one target, justified by the new test `TestSupportReferencesNoSourceProject`,
which fails if the support project ever gains a project reference.

Checks: `dotnet test tests/BimOpenToolkit.Layering.Tests` 8 passed.

## Blockers, findings, requests

(none yet)
