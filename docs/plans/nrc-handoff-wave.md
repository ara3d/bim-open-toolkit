# Wave nrc-handoff

Builds the sample graphs and the small gaps listed in
`docs/proposals/nrc-handoff-samples.md`, with five tracks in one shared
checkout under one supervisor. Written 2026-09-18. Follow the
`parallel-wave` skill for ownership and commit turns; every agent reads the
`platonic-coder` skill first.

Checkout: `C:\Users\cdigg\git\bim-open-toolkit\.claude\worktrees\table-graph-layers`
on branch `worktree-table-graph-layers`. Shared by all tracks. The main
checkout belongs to another session and is never touched. The paper repo
`C:\Users\cdigg\git\nrc-ifc-llm` is read-only for this wave; the wave copies
what it needs into this repo so the toolkit's tests are self-contained.

## Acceptance

- A host started with `--profile tables` seeds eight `nrc-*` analyses whose
  answer nodes reproduce the paper's expected numbers, including the
  per-storey counts the proof-of-concept transcript got wrong.
- The two model-backed graphs (storey walk, DC-W1) run over a DuckDB built
  from `duplex-enriched.ifc` by a repeatable command, not a hand-made file.
- A `Table` can enter the relation pack (`rel.fromTable`), so `bos.load`
  output and any row-based node can feed `rel.*` nodes.
- `sink.writePsets` writes typed values when a `valueType` column is
  present.
- Every number a test asserts is traceable to
  `nrc-ifc-llm/poc/results/expected_answers.json` or to
  `poc/data/nrc_analytics_storeys.csv`, cited in the test.

Exclusions: no client changes; no changes to `nrc-ifc-llm`; M1 figures (a
BFAST bug, not graph work); merging to `main`.

## Baseline and required gates

Baseline at `753d7a1`. Per-track gates are `dotnet test <project>` for the
projects each track owns. Wave gates, run by the supervisor with all writers
stopped:

```bash
dotnet test tests/flow/BimOpenFlow.Nodes.Relations.Tests
dotnet test tests/flow/BimOpenFlow.Relations.DuckDb.Tests
dotnet test tests/flow/BimOpenFlow.NrcWorkflows.Tests
dotnet test tests/flow/BimOpenFlow.Nodes.Effects.Tests
dotnet test tests/flow/BimOpenFlow.Host.Tests
dotnet test tests/BimOpenToolkit.Layering.Tests
```

Pre-existing failures that do not block: `TablePacks_ContainsExactlyTheTableKinds`
(unlisted `duck.source`) and `EmptyStore_SeedsBimAndView3dSamples` (extra
`snowdon-toolkit` sample). Both predate the branch.

Layering rule (`tests/BimOpenToolkit.Layering.Tests`): `flow` may reference
`data` and submodules only. IFC conversion code used by a flow project must
therefore live in `src/data`, not `src/mcp`.

## Contracts (revision nrc-1)

The supervisor lands these before dispatch, as stubs where a track fills in
the body.

**C1. Sample data folder.** `samples/nrc/` holds copies of the five CSVs
from `nrc-ifc-llm/poc/data` (`nrc_analytics_elements.csv`,
`nrc_analytics_long.csv`, `nrc_analytics_storeys.csv`, `psets_to_write.csv`,
`door_verdicts.csv`) and `duplex-enriched.ifc`. The generated
`duplex-enriched.duckdb` is gitignored and built on demand. With
`samples/nrc` as a model root, the source names are `nrc` (the folder) and
`duplex-enriched` (the database), by the existing `SourceRegistries.FromRoots`
rule.

**C2. Sample analyses folder.** `samples/nrc-analyses/*.json`, one graph
document per file, file stem is the analysis id. Every graph ends in a node
named `answer`. Sources are named, never pathed, so no placeholder is
needed. Seeding: `SampleSeeding.SeedIfEmpty` gains a third source
`(samples/nrc-analyses, "{SAMPLES}", samples/nrc)` and `SeededModelRoots`
returns `samples/nrc` as well. Supervisor-owned.

