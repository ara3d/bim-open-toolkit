# Track E - Model graphs

**Contract revision: nrc-1, including the "Contract amendments" section of
`docs/plans/nrc-handoff-wave.md`. Acknowledged before any file was written.**

State: **verified** (all three chunks implemented, committed, and checked).
Started from HEAD `264653f` (>= `af76a33`; tracks A-D verified).

## Scope

| Chunk | Graph | Test |
|---|---|---|
| E1 | `samples/nrc-analyses/nrc-storey-of-element.json` | `StoreyOfElement_MatchesTheStoreyCsv` |
| E2 | `samples/nrc-analyses/nrc-dc-w1-verdicts.json` | `DcW1Verdicts_MatchTheDoorVerdictsCsv` |
| E3 | `samples/nrc-analyses/nrc-enrich-run.json` | `EnrichRun_WritesEveryPsetRowIntoACopyOfTheIfc` |

## Files owned

- `samples/nrc-analyses/nrc-storey-of-element.json`
- `samples/nrc-analyses/nrc-dc-w1-verdicts.json`
- `samples/nrc-analyses/nrc-enrich-run.json`
- `tests/flow/BimOpenFlow.NrcWorkflows.Tests/ModelGraphTests.cs`
- this checkpoint

## Chunk commits

| Chunk | Hash |
|---|---|
| E1 | `165c955` |
| E2 | `11e36e4` |
| E3 | pending |

## Checks and results

All with `--artifacts-path C:\Users\cdigg\AppData\Local\Temp\claude\nrc-wave\track-e`.

- `dotnet test tests/flow/BimOpenFlow.NrcWorkflows.Tests --filter ModelGraphTests` after E1:
  1 passed, 0 failed.
- The same command after E2: 2 passed, 0 failed.
- The same command after E3: 3 passed, 0 failed.
- `dotnet test tests/flow/BimOpenFlow.NrcWorkflows.Tests` with no filter, at the end:
  **8 passed, 0 failed** - track B's five CSV-graph tests plus these three. The
  `NrcPaths` root fix (`b9fcf0f`) means `Fixture` now builds the database happily
  under the private artifacts path, so B's workaround is no longer needed.

## Remaining work

None.

## Verification limits

- The graphs were evaluated through `GraphDocument.Evaluate`, not through a running
  host. The supervisor's integration step opens `nrc-storey-of-element` in the browser.
- `nrc-enrich-run`'s effect node is executed by the test, not by the engine (see
  finding 8). Nothing checks the *contents* of the written IFC here; track D's
  `WritePsetsTypedTests` asserts the emitted `IFCPROPERTYSINGLEVALUE` lines per type.
- The working tree during these runs carried only this track's files beyond HEAD.

## Running processes

None.

## Blockers

None.

## Findings

1. **`rel.sql` sees only its connected inputs as `t1`..`t3`.** A query naming any other
   view of the same database fails with "Catalog Error: Table with name ParameterText
   does not exist". Every table a graph reads must arrive through a `rel.table` node.

2. **The storey walk agrees with the CSV exactly when joined through `GlobalId`.**
   `StoreyOfEntity` joined to `EntityText` on `EntityIndex` and then to
   `nrc_analytics_elements.csv` on `GlobalId` (both inner) gives 103 / 93 / 14 / 8
   elements for Level 1 / Level 2 / T/FDN / Roof, which is
   `nrc_analytics_storeys.csv` row for row, and the embodied-carbon sums match to
   within 0.05. No element is counted twice, so no distinct step is needed. This is
   track A's finding 3 confirmed from the graph side.

3. **`rel.join` suffixes colliding right-hand columns with `_right`.** The
   `StoreyOfEntity`-to-`EntityText` join collides on `EntityIndex`, and the
   elements-CSV join collides on `GlobalId`, `Name`, and `Category`; the aggregate
   names only `StoreyName` and `EmbodiedCarbon_A1A3_kgCO2e`, which are unambiguous.

4. **The door width parameter is named `Ifc:OverallWidth`, not `OverallWidth`, and it is
   stored in metres.** `ParameterText` holds 38 rows under that name, 14 on `IFCDOOR` and
   24 on `IFCWINDOW`, with values such as `0.762` and `1.25`. The graph therefore filters
   `[Name] == 'Ifc:OverallWidth'` and multiplies by 1000. The 14 doors and their widths
   (762, 813, 864, 1250 mm) match `samples/nrc/door_verdicts.csv` door for door, 8 Pass
   and 6 Fail, so the number in the plan holds.

5. **The expression grammar cannot convert text to a number, so the cast is a `rel.sql`
   node.** `ParameterText.Value` is `VARCHAR`; the grammar's builtins are `abs min max
   round floor ceil len lower upper contains startswith endswith coalesce`, with no cast
   and no numeric parse, and `[Value] * 1000` fails the static type check. The `metres`
   node runs `SELECT GlobalId AS globalId, Name AS doorName, CAST(Value AS DOUBLE) AS
   Width_m FROM t1`, which also renames the columns `view3d.color` needs; `rel.derive`
   then computes `Width_mm`. A numeric conversion builtin would remove the need for SQL
   here - a request for a later wave, not a change inside this fence.

6. **`answer` is the `check.rule` node, not `view3d.color`.** `view3d.color` takes two
   tables (instances and values) and outputs the *instance* table with `r,g,b,a` appended;
   it does not pass the verdict rows through. The verdicts therefore have to be read from
   `check.rule`, and `view3d.color` hangs off it as a downstream node.

7. **`view3d.color` joins by an exactly-named shared column, so the graph renames
   `GlobalId` to `globalId`.** That is the name `view3d.instances` gives its column.
   Instance rows are per placed mesh, so the 14 doors arrive as 44 rows.

8. **The engine has no graph-level Run, so an effect node can never reach Ok in a
   document evaluation.** `Evaluator.EvaluateNode` returns `EffectPending` for every
   `NodeCapability.Effect` node and captures its would-be inputs in `EffectInputs`;
   `EvalContext` is only ever constructed with `isRun: false`, and nothing in
   `Ara3D.DataFlowEngine.Runs` executes effects either (`RunReplay` has a TODO for it).
   `ModelGraphTests` therefore asserts that `nrc-enrich-run`'s `answer` node is
   `EffectPending` and every other node is `Ok`, then calls the node from the registry
   with the captured inputs and a context whose `IsRun` is true. When the engine grows a
   Run, that helper should be replaced by it. This is the one place the track could not
   meet the brief's "assert every node is Ok" literally.

9. **`sink.writePsets` takes file paths, so `nrc-enrich-run` is the one model graph that
   needs `{SAMPLES}`.** `sourcePath` is `{SAMPLES}/duplex-enriched.ifc` and `targetPath`
   is `{SAMPLES}/../../artifacts/nrc/duplex-enriched-out.ifc`, which seeding rewrites to
   the gitignored `artifacts/nrc` folder at the repo root. The test copies the document
   with `targetPath` pointed at a temp folder instead, so no test writes into the
   checkout. `nrc-dc-w1-verdicts` uses the placeholder too, for `view3d.instances`.

10. **`psets_to_write.csv` holds 2438 rows over 224 distinct `entityId` values**, which
    is exactly the `valuesWritten` and `entitiesTouched` the summary row reports. Its
    `valueType` values are Real (1103), Label (670), Identifier (664), and Text (1) -
    track D's finding, confirmed end to end: the node accepted every row.
