# Track C — Inline tables

**Contract revision: nrc-1, including the "Contract amendments" section of
`docs/plans/nrc-handoff-wave.md`. Acknowledged before any write.**
Starting point: supervisor commit `8bcf1c9`.

**State: verified** (all three chunks committed; assigned per-track gates pass,
with the one limit recorded below)

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
| C2 execute | `95eb0cf` | committed |
| C3 runtime and node | (this commit) | committed |

## Checks and results

Every command run with
`--artifacts-path C:\Users\cdigg\AppData\Local\Temp\claude\nrc-wave\track-c`.

| Check | Result |
|-------|--------|
| `dotnet test tests/flow/BimOpenFlow.Relations.Tests` (after C1) | 87 passed, 0 failed |
| `dotnet test tests/flow/BimOpenFlow.Relations.DuckDb.Tests` (after C2) | 24 passed, 0 failed |
| `dotnet test tests/flow/BimOpenFlow.Nodes.Relations.Tests` (after C3) | 19 passed, 3 failed — see the verification limit below |

The three failures are the same three in every run, before and after the
track's changes.

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

## Remaining work

None inside the fence.

## Running processes

None.

## Requests to the supervisor

- Register `RelFromTableNode` in `RelationNodes.cs` at integration, as the plan
  already schedules. Nothing else in the repository needs to change: the host
  reaches the executor only through `RelationRuntime`, which now passes its
  store to `Execute` and `Count`.
- `docs/nodes.md` regeneration will pick up `rel.fromTable` with the
  description on `RelFromTableNode.Spec`.

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
4. `RelationRuntime.Inline` types the plan from the table's CLR column types via
   `DuckDbTypes.FromClr`. A column whose CLR type has no mapping becomes
   `ColumnType.Unknown`; `WriteTable` stores it as VARCHAR and the result check
   accepts anything for Unknown, so such a column survives the round trip but
   cannot be used in a typed expression. That is the existing behaviour of
   `Unknown` elsewhere in the stack, not something new here.
5. The inline store is bounded at 16 tables by default (`inlineCapacity` on the
   `RelationRuntime` constructor). A graph holding more than 16 distinct inline
   tables alive at once would evict one and then fail at execute time with "No
   rows are registered". Raising the bound is a one-argument change; worth
   revisiting once a real graph uses `rel.fromTable`.