**C3. IFC to DuckDB build.** In `src/data/Ara3D.BimOpenSchema.DuckDb`:

```csharp
public static class IfcDuckDbBuild
{
    /// <summary>Converts the IFC to BOS, loads it into a new DuckDB file, and creates
    /// the text views. Overwrites the database. Returns the database path.</summary>
    public static FilePath Build(FilePath ifc, FilePath duckDb);
}
```

plus a new view in `BosDuckDbViews.CreateViews`:

```sql
-- StoreyOfEntity(EntityIndex, StoreyIndex, StoreyName, Depth):
-- every entity with the storey reached by walking ContainedIn and PartOf upward
```

and the same view added to `src/mcp/BimOpenMcp.Ifc/IfcDuck.cs` so the MCP
server and the graphs agree.

**C4. Inline table plan node.** A `Table` enters the pack through a plan
node that carries identity and schema but no rows:

```csharp
// src/flow/BimOpenFlow.Relations/Plan/Sources.cs
public sealed class InlineTable(string name, string hash, Schema schema) : Plan
// Text: (inline "name" "hash")   Inputs: []

// Schema layer: returns schema as given.
// Compile layer: SELECT * FROM "_inline"."name"; CompiledQuery gains
//   IReadOnlyList<(string Name, string Hash)> Inlines.
// Execute layer (Relations.DuckDb):
public interface IInlineTables { IDataTable? Find(string hash); }
// DuckDbSession.For(sources, registry, inlines) writes each inline table into
// schema "_inline" with the existing DuckDbUtils.WriteTable before running.
// RelationRuntime holds a bounded InlineTableStore : IInlineTables keyed by
// ValueHash of the table; RelationRuntime.Inline(IDataTable, name) registers
// and returns the plan.
```

Node `rel.fromTable`: input `table: Table`, output `relation: Relation`,
param `name` (default `t`). Registered in `RelationNodes.All` by the
supervisor.

**C5. Typed pset values.** `sink.writePsets` accepts an optional
`valueType` column with values `Text`, `Integer`, `Number`, `Boolean`, and
writes the matching IFC value type; absent column keeps today's behavior.
Exact column semantics are documented in the node description and in
`docs/nodes.md` after regeneration (supervisor regenerates).

**C6. Test project.** `tests/flow/BimOpenFlow.NrcWorkflows.Tests` created by
the supervisor with the csproj, a `NrcPaths.cs` locating `samples/nrc` and
`samples/nrc-analyses`, and a `Fixture.cs` that builds the DuckDB into a
temp folder once via C3. Tracks add their own test files only.

## Supervisor owns

Contracts above, `samples/nrc-analyses/README.md`, `SampleSeeding.cs`,
`BimSampleSeeding.cs`, `RelationNodes.cs`, every `.csproj` and the `.sln`,
`.gitignore`, `docs/nodes.md` regeneration, this plan, the combined
findings, integration, and pushing. Browser verification on ports 5224 and
5310 (`bof-rel-host`, `bof-rel-web`) is supervisor-only.

Commit turn: one holder at a time, granted by the supervisor; none at start.

## Tracks

