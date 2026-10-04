# Sample flows test (TKT-85)

`tests/studio/BimOpenFlow.SampleFlows.Tests` loads every committed sample analysis
(`samples/analyses` and `samples/relations` from `deps/bim-open-flow`, `samples/nrc-analyses`,
`samples/showcase-tables`,
`samples/showcase-analyses`, `samples/bim-analyses`, `samples/view3d-analyses`,
`samples/snowdon-analyses`) into both host profiles ("tables" and "bim"), through the
same `SampleSeeding` / `BimSampleSeeding` helpers and `HostComposition` registries
`BimOpenFlow.Host.HostRunner` calls at start-up, and evaluates each one. A graph a
profile's registry cannot validate is skipped here exactly as the host would skip it
(logged, not failed); `samples/snowdon-analyses/federation-match.json` is skipped on
every machine without the private Snowdon model.

## Run it

```
dotnet test tests/studio/BimOpenFlow.SampleFlows.Tests
```

It runs as part of `dotnet test BimOpenToolkit.sln`, which `gates/all.mjs` already
calls, so no separate gate step was added.

Every sample flow evaluates in its own `EvalSession`, all of them started together with
`Task.Run`, the way many open analyses evaluate concurrently in the host: a flow review
had already found a bfast file-lock bug that only showed under that concurrency, so this
suite evaluates concurrently on purpose rather than one flow at a time.

## What each check means

- **`EveryNode_IsOkOrAllowed`** — every node in every evaluated flow is `Ok`.
  `NodeStatus.EffectPending` is not a failure: every Effect node (a writer, a sink) sits
  there until something calls Run, which is by design (`PROJECT.md` principle 2). Any
  other non-`Ok` status needs a named entry in `AllowLists.NotOk`, with a reason; today
  the only entry is `relations/schema-error`'s `answer` node, which fails on purpose to
  demonstrate `rel.filter`'s schema error.
- **`NoDisconnectedNodes`** — a node with no edge at all, in a graph of more than one
  node. Almost always a leftover from editing.
- **`NoOpSortFilterLimit`** — a `table.sort`/`table.filter`/`table.limit` or
  `rel.sort`/`rel.filter`/`rel.limit` node whose output carries the exact same content
  hash as its input (per the engine's spec, equal hashes mean equal values), so the node
  did nothing. This only catches a transform that reproduces its input unchanged; it does
  not catch a transform that happens to produce the same *number* of rows for a
  data-dependent reason (see Known findings below).
- **`NoEmptyFinalTable`** — a node nothing downstream reads, all of whose table or
  relation outputs have zero rows. A node with several outputs (`chart.bar`'s table plus
  its legend) is only flagged when *every* one of them is empty, so an intentionally
  empty side output (an unpopulated colour legend) is not mistaken for the answer.
- **`NoUnresolvedPlaceholders`** — a `{WORD}` placeholder still present in a parameter
  after seeding rewrote paths. `SampleSeeding` already skips seeding such a graph, so
  this is a defensive re-check on the seeded copy, not the primary catch.
- **`MatchesGoldenFile`** — the flow's graph text (see `docs/graph-text.md`, format
  from TKT-57) matches `golden/<profile>/<id>.txt`. The document is printed with its
  placeholders intact ({SAMPLES}, {NRC}, ...), and every seeded model root is aliased to
  `{MODELS}`, so a golden file never carries a machine-specific path. No
  `IRelationReader` is supplied, so a relation prints its plan text and plan hash only,
  never a materialized content hash: two of the NRC flows that join through DuckDB
  (`nrc-rollup`, `nrc-enrich-run`) returned a different content hash across two
  otherwise-identical evaluations while this test was written, because their query has
  no `ORDER BY` and DuckDB does not promise row order without one. Printing only the
  plan keeps golden text deterministic; the row-order gap itself is a separate, real
  finding (see below).
- **NRC answers (`NrcAnswerTests`)** — the CSV-backed `nrc-q*` flows' materialized
  answers checked against the same numbers
  `tests/studio/BimOpenFlow.NrcWorkflows.Tests/CsvGraphTests.cs` asserts (both ultimately
  cite `nrc-ifc-llm/poc/results/expected_answers.json`). The numbers are necessarily
  duplicated in both projects: this project's fence does not let it reference that test
  project's private literals, and there is no committed `expected_answers.json` in this
  repository to load from either.

## Re-approving the golden files

After an intentional change to a sample graph or to the graph text format:

```
SAMPLE_FLOWS_APPROVE=1 dotnet test tests/studio/BimOpenFlow.SampleFlows.Tests
```

Every case rewrites its `golden/<profile>/<id>.txt` and passes. Review the diff before
committing, the same as any other generated file.

## Adding an allow-list entry

Every exception lives in `AllowLists.cs`, one list per check, each entry naming the
profile, the analysis id, the node id, and a reason. Add an entry only when the flagged
behaviour is intended; otherwise fix the graph or the node.

## Renaming, deleting, or changing a sample flow

Other work captures sample flows by id and by answer: the notebooks under
`samples/notebooks/` (and their outlines, tested by the notebook package's
`samples.test.ts`) and the paper walkthrough (`scripts/nrc-walkthrough.mjs`).
Before deleting or renaming a flow, grep both for its id. If one names it, commit
the replacement first, keep the old file, tell the notebook's owner the new id,
node ids and parameter values, and delete only once they have moved. When a
flow's answer changes, tell them too, so the captured notebooks are regenerated.

## Known findings from the first run

These are real product bugs this test found, left failing (not allow-listed) so they
stay visible per TKT-85's instructions, rather than filed as tickets from this change
(ticket files are outside this test project's fence):

- `NoDisconnectedNodes(bim/bim-level-summary)` — the `levels` node has no edge.
- `NoOpSortFilterLimit` on `bim/bim-door-rooms`, `bim/bim-duct-rooms`, `bim/bim-nav-hops`,
  `bim/bim-param-quality`, `bim/bim-room-classes` — each flow's final `table.sort` node
  returns its input unchanged.
- `samples/relations/large-orders.json`'s `rel.limit` (count 3) does not trim its input
  in the committed `orders.csv`, because the upstream filter already narrows the data to
  three or fewer rows; the hash-equality check above does not flag this, since it is a
  property of the sample data, not of `rel.limit` reproducing its input's plan. Recorded
  here rather than silently missed.
