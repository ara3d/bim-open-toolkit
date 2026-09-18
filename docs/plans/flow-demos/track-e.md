# Track E: engine Run and numeric cast

Checkpoint for the flow-demos follow-through wave, track E. Worktree
`.claude/worktrees/table-graph-layers`, branch `worktree-table-graph-layers`,
started at `ce2b569`; engine submodule branch `relation-value`, started at
`a7dccd5`, now `e029371` (pushed to origin).

## State

Done. Both goals landed, each as its own verified commit.

| Chunk | Where | Commit |
|---|---|---|
| E1 engine Run (`EvalSession.Run`) | submodule | `f123068` |
| E2 host `POST /api/analyses/{id}/runs` performs the Run | toolkit | `f2d151f` |
| E3 NRC tests run effects through the engine | toolkit | `643a0f9` |
| E4 `toNumber(Text)` builtin | submodule | `e029371` |
| E5a `toNumber` compiles to `TRY_CAST(x AS DOUBLE)` | toolkit | `02f0051` |
| E5b the two graphs drop `rel.sql` | toolkit | this commit |

## Spec decisions

- `semantics.md` §6 gained one paragraph: the Run's snapshot is one consistent
  snapshot; an engine MAY make it the session's current snapshot and notify
  observers; the next standing pass returns Effect nodes to pending; Effect
  nodes (and Pure nodes that execute during the Run) see `IsRun` true. The
  engine does commit the run snapshot, so the host's SSE stream and
  `GET .../state` show the sink's summary after a run until the next edit.
- Effect nodes bypass the memo cache entirely (§4: never memoized across Runs).
- A Run is one pass with `isRun` true: Pure nodes hit the memo where unchanged,
  so "bring all Pure nodes up to date" and "execute effects in topological
  order" are the same walk over `doc.Sort()`. A failing effect reports `Error`
  and poisons only its own downstream, as for Pure nodes.
- `expressions.md` moves 0.1.0 to 0.2.0 (adding a builtin is minor).
  `toNumber(Text) -> Number` parses with `NumberStyles.Float` under the
  invariant culture (sign, decimal point, exponent, surrounding whitespace,
  `NaN`, `Infinity`) and yields null otherwise; it is the only builtin that
  yields null from a non-null argument, which `coalesce` can default. Wrong
  arity or a non-Text argument stay static errors. In SQL it is DuckDB's
  `TRY_CAST(x AS DOUBLE)`, which has the same null-on-failure contract; the
  accepted spellings differ at the margins (DuckDB also accepts `inf`).
- `RunReplay` keeps its TODO: replay cannot re-derive an Effect node's output
  hash without executing the effect, so effect outputs are still skipped.

## Files

Engine (submodule): `src/Ara3D.DataFlowEngine/{Evaluator.cs,EvalSession.cs,GraphEvaluator.cs,EffectOrder.cs,README.md}`,
`spec/dataflow-graph/semantics/semantics.md`,
`tests/Ara3D.DataFlowEngine.Tests/{RunTests.cs,TestNodes.cs}`,
`tests/Ara3D.DataFlowEngine.Conformance/SemanticsVectorTests.cs`,
`tests/Ara3D.DataFlowEngine.Runs.Tests/FreezeTests.cs`,
`src/Ara3D.DataFlowEngine.Expressions/{Typing/Builtin.cs,Typing/TypeChecker.cs,Evaluation/BuiltinEvaluator.cs,README.md}`,
`spec/dataflow-graph/expressions/{expressions.md,conformance/015-tonumber.json}`,
`tests/Ara3D.DataFlowEngine.Expressions.Tests/BuiltinTests.cs`.