| Track | Writes only (implementation, tests, checkpoint) | Depends on / ready when | Checks and stable input scope | Resources |
|---|---|---|---|---|
| A. Model data | `samples/nrc/` (copied CSVs, IFC), `src/data/Ara3D.BimOpenSchema.DuckDb/IfcDuckDbBuild.cs`, the `StoreyOfEntity` view in `BosDuckDbViews.cs`, the same view in `src/mcp/BimOpenMcp.Ifc/IfcDuck.cs`, `tests/data/Ara3D.BimOpenSchema.DuckDb.Tests/IfcDuckDbBuildTests.cs` (new file), `tests/flow/BimOpenFlow.NrcWorkflows.Tests/Fixture.cs` body, checkpoint `docs/plans/nrc-handoff/track-a.md` | nrc-1 acknowledged | `dotnet test tests/data/Ara3D.BimOpenSchema.DuckDb.Tests`; inputs: its own files | writes `duplex-enriched.duckdb` only under temp folders and `samples/nrc` (gitignored) |
| B. CSV graphs | `samples/nrc-analyses/nrc-q*.json`, `tests/flow/BimOpenFlow.NrcWorkflows.Tests/CsvGraphTests.cs`, checkpoint `docs/plans/nrc-handoff/track-b.md` | A's chunk A1 (CSV copies) committed; supervisor's C6 stub committed | `dotnet test tests/flow/BimOpenFlow.NrcWorkflows.Tests --filter CsvGraphTests`; inputs: `samples/nrc/*.csv`, its graphs | none |
| C. Inline tables | `Plan/Sources.cs` (add `InlineTable` only), `Schema/SchemaInference.cs` (one rule), `Compile/SqlCompiler.cs` and `Compile/CompiledQuery.cs` (inline emission), `Relations.DuckDb/DuckDbSession.cs`, new `Relations.DuckDb/InlineTableStore.cs`, `Nodes.Relations/RelationRuntime.cs` (Inline method), new `Nodes.Relations/FromTableNode.cs`, tests in `BimOpenFlow.Relations.Tests/InlineTableTests.cs`, `Relations.DuckDb.Tests/InlineTableExecuteTests.cs`, `Nodes.Relations.Tests/FromTableNodeTests.cs`, checkpoint `docs/plans/nrc-handoff/track-c.md` | nrc-1 acknowledged | `dotnet test` on the three test projects it touches; inputs: the Relations stack | none. Registration in `RelationNodes.cs` is requested from the supervisor |
| D. Typed psets | `src/flow/BimOpenFlow.Nodes.Effects/` files of the `sink.writePsets` node only, `tests/flow/BimOpenFlow.Nodes.Effects.Tests/WritePsetsTypedTests.cs` (new file), checkpoint `docs/plans/nrc-handoff/track-d.md` | nrc-1 acknowledged | `dotnet test tests/flow/BimOpenFlow.Nodes.Effects.Tests`; inputs: Effects pack | writes IFC output only under temp folders |
| E. Model graphs | `samples/nrc-analyses/nrc-storey-of-element.json`, `nrc-dc-w1-verdicts.json`, `nrc-enrich-run.json`, `tests/flow/BimOpenFlow.NrcWorkflows.Tests/ModelGraphTests.cs`, checkpoint `docs/plans/nrc-handoff/track-e.md` | A verified (build works, `StoreyOfEntity` exists, Fixture builds the database); D verified for `nrc-enrich-run` only; C not required | `dotnet test tests/flow/BimOpenFlow.NrcWorkflows.Tests --filter ModelGraphTests`; inputs: `samples/nrc`, its graphs, Fixture | none |

Ready order: supervisor lands C1 folder skeleton, C2 seeding, C4 stubs, C6
project. A, C, D start at once. B starts when A1 lands, usually within the
first hour. E starts when A reports verified; its enrichment graph waits for
D.

## Chunks per track

**A.** A1 copy the five CSVs and the IFC into `samples/nrc` with a README
line on provenance (one commit, first, so B can start). A2 `IfcDuckDbBuild`
with a test that builds from `samples/nrc/duplex-enriched.ifc` into a temp
folder and counts tables. A3 the `StoreyOfEntity` view in both files, with a
test asserting Level 1 has 103 entities (from `nrc_analytics_storeys.csv`).
A4 fill `Fixture.cs`.

**B.** One commit per graph, each with its test asserting the answer table
shape and the cited numbers: `nrc-q1-building-total` (37196.2, 218),
`nrc-q8-per-storey` (4 rows, Level 1 = 103 / 49451.2 / 40.5),
`nrc-q3-top-elements` (5 rows, first `0iEHWY1$XA8eQeeULq4jpl` at 412.0),
`nrc-q5-by-category` (9 rows, Wall 22854.1 first), `nrc-q7-absence` (one
row, the roof `0jf0rYHfX3RAB3bSIRjmxl`). Check the expression grammar's
string literal form (`'IFCROOF'`) before writing filters.

