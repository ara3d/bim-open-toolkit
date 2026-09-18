# Track C — Inline tables

**Contract revision: nrc-1, including the "Contract amendments" section of
`docs/plans/nrc-handoff-wave.md`. Acknowledged before any write.**
Starting point: supervisor commit `8bcf1c9`.

**State: working** (C1 not yet committed)

## Scope

A `Table` wire value enters the `rel.*` pack as a relation:
`InlineTable` plan node, its schema and SQL rules, an execute-layer store of
in-process tables, and the `rel.fromTable` node.

## Files owned

| File | Chunk |
|------|-------|
| `src/flow/BimOpenFlow.Relations/Plan/Sources.cs` (`InlineTable` only) | C1 |
| `src/flow/BimOpenFlow.Relations/Plan/PlanText.cs` (its render rule only) | C1 |
| `src/flow/BimOpenFlow.Relations/Schema/SchemaInference.cs` (one rule) | C1 |
| `src/flow/BimOpenFlow.Relations/Compile/SqlCompiler.cs` | C1 |
| `src/flow/BimOpenFlow.Relations/Compile/CompiledQuery.cs` | C1 |
| `tests/flow/BimOpenFlow.Relations.Tests/InlineTableTests.cs` | C1 |
| `src/flow/BimOpenFlow.Relations.DuckDb/InlineTableStore.cs` | C2 |
| `src/flow/BimOpenFlow.Relations.DuckDb/DuckDbSession.cs` | C2 |
| `src/flow/BimOpenFlow.Relations.DuckDb/DuckDbExecutor.cs` | C2 |
| `tests/flow/BimOpenFlow.Relations.DuckDb.Tests/InlineTableExecuteTests.cs` | C2 |
| `src/flow/BimOpenFlow.Nodes.Relations/RelationRuntime.cs` | C3 |
| `src/flow/BimOpenFlow.Nodes.Relations/FromTableNode.cs` | C3 |
| `tests/flow/BimOpenFlow.Nodes.Relations.Tests/FromTableNodeTests.cs` | C3 |
| README rows of the three projects | with their chunk |
| this checkpoint | all |

## Chunk commits

| Chunk | Hash | State |
|-------|------|-------|
| C1 plan, text, schema, compile | — | working |
| C2 execute | — | not started |
| C3 runtime and node | — | not started |

## Checks and results

Baseline build of `tests/flow/BimOpenFlow.Relations.Tests` with
`--artifacts-path C:\Users\cdigg\AppData\Local\Temp\claude\nrc-wave\track-c`:
0 errors, 65 warnings, all pre-existing except the one noted below.

## Blockers

None.

## Requests to the supervisor

- Register `RelFromTableNode` in `RelationNodes.cs` at integration (planned).

## Findings

1. `InlineTable.Hash` as landed hides `Plan.Hash` (compiler warning CS0108 at
   `Plan/Sources.cs(24,19)`), so `((Plan)t).Hash` and `t.Hash` return
   different strings — the plan-text hash and the table-content hash. Renamed
   the property to `TableHash` in C1. The constructor parameter, the
   `(inline "name" "hash")` text, and the `InlineUse.Hash` field are unchanged,
   so nothing outside the track's fence is affected.