Toolkit: `src/flow/BimOpenFlow.Host.Api/{AnalysisSessions.cs,EvalEndpoints.cs,README.md}`,
`src/flow/BimOpenFlow.Relations/Compile/ExprSql.cs`,
`tests/flow/BimOpenFlow.Host.Api.Tests/{RunAndSseTests.cs,TestGraphs.cs}`,
`tests/flow/BimOpenFlow.Relations.Tests/{ExprSqlTests.cs,SchemaInferenceTests.cs}`,
`tests/flow/BimOpenFlow.NrcWorkflows.Tests/{ModelGraphTests.cs,ShowcaseGraphTests.cs}`,
`samples/nrc-analyses/nrc-dc-w1-verdicts.json`,
`samples/showcase-analyses/ifc-to-verdicts-and-chart.json`, this file.

Not touched: `TableExpressions.cs` (it does not enumerate builtins; it parses
and type-checks through the engine, so `table.derive` accepts `toNumber`
with no change), `docs/nodes.md` (no node description changed).

## Checks

- Engine, built with `--artifacts-path artifacts/agent-e` inside the submodule
  (the conformance tests walk up from the output folder to find `spec/`, so
  the output must stay under the submodule root):
  DataFlowEngine.Tests 87 passed (9 new), Conformance 12 passed 3 skipped
  (semantics vectors 003 and 004 now run through `EvalSession.Run`),
  Runs.Tests 26 passed (1 new), TestKit.Tests 24, NodeGraph.Tests 44,
  Expressions.Tests 437 passed (15 new, including vector 015).
- `dotnet test tests/flow/BimOpenFlow.Host.Api.Tests --artifacts-path artifacts/agent-e`:
  30 passed (1 new: `CreateRun_ExecutesEffects_AndRecordsThem`).
- `dotnet test tests/flow/BimOpenFlow.Relations.Tests --artifacts-path artifacts/agent-e`:
  91 passed (4 new).
- `dotnet test tests/flow/BimOpenFlow.NrcWorkflows.Tests --artifacts-path artifacts/agent-e`:
  30 passed after E3 alone (original graphs) and 30 passed after E5b (rewritten
  graphs): 14 doors, 8 Pass, 6 Fail, widths within 0.05 mm of
  `door_verdicts.csv`; `sink.writePsets` touched 224 entities and wrote 2438
  values; `sink.report` wrote the file with 14 rows.

## Verification limits

- The host run endpoint is tested with the TestKit `test.effect` node, not
  with `sink.report` over a real graph; the sinks are covered by the NRC
  suite, which drives `EvalSession.Run` directly rather than over HTTP.
- `toNumber` versus `TRY_CAST` agreement is asserted on the Duplex door
  widths (14 values) and unit tests, not on a fuzzed corpus of spellings.
- Not run: `gates/host-smoke.mjs`, the web gate, and the wider wave gate list.

## Blockers

None.

## Findings and requests

- `rel.select` takes column names only and `rel.derive` refuses a name that
  differs from an existing column only by case (`SchemaInference.InferDerive`
  uses the case-insensitive `Schema.Has`), so the graphs cannot rename
  `GlobalId` to `globalId` or `Name` to `doorName` without `rel.sql`. Column
  lookups in the node packs and the plan layer are case-insensitive, so the
  rewritten graphs keep the source spellings `GlobalId` and `Name`;
  `view3d.color` still joins on `joinColumn: "globalId"`, and the test reads
  `GlobalId`. Request for the owner of `Nodes.Relations`: a `rel.rename` node
  (the `Rename` plan operator and its schema rule already exist).
- Request for the owner of `samples/showcase-analyses/README.md`: the
  `ifc-to-verdicts-and-chart` row lists `rel.sql` in its node chain; it is now
  `rel.derive` x2, `rel.select`, `rel.sort`.
- `RunsVectorTests` in the engine's Conformance project still ignores record
  creation and replay because that project does not reference
  `Ara3D.DataFlowEngine.Runs`; the Runs.Tests project covers the same vectors.
- The `test.effect` passthrough means a run over the API test graph records
  the effect's output; a real sink's summary table lands in `recordedOutputs`
  the same way, which makes run records for report graphs larger than before.
  Worth a look if run archives grow.
