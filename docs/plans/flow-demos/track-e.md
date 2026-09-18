# Track E: engine Run and numeric cast

Checkpoint for the flow-demos follow-through wave, track E. Worktree
`.claude/worktrees/table-graph-layers`, branch `worktree-table-graph-layers`,
started at `ce2b569`; engine submodule branch `relation-value`, started at
`a7dccd5`.

## State

- E1 engine Run: done, submodule `f123068`, pushed to `origin/relation-value`.
- E2 host `POST /api/analyses/{id}/runs` performs the Run: done (this commit).
- E3 NRC tests on the engine Run: edited, waiting on the TestSupport track
  (`NrcWorkflows.Tests.csproj` now references `tests/flow/BimOpenToolkit.TestSupport`,
  which is not in the tree yet, so the project does not build).
- E4 `toNumber` builtin in the engine: next.
- E5 `TRY_CAST` in the SQL compiler and the two graph rewrites: after E4.

## Spec decisions

- `semantics.md` §6 gained one paragraph: the Run's snapshot is one consistent
  snapshot; an engine MAY make it the session's current snapshot and notify
  observers; the next standing pass returns Effect nodes to pending; Effect
  nodes (and Pure nodes that execute during the Run) see `IsRun` true. The
  engine does commit the run snapshot, so the host's SSE stream shows the
  sink's summary after a run.
- Effect nodes bypass the memo cache entirely (§4: never memoized across Runs).
- A Run is one pass with `isRun` true: Pure nodes hit the memo where unchanged,
  so "bring all Pure nodes up to date" and "execute effects in topological
  order" are the same walk over `doc.Sort()`.
- `RunReplay` keeps its TODO: replay cannot re-derive an Effect node's output
  hash without executing the effect, so effect outputs are still skipped.

## Files

Engine (submodule): `src/Ara3D.DataFlowEngine/{Evaluator.cs,EvalSession.cs,GraphEvaluator.cs,EffectOrder.cs,README.md}`,
`spec/dataflow-graph/semantics/semantics.md`,
`tests/Ara3D.DataFlowEngine.Tests/{RunTests.cs,TestNodes.cs}`,
`tests/Ara3D.DataFlowEngine.Conformance/SemanticsVectorTests.cs`,
`tests/Ara3D.DataFlowEngine.Runs.Tests/FreezeTests.cs`.

Toolkit: `src/flow/BimOpenFlow.Host.Api/{AnalysisSessions.cs,EvalEndpoints.cs,README.md}`,
`tests/flow/BimOpenFlow.Host.Api.Tests/{RunAndSseTests.cs,TestGraphs.cs}`,
`tests/flow/BimOpenFlow.NrcWorkflows.Tests/{ModelGraphTests.cs,ShowcaseGraphTests.cs}` (uncommitted, see E3).

## Commits

- submodule `f123068` feat(engine): graph-level Run that executes Effect nodes per semantics §6
- toolkit: (this commit) host run endpoint performs the engine Run

## Checks

- Engine, built with `--artifacts-path artifacts/agent-e` inside the submodule
  (the conformance tests walk up from the output folder to find `spec/`, so
  the output must stay under the submodule root):
  DataFlowEngine.Tests 87 passed (9 new), Conformance 12 passed 3 skipped
  (the semantics vectors 003 and 004 now run through `EvalSession.Run`),
  Runs.Tests 26 passed (1 new), TestKit.Tests 24, NodeGraph.Tests 44.
- `dotnet test tests/flow/BimOpenFlow.Host.Api.Tests --artifacts-path artifacts/agent-e`:
  30 passed (1 new: `CreateRun_ExecutesEffects_AndRecordsThem`).

## Blockers

- E3 waits on the TestSupport track's commit (see State).

## Findings and requests

- `rel.select` takes column names only and `rel.derive` refuses a name that
  differs from an existing column only by case (`SchemaInference.InferDerive`
  uses the case-insensitive `Schema.Has`), so the graphs cannot rename
  `GlobalId` to `globalId` without `rel.sql`. Column lookups in the node packs
  and the plan layer are case-insensitive, so the rewritten graphs will keep
  the source spellings `GlobalId` and `Name`. Request: a `rel.rename` node
  (the `Rename` plan operator already exists) for the owner of `Nodes.Relations`.
- `RunsVectorTests` in the engine's Conformance project still ignores record
  creation and replay because that project does not reference
  `Ara3D.DataFlowEngine.Runs`; the Runs.Tests project covers the same vectors.
