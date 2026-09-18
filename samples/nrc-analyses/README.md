# NRC handoff sample graphs

Graph documents that answer the NRC paper's proof-of-concept questions over the
data in `samples/nrc`. Every graph ends in a node named `answer`, and every
source is named (`nrc` for the CSV folder, `duplex-enriched` for the DuckDB
built from the IFC), so the graphs are portable. Both host profiles seed them
into an empty analysis store and add `samples/nrc` to their model roots.

| Graph | Answers | Runs in profile |
|-------|---------|-----------------|
| `nrc-q1-building-total` | total operational carbon and element count | tables, bim |
| `nrc-q8-per-storey` | per-storey count, embodied carbon A1-A3, and mean energy intensity | tables, bim |
| `nrc-q3-top-elements` | the five elements with the highest operational carbon | tables, bim |
| `nrc-q5-by-category` | operational carbon per category | tables, bim |
| `nrc-q7-absence` | the roof with no embodied-carbon row, as a row | tables, bim |
| `nrc-storey-of-element` | storey of every element by walking ContainedIn and PartOf | tables, bim |
| `nrc-dc-w1-verdicts` | rule DC-W1 over doors, coloured in 3D | bim only (`check.rule`, `view3d.color`) |
| `nrc-enrich-run` | `psets_to_write.csv` written back into a copy of the IFC | bim only (`sink.writePsets`) |

Expected numbers come from `nrc-ifc-llm/poc/results/expected_answers.json` and
`poc/data/nrc_analytics_storeys.csv`; the tests in
`tests/flow/BimOpenFlow.NrcWorkflows.Tests` cite them.
