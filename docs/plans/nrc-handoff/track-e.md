# Track E - Model graphs

**Contract revision: nrc-1, including the "Contract amendments" section of
`docs/plans/nrc-handoff-wave.md`. Acknowledged before any file was written.**

State: working (E1 verified and committed; E2 and E3 in progress).
Started from HEAD `264653f` (>= `af76a33`; tracks A-D verified).

## Scope

| Chunk | Graph | Test |
|---|---|---|
| E1 | `samples/nrc-analyses/nrc-storey-of-element.json` | `StoreyOfElement_MatchesTheStoreyCsv` |
| E2 | `samples/nrc-analyses/nrc-dc-w1-verdicts.json` | `DcW1Verdicts_MatchTheDoorVerdictsCsv` |
| E3 | `samples/nrc-analyses/nrc-enrich-run.json` | pending |

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
| E2 | pending |

## Checks and results

All with `--artifacts-path C:\Users\cdigg\AppData\Local\Temp\claude\nrc-wave\track-e`.

- `dotnet test tests/flow/BimOpenFlow.NrcWorkflows.Tests --filter ModelGraphTests` after E1:
  1 passed, 0 failed.
- The same command after E2: 2 passed, 0 failed.

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