**C.** C1 plan node, text, schema rule, compile emission with string tests.
C2 session binding and store with an execute test over a two-row in-memory
table. C3 `rel.fromTable` node with a test that pipes `bos.load`-shaped
table output through `rel.filter` and back through `rel.materialize`.

**D.** D1 read `valueType` when present and write typed values, with a test
that writes and reads back one property of each type. D2 node description.

**E.** E1 storey walk: `rel.table` over `StoreyOfEntity` joined to
`EntityText` and the elements CSV, aggregated by storey, asserting 4 rows
with Level 1 = 103. E2 DC-W1: doors from `EntityText`, width from
`ParameterText`, `rel.materialize` into `check.rule` then `view3d.color`,
asserting 14 rows, 8 Pass and 6 Fail. E3 enrichment: `rel.csv` of
`psets_to_write.csv` into `rel.materialize` into `sink.writePsets` writing to
a temp folder, asserting the summary row.

## Track brief

Send each track this text with its row filled in.

```text
Track <id>, shared checkout C:\Users\cdigg\git\bim-open-toolkit\.claude\worktrees\table-graph-layers.
Read and apply before work: the parallel-wave skill and the platonic-coder skill
(both installed as plugins from the platonic marketplace; resolve their SKILL.md
from the available skills), then C:\Users\cdigg\.claude\CLAUDE.md and the
csharp-style skill for any C#.
Read: docs/plans/nrc-handoff-wave.md (this plan), docs/proposals/nrc-handoff-samples.md,
docs/proposals/table-graph-layers.md, src/flow/BimOpenFlow.Nodes.Relations/README.md,
samples/relations/README.md, docs/nodes.md section "Relations".
Pass both skill paths and this requirement to any nested delegates.
Contract revision: nrc-1; acknowledge in your checkpoint before writing.
Depends on / ready when: <row>.
Implement: <chunks for your track>.
Write only: <row>. Fences apply to commands too: no solution-wide formatters,
no docs regeneration, no npm install, no host processes.
Verify: <row>. Do not run the wave gates.
Checkpoint: docs/plans/nrc-handoff/track-<id>.md; keep state, files, remaining
work, running processes, checks, blockers, chunk commit hashes, and findings current.
Shared files are read-only; request changes through your checkpoint. Commit your
own verified chunks under the commit-turn protocol: ask the supervisor for the
turn, stage only your paths with explicit pathspecs, confirm the index holds only
your chunk, commit with a message ending in
"Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>", record the hash,
release the turn. Never push. On pause, stop writes and processes and acknowledge.
Return the checkpoint plus a concise account of delivered behavior and verification limits.
```

## Integration

With all writers stopped, the supervisor: registers `rel.fromTable` in
`RelationNodes.cs`; regenerates `docs/nodes.md`; adds the seeding entry
and root; runs the wave gates against the recorded revision; starts
`bof-rel-host` and `bof-rel-web`, opens `nrc-q8-per-storey` and
`nrc-storey-of-element`, and confirms both answer nodes show four rows with
Level 1 at 103; records the integration record below this plan; pushes the
branch.

## Decisions taken up front

- The IFC and CSV copies are committed. Duplex is a public buildingSMART
  sample and the CSVs are under 250 rows. The generated DuckDB is not.
- The DuckDB is built by a data-layer function rather than the MCP server's
  temp-folder artifact, because flow projects may not reference `src/mcp`.
- Graphs live in this repo, not in `nrc-ifc-llm`, so the toolkit's tests
  guard them; the paper loads them by PUT as it does today.
- `rel.fromTable` is in scope even though no NRC graph needs it, because
  `bos.load` is the only path from a model to the pack outside DuckDB files.

## Contract amendments (still revision nrc-1, applied before dispatch)

Landed by the supervisor on 2026-09-18 before any track started; tracks
acknowledge the plan including this section.

