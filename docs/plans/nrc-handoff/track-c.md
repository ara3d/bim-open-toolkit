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
| C1 plan, text, schema, compile | `8e60ecc` | committed |
| C2 execute | — | working |
| C3 runtime and node | — | not started |

## Checks and results

Every command run with
`--artifacts-path C:\Users\cdigg\AppData\Local\Temp\claude\nrc-wave\track-c`.

| Check | Result |
|-------|--------|
| `dotnet test tests/flow/BimOpenFlow.Relations.Tests` (after C1) | 87 passed, 0 failed |
| `dotnet test tests/flow/BimOpenFlow.Relations.DuckDb.Tests` (after C2) | 24 passed, 0 failed |
| `dotnet test tests/flow/BimOpenFlow.Nodes.Relations.Tests` (after C2) | 9 passed, 3 failed — see the verification limit below |

## Verification limit

`SampleGraphTests` in `BimOpenFlow.Nodes.Relations.Tests` finds
`samples/relations` by walking up from `AppContext.BaseDirectory` for
`BimOpenToolkit.sln`. With `--artifacts-path` the binaries sit under the temp
folder, so the walk fails and its three tests
(`ThereAreSamples`, `ParsesAndValidates`, `EvaluatesAsDocumented`) throw
`BimOpenToolkit.sln not found`. This is the artifacts flag, not the code: the
failure is in path discovery before any relation code runs. Those three tests
cannot be verified from this track; the supervisor's wave gates, run without
the flag, cover them.

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
2. `DuckDbUtils.WriteTable` quotes its table name as one identifier
   (`CREATE TABLE IF NOT EXISTS "name"`) and hands the same string to
   `CreateAppender`, so it cannot write into a schema. `DuckDbSession.BindInline`
   therefore writes each inline table under a private name (`_inline_1`, ...) in
   the session's main schema and exposes it as a view under `"_inline"."name"`.
   The session is private and in-memory, so the staging tables are invisible to
   anything else. A `WriteTable` overload taking a schema would remove the extra
   view; that file belongs to the data layer, not this track.
3. Two inline tables with the same name and different rows in one plan are a
   real conflict, because the SQL names them both `"_inline"."name"`.
   `BindInline` fails with "Two different inline tables are named 'x'" rather
   than letting DuckDB report a duplicate view.
