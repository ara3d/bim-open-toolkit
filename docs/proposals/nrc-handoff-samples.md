# Relation samples for the NRC paper handoff

> Plan, 2026-09-18. Maps the needs in `nrc-ifc-llm/paper/handoff-needs.md`
> onto sample graphs built from the `rel.*` pack. Nothing here is built yet.
> Toolkit paths are relative to this repo; paper paths to `nrc-ifc-llm`.

## What the handoff needs from samples

- **M2** (`handoff-needs.md:72-89`): the eight questions in
  `paper/06-proof-of-concept.md:70-79` answered unattended. A graph per
  question is a second, independent source of expected answers next to
  `poc/results/expected_answers.json`. The transcript records that Q2 was
  wrong because the storey walk missed `PartOf` relations.
- **I2** (`:134-139`): a storey-of-element view walking `ContainedIn` and
  `PartOf`.
- **I3** (`:141-147`): the enrichment as one graph, `psets_to_write.csv`
  into `sink.writePsets`. Blocked on typed values.
- **I5** (`:158-162`): rule DC-W1 as `check.rule` over doors, coloured in
  3D, written back.
- **Rules** (`:186-196`): every number reproducible from a command; read
  the answer before writing it.
- **M1** (`:43-70`) is 3D figures from existing `poc/graphs/` documents and
  is blocked by a BFAST bug, not by graphs.

## What the pack already covers

- The paper host runs with `--models poc/data`, so every CSV there is a
  `rel.csv` with source `data` (`SourceRegistries.cs`). The pack is in both
  host profiles.
- Filter and derive use the engine expression grammar; aggregate takes
  `func(col) as name`; sort takes `col desc, col2`; join kinds include
  `left`, `semi`, and `anti`.
- A misspelled column is a node error before any rows are read.
- `rel.materialize` bridges into `view3d.color`, `chart.bar`, `check.rule`,
  and `sink.writePsets`.
- `rel.sql` takes one SELECT over `t1..t3`, which is where a recursive
  relation walk goes.

Not covered: nothing reads an IFC or `.bos` file as a relation, and there
is no `Table` to `Relation` adapter, so `bos.load` cannot feed the pack.

## Proposed graphs

All over `poc/data/nrc_analytics_elements.csv` (218 rows) unless noted.
Each ends in a node named `answer`.

| Id | Need | Chain | Expected shape |
|----|------|-------|----------------|
| `nrc-q1-building-total` | M2 Q1 | csv, aggregate `sum(OperationalCarbon_kgCO2e_per_year) as Total, count(*) as Elements` | 1 row: 37196.2, 218 |
| `nrc-q8-per-storey` | M2 Q2 and Q8 | csv, aggregate by `Storey` (count, sum embodied A1A3, avg EUI), sort `Embodied desc` | 4 rows; Level 1 = 103, 49451.2, 40.5. The answer Q2 missed |
| `nrc-q3-top-elements` | M2 Q3 | csv, select 4 columns, sort by operational carbon desc then GlobalId, limit 5 | 5 rows; first `0iEHWY1$XA8eQeeULq4jpl` at 412.0 |
| `nrc-q5-by-category` | M2 Q5 | csv, aggregate by `Category`, sort `Total desc` | 9 rows; Wall 22854.1 first |
| `nrc-q7-absence` | M2 Q7 | two csv over `nrc_analytics_long.csv`: filter `IfcClass = IFCROOF`, filter `MetricId = NRC.EC.A1A3.TOTAL`, anti join on GlobalId, select | the roof `0jf0rYHfX3RAB3bSIRjmxl` with no embodied-carbon row, as a row not a null |
| `nrc-storey-of-element` | I2, Q2 lesson | table `RelationText` and `EntityText` from `duplex-enriched.duckdb` into `rel.sql` with `WITH RECURSIVE` over `ContainedIn` and `PartOf`, join to the elements CSV, aggregate by storey | 4 rows, Level 1 = 103 |
| `nrc-dc-w1-verdicts` | I5 | table `EntityText` filtered to doors, join `ParameterText` on `OverallWidth`, derive `Width_mm`, materialize, `check.rule` `[Width_mm] >= 850`, `view3d.color` | 14 rows: 8 Pass, 6 Fail |
| `nrc-enrich-run` | I3 | csv `psets_to_write.csv`, materialize, `sink.writePsets` | one summary row. Blocked on typed values |

Check the expression grammar's string-literal quoting before writing the
filters (`'IFCROOF'` with single quotes, per the expressions README).

## Gaps and the smallest change for each

1. **No DuckDB source for the model.** `rel.table` needs a `.duckdb` under
   `poc/data`. Smallest: `ifc_to_bos` with an output path, then a ten-line
   console call to `BosToDuckDB` plus `BosDuckDbViews`. Alternatively
   `ifc_sql_export` of the three views to CSV needs no new code.
2. **No `Table` to `Relation` adapter.** A `rel.fromTable` node registering
   the table as a temp view. Gap 1 sidesteps it.
3. **Typed pset values.** A `valueType` column on `sink.writePsets`;
   `psets_to_write.csv` already carries one.
4. **Storey-of-element view.** A `StoreyOfEntity` view beside the existing
   views in `IfcDuck.cs` and `BosDuckDbViews.cs` closes I2 for both the
   MCP server and the graphs.
5. **Seeding.** The `bim` profile never seeds `samples/relations`. The paper
   loads graphs by PUT, so nothing blocks, but a `samples/nrc-analyses`
   folder with a `{POC}` placeholder would let the toolkit test them.
6. **Absolute paths.** `poc/graphs/*.json` hardcode a user path. Relation
   graphs carry source names and are portable.
