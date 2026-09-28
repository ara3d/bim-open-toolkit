# NRC handoff sample graphs

Graph documents that answer the NRC paper's proof-of-concept questions over the
data in `samples/nrc`. Every graph ends in a node named `answer`, and every
source is named (`nrc` for the CSV folder, `duplex-enriched` and `duplex-base`
for the DuckDB databases built from the two IFC files), so the graphs are portable. Both host profiles seed them
into an empty analysis store and add `samples/nrc` to their model roots.

| Graph | Answers | Runs in profile |
|-------|---------|-----------------|
| `nrc-q1-building-total` | total operational carbon and element count | tables, bim |
| `nrc-q2-storey-eui` | Level 1 and Level 2 mean energy use intensity, sorted so the higher storey is first | tables, bim |
| `nrc-q3-top-elements` | the five elements with the highest operational carbon | tables, bim |
| `nrc-q4-door-instances` | the operational carbon of every M_Single-Flush:0762 x 2032mm door instance (the name matches four doors, not one; see below) | tables, bim |
| `nrc-q5-by-category` | operational carbon per category | tables, bim |
| `nrc-q6-analysis-run` | the analysis run id, scenario, computed time, and source tool every element cites, with its element count | tables, bim |
| `nrc-q7-absence` | the roof with no embodied-carbon row, as a row | tables, bim |
| `nrc-q8-per-storey` | per-storey element count (and how many have an embodied-carbon value), embodied carbon A1-A3, and mean energy intensity | tables, bim |
| `nrc-storey-of-element` | storey of every element by walking ContainedIn, PartOf, and MemberOf (without MemberOf, 51 of Level 1's 103 elements go unplaced) | tables, bim |
| `nrc-dc-w1-verdicts` | rule DC-W1 over doors, coloured in 3D | bim only (`check.rule`, `view3d.color`) |
| `nrc-element-psets` | the element property-set rows: each value of `nrc_analytics_long.csv` placed by `nrc-metrics.csv`, keyed by the STEP id of `duplex-base`, with the run facts of `nrc-run.csv` (2,394 rows) | tables, bim |
| `nrc-rollup` | the storey and building summary rows (`Pset_NRCStoreySummary`, `Pset_NRCBuildingSummary`), each element placed by `StoreyOfElement` and aggregated by its metric's `Rollup`, plus the project's `Pset_NRCAnalyticsProvenance` from `nrc-run.csv` (47 rows) | tables, bim |
| `nrc-enrich-run` | the rows of `nrc-element-psets` and `nrc-rollup` written into a copy of `duplex-base.ifc` (2,441 values on 224 entities); it carries copies of both graphs because a graph cannot reference another | bim only (`sink.writePsets`) |
| `nrc-color-operational-carbon` | the Duplex model coloured by operational carbon, viridis gradient, unmatched instances grey (paper Figure 5); one "colour by an analytics column" flow, its `answer` node's `valueColumn`/`colorMap` set per figure (see `scripts/nrc-walkthrough.mjs`) | bim only (`view3d.instances`, `view3d.color`) |
| `nrc-color-embodied-carbon` | the same graph as `nrc-color-operational-carbon` with `valueColumn: EmbodiedCarbon_A1A3_kgCO2e` (Figure 6); TKT-93 folds this into `nrc-color-operational-carbon`'s parameter, but the file and id stay committed because `samples/notebooks/s06-paper-figures.notebook.json` opens this id directly — remove only after that notebook is updated | bim only |
| `nrc-color-category` | the same graph with `valueColumn: Category`, `colorMap: category10`, nine categories (Figure 7); same TKT-93 hold as `nrc-color-embodied-carbon` | bim only |
| `nrc-storey-carbon-chart` | embodied and operational carbon per storey as a bar chart, storeys only (Figure 2) | tables, bim |
| `nrc-property-values` | the 2,441 NRC property values read back from `duplex-enriched.ifc`, one for each row `nrc-enrich-run` handed the byte-exact writer (Figure 4) | tables, bim |
| `nrc-join-analytics` | a TKT-52 template joining `test-kit/analytics_dataset_with_levels.csv` to `duplex-base.ifc` by GlobalId: rows with no entity, physical elements with no row, rows matching a non-physical entity, and per-storey totals | tables, bim |

Expected numbers come from `nrc-ifc-llm/poc/results/expected_answers.json` and
`poc/data/nrc_analytics_storeys.csv`; the tests in
`tests/flow/BimOpenFlow.NrcWorkflows.Tests` cite them. The five figure graphs are
what `scripts/nrc-walkthrough.mjs` captures for the paper; `FigureGraphTests`
guards them (216 of the 218 analysed elements have a mesh, so that is the
coloured count).

`nrc-q4-door-instances` has no single deterministic scalar: the paper's Q4 asks
for "the door named M_Single-Flush:0762 x 2032mm", but that name is a Revit
family:type name, not an instance name, and `nrc_analytics_elements.csv` (and
`door_verdicts.csv`'s DC-M1 evidence) show four IFCDOOR instances share it,
each with a different operational carbon value. `scripts/demo-ifc-mcp.mjs`
does not replay Q4 at all, so there is no cited expected value to reconcile;
the graph instead lists all four instances by their STEP id (`EntityId`),
which is the deterministic data the paper's answer would have to pick from
or sum; row 1, EntityId 8066, is the paper's own pick.

`nrc-q6-analysis-run` answers both halves of Q6 deterministically: "which
run" (`AnalysisRunId`, `ScenarioName`) is the same for every one of the 218
elements; "when" (`ComputedAt`) and the tool that computed it (`SourceTool`)
come from `samples/nrc/nrc-run.csv`, a run-level fact file the elements
themselves do not carry.

## How the enrichment rows are derived

`nrc-element-psets` and `nrc-rollup` compute every row `nrc-enrich-run` writes;
nothing in `samples/nrc` supplies a total. Both read the model as source
`duplex-base`, the unenriched file, so neither reads the output of its own last
Run. The rules, all driven by `samples/nrc/nrc-metrics.csv`:

- An element gets one set per dictionary `PropertySet` in which it has at least
  one value in `nrc_analytics_long.csv`; the roof has no embodied value, so it
  has no `Pset_NRCEmbodiedCarbon`.
- A dictionary property with no value in the long table takes the run fact of
  the same name from `nrc-run.csv` (today only `GridEmissionFactor_kgCO2e_per_kWh`).
- Each element is placed on one storey: its `StoreyOfElement` row with the
  smallest `Depth`. Every element with a GlobalId is placed in the model's
  `IFCBUILDING`.
- Storey and building rows aggregate by the metric's `Rollup` (`sum`, `mean`,
  or `count` of distinct elements) and round to its `Decimals`.
- Every set carries `AnalysisRunId` and `ScenarioName`; the project's
  `Pset_NRCAnalyticsProvenance` carries every field of `nrc-run.csv`.
- Rows are ordered by (entityId, psetName, paramName), which is unique, so a
  Run writes the same bytes every time.
