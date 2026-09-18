# Track E - Model graphs

**Contract revision: nrc-1, including the "Contract amendments" section of
`docs/plans/nrc-handoff-wave.md`. Acknowledged before any file was written.**

State: working (E1 verified and committed; E2 and E3 in progress).
Started from HEAD `264653f` (>= `af76a33`; tracks A-D verified).

## Scope

| Chunk | Graph | Test |
|---|---|---|
| E1 | `samples/nrc-analyses/nrc-storey-of-element.json` | `StoreyOfElement_MatchesTheStoreyCsv` |
| E2 | `samples/nrc-analyses/nrc-dc-w1-verdicts.json` | pending |
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
| E1 | pending |

## Checks and results

All with `--artifacts-path C:\Users\cdigg\AppData\Local\Temp\claude\nrc-wave\track-e`.

- `dotnet test tests/flow/BimOpenFlow.NrcWorkflows.Tests --filter ModelGraphTests` after E1:
  1 passed, 0 failed.

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