1. **C3 location.** `IfcDuckDbBuild` lives in a new data project
   `src/data/Ara3D.Ifc.DuckDb` (references `Ara3D.Ifc.Bos` and
   `Ara3D.BimOpenSchema.DuckDb`), not inside `Ara3D.BimOpenSchema.DuckDb`.
   That package is published and IFC-free by design; `Ara3D.Ifc.Bos` exists
   to keep the schema projects free of the IFC loader. Track A's fence is
   `src/data/Ara3D.Ifc.DuckDb/IfcDuckDbBuild.cs` for the build function;
   the `StoreyOfEntity` view stays in `BosDuckDbViews.cs` and `IfcDuck.cs`.
2. **C2 both profiles.** `samples/nrc-analyses` is seeded by both
   `SampleSeeding.SeedIfEmpty` (tables) and `BimSampleSeeding.SeedIfEmpty`
   (bim), and both `SeededModelRoots` include `samples/nrc`.
   `nrc-dc-w1-verdicts` and `nrc-enrich-run` use `check.rule`,
   `view3d.color`, and `sink.writePsets`, which only the bim profile
   registers; the tests evaluate every graph with the bim-profile registry
   plus the rel.* pack (`HostComposition.AllPacks` and `RelationNodes.All`).
3. **C4 rendering and hashing.** Track C's fence also includes
   `Plan/PlanText.cs` (the `(inline "name" "hash")` render rule). The inline
   store is keyed by a caller-supplied hash string; `RelationRuntime.Inline`
   computes it with `ValueHash.Compute(new TableValue(table))`, for which
   the supervisor added a `Ara3D.DataFlowEngine` reference to
   `BimOpenFlow.Nodes.Relations.csproj`.
4. **C6 fixture shape.** The fixture's registry roots are `samples/nrc` (source
   `nrc`) and a temp folder holding the built `duplex-enriched.duckdb`
   (source `duplex-enriched`), so graphs name the same sources in tests and
   in the host. The host builds `samples/nrc/duplex-enriched.duckdb` on
   demand at seeding time; the supervisor adds that at integration once A's
   build function is verified.
5. **C fence.** Track C also owns `Relations.DuckDb/DuckDbExecutor.cs`, since
   `Execute` and `Count` must hand the inline tables to the session. The host
   reaches the executor only through `RelationRuntime`.
