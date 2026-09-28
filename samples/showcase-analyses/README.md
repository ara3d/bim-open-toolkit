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
| `bfast-buffers` | `samples/tables/sample.bfast` (reached as `{SAMPLES}/../tables/sample.bfast`) | `bfast.read` into `view.table`; `bfast.buffer` (unitPrices as float64) into `view.table` | the four-buffer directory (32, 32, 64, 25 bytes) and the eight prices, 99.99 fourth | tables, bim |

The door check that runs from the IFC through relations, a rule, 3D, a chart and an
HTML report is one flow, `nrc-analyses/nrc-dc-w1-verdicts` (TKT-93 merged
`ifc-to-verdicts-and-chart` into it). Its report node is an effect: it stays
`EffectPending` until a Run and writes into the gitignored `artifacts/nrc` folder.

Every graph is evaluated by `tests/flow/BimOpenFlow.NrcWorkflows.Tests/ShowcaseGraphTests.cs`
(`bfast-buffers` by `BfastGraphTests.cs` beside it), which cite the expected numbers. `docs/DEMOS.md` lists how to open them.
