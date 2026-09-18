# Showcase analyses

End-to-end demos of the graph system over the NRC Duplex data in `samples/nrc`:
one input format each, ending in something a person looks at. The literal
placeholder `{SAMPLES}` stands for `samples/nrc`; relation sources are named
(`nrc` for the CSV folder, `duplex-enriched` for the DuckDB the host prepares
from the IFC in the background). Both host profiles seed the graphs their
registry can run and report the ones they skip.

| Id | Input | Chain | You see | Profile |
|---|---|---|---|---|
| `csv-to-chart` | `nrc_analytics_elements.csv` | `rel.csv`, `rel.aggregate` by Category, `rel.sort`, `rel.materialize`, `chart.bar` | a bar chart of operational carbon per category, Wall first at 22854.1 kgCO2e/year | tables, bim |
| `bos-to-relations` | `duplex-enriched.bos` (prepared from the IFC) | `bos.load`, `rel.fromTable`, `rel.aggregate`, `rel.sort`, `rel.materialize`, `chart.bar` | a bar chart of Duplex entities per IFC category (14 doors) | bim |
| `ifc-to-verdicts-and-chart` | `duplex-enriched.duckdb` (prepared from the IFC) and `duplex-enriched.ifc` | `rel.table` x2, `rel.filter`, `rel.join`, `rel.sql`, `rel.derive`, `rel.materialize`, `check.rule`, then `view3d.color`, `table.aggregate` into `chart.bar`, and `sink.report` | door verdicts (8 Pass, 6 Fail), the doors coloured by verdict in 3D, a verdict count chart, and an HTML report written on Run | bim |

`ifc-to-verdicts-and-chart` continues `nrc-analyses/nrc-dc-w1-verdicts` past the
verdict table, so it exercises every layer at once: IFC to DuckDB, relations to
rows, rows to a rule, and the rule to 3D, 2D, and a file. The report node is an
effect: it stays `EffectPending` until a Run, and its path points at the
gitignored `artifacts/showcase` folder.

Every graph is evaluated by `tests/flow/BimOpenFlow.NrcWorkflows.Tests/ShowcaseGraphTests.cs`,
which cites the expected numbers. `docs/DEMOS.md` lists how to open them.