6. **C5 value names.** `valueType` also accepts `Real` as a synonym for
   `Number` (the paper's `psets_to_write.csv` uses it), plus `Label` and
   `Identifier` where `IfcPropertyValue` already offers them. Empty means
   `Text`; unknown names fail naming the row.
7. **Commit turn mechanics.** Subagents cannot message the supervisor
   mid-run, so the turn is a standing grant taken by
   `mkdir docs/plans/nrc-handoff/.commit-turn` (retry every 15 s, give up
   after 10 minutes and record a blocker) and released by removing it. The
   supervisor takes the same lock for its own commits.
8. **Private build output.** Every track builds and tests with
   `--artifacts-path C:\Users\cdigg\AppData\Local\Temp\claude\nrc-wave\track-<id>`
   so concurrent builds do not collide on `bin` and `obj`. Wave gates run
   from the default output after all writers stop.

## Integration record (2026-09-18)

Tested revision `731f1cd` on `worktree-table-graph-layers`, working tree
clean, all five track agents and every background build stopped. Gates run
from the default build output:

| Gate | Result |
|------|--------|
| `BimOpenFlow.Nodes.Relations.Tests` | 30 passed |
| `BimOpenFlow.Relations.DuckDb.Tests` | 24 passed |
| `BimOpenFlow.NrcWorkflows.Tests` | 8 passed (five CSV graphs, three model graphs) |
| `BimOpenFlow.Nodes.Effects.Tests` | 54 passed |
| `BimOpenFlow.Host.Tests` | 16 passed (three new NRC seeding tests) |
| `BimOpenToolkit.Layering.Tests` | 4 passed |

Outside the gates, `BimOpenFlow.TableWorkflows.Tests` (31 of 32) and
`BimOpenFlow.BimWorkflows.Tests` (22 of 23) fail only on the two baseline
failures named above. `BimOpenFlow.Relations.Tests` passed 87 in track C's
run.

Browser check: host `bof-rel-host` on 5224 (`--profile tables`) with the
editor on 5310. `nrc-q8-per-storey` and `nrc-storey-of-element` both show
four rows on the `answer` node: Level 1 103 / 49451.2, Level 2 93, T/FDN
14, Roof 8. Limits: the preview tool started the host from the main
checkout's launch config against a non-empty store, and stopping it was
denied, so seeding did not run in that host; the two graphs were loaded by
PUT (the paper's own path) and seeding is covered by `NrcSeedingTests`,
which asserts both profiles seed the eight ids and register `samples/nrc`
with its built database.

Acceptance: all five criteria met. The tables host seeds the eight graphs;
`nrc-dc-w1-verdicts` and `nrc-enrich-run` evaluate only in the bim profile
(amendment 2). The DuckDB is built by `IfcDuckDbBuild` from the committed
IFC, on demand at host start and once per test run. `rel.fromTable` is
registered and tested. `sink.writePsets` writes typed values. Every asserted
number cites `expected_answers.json` or `nrc_analytics_storeys.csv`.

## Consolidated findings

Defects fixed during the wave:

- `NrcPaths` resolved the repo from the test binary's folder, which every
  track's private `--artifacts-path` put outside the checkout (B). Fixed in
  `b9fcf0f` with a `[CallerFilePath]` anchor. `SampleGraphTests` in
  `Nodes.Relations.Tests` and the workflow test projects still walk from
  `AppContext.BaseDirectory`, so they cannot run under an out-of-tree
  artifacts path; an in-repo `artifacts/` path works.
- `InlineTable.Hash` hid `Plan.Hash`; renamed to `TableHash` (C).

Findings about the data and the paper:

- The Duplex conversion emits aggregation as `MemberOf`, never `PartOf`.
  Walking containment and `PartOf` alone places 52 of Level 1's 103
  elements; the transcript's Q2 undercount has this shape (A).
- `StoreyOfEntity` raw rows per storey exceed the element counts (Level 1
  is 114) because spaces, aggregates, and the storey itself are included;
  count elements by joining to the elements CSV (A, E).
- The door width parameter is `Ifc:OverallWidth` in metres; the DC-W1
  graph multiplies by 1000, and its 14 doors match `door_verdicts.csv` (E).
- The roof has two rows in `nrc_analytics_long.csv`, so the Q7 anti join
  aggregates by GlobalId before selecting (B).
- `psets_to_write.csv` uses `Real`, `Label`, `Identifier`, and `Text`;
  `Integer`, `Number`, and `Boolean` do not occur (D).

Design notes deferred to a later pass:

- The expression grammar has no numeric cast, so `nrc-dc-w1-verdicts` uses
  a `rel.sql` node to convert `ParameterText.Value`; a conversion builtin
  would remove the SQL (E).
- `rel.sql` sees only `t1..t3` and cannot name another view of the same
  database (E).
- The engine has no graph-level Run; effect nodes return `EffectPending`,
  so the enrichment test executes the sink itself with an `IsRun` context (E).
- `DuckDbUtils.WriteTable` cannot target a schema, so inline tables are
  staged under a private name and exposed as a view in `_inline` (C).
- `Fixture` is a `SetUpFixture`, so a CSV-only filter still pays the twenty
  second IFC conversion; a lazy database would skip it (A).
- The mini IFC fixture is duplicated between `WritePsetsTests` and
  `WritePsetsTypedTests`; hoist it into `TestSupport.cs` (D).
- `CsvGraphTests` carries its own repo-root workaround from before the
  `NrcPaths` fix; remove it (B).
- Committed CSV and IFC copies are LF in the index and will check out CRLF
  on Windows without a `.gitattributes` rule (A).
- The `--nologo` flag on `dotnet run --project src/flow/BimOpenFlow.NodeDocs`
  reaches the program as its output path; run it with no options.
