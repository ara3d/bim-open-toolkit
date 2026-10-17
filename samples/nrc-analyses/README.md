# NRC handoff sample graphs

Graph documents that answer the NRC paper's proof-of-concept questions over the
data in `samples/nrc`. Every graph ends in a node named `answer`, and every
source is named (`nrc` for the CSV folder, `duplex-enriched` and `duplex-base`
for the DuckDB databases built from the two IFC files), so the graphs are portable. Both host profiles seed them
into an empty analysis store and add `samples/nrc` to their model roots. The two graphs
that write a file on Run, `nrc-enrich-run` and `nrc-dc-w1-verdicts`, target
`{ARTIFACTS}/nrc/...`; the seeder resolves `{ARTIFACTS}` to the checkout's git-ignored
`artifacts` folder.

Every graph opens with an `about` note stating the question it answers. Aggregates keep the
unit in the column name (`OperationalCarbon_kgCO2e_per_year`, `EmbodiedCarbon_A1A3_kgCO2e`,
`MeanEui_kWh_per_m2_year`), so a table or chart read alone still says what it measures.

| Graph | Answers | Runs in profile |
|-------|---------|-----------------|
| `nrc-q1-building-total` | total operational carbon (37,196.2 kgCO2e/yr) over 218 elements | tables, bim |
| `nrc-q2-storey-eui` | Level 1 and Level 2 mean energy use intensity, the two storeys filtered before the average and the higher first (Level 2, 40.56) | tables, bim |
| `nrc-q3-top-elements` | the five elements with the highest operational carbon, by name and category | tables, bim |
| `nrc-q4-door-instances` | the operational carbon of the door with GlobalId 1hOSvn6df7F8_7GcBWlS8Z (one row, 54.0; see below) | tables, bim |
| `nrc-q5-by-category` | operational carbon per IFC class (14 rows, IFCWALLSTANDARDCASE first; the file carries no Category property), drawn as a bar chart by `chart` | tables, bim |
| `nrc-q6-analysis-run` | the analysis run id, scenario, computed time, and source tool every element cites, with its element count | tables, bim |
| `nrc-q7-absence` | the analysed elements with no embodied-carbon property set: exactly one, the IfcRoof 0jf0rYHfX3RAB3bSIRjmxl, as a row with the count of metric rows it does have (`OtherMetrics`, 2) | tables, bim |
| `nrc-q8-per-storey` | per-storey element count (and how many have an embodied-carbon value), embodied carbon A1-A3, and mean energy intensity | tables, bim |
| `nrc-q9-zone-eui` | the zone with the highest energy use intensity: each zone of `nrc-zones.csv`, energy over floor area from `nrc_analytics_spaces.csv`, highest first (Unit B Level 1, 78.04 kWh/m2/yr; synthetic) | tables, bim |
| `nrc-storey-of-element` | storey of every element by walking ContainedIn, PartOf, and MemberOf (without MemberOf, 51 of Level 1's 103 elements go unplaced), each placed once by the smallest `Depth`, as `nrc-rollup` does (103, 93, 14, 8) | tables, bim |
| `nrc-dc-w1-verdicts` | rule DC-W1 over doors (8 Pass, 6 Fail; answer columns Name, Width_mm, GlobalId), coloured in 3D, a verdict count chart, and an HTML report written on Run into `artifacts/nrc` | bim only (`check.rule`, `view3d.color`) |
| `nrc-element-psets` | the element property-set rows: each value of `nrc_analytics_long.csv` placed by `nrc-metrics.csv`, keyed by the STEP id of `duplex-base`, with the run facts of `nrc-run.csv` (2,394 rows; three small `rel.sql` steps and their union) | tables, bim |
| `nrc-rollup` | the storey and building summary rows (`NRC_StoreySummary`, `NRC_BuildingSummary`), each element placed by `StoreyOfElement` and aggregated by its metric's `Rollup`, plus the project's `NRC_AnalyticsProvenance` from `nrc-run.csv` (47 rows in `answer`); a second output `zoneAnswer` holds the 28 `NRC_ZoneSummary` rows of the four zones, computed from `nrc_analytics_spaces.csv` and `nrc-zones.csv` (the `ratio:` rule divides zone energy by zone floor area) | tables, bim |
| `nrc-enrich-run` | the rows of `nrc-element-psets` and `nrc-rollup` written into a copy of `duplex-base.ifc` (2,469 values on 228 entities, with four `IfcZone` groups written from `nrc-zones.csv`); it carries copies of both graphs because a graph cannot reference another, and one `rows` step unions them | bim only (`sink.writePsets`) |
| `nrc-color-operational-carbon` | graph input `model`; the Duplex model coloured by operational carbon, viridis gradient, unmatched instances grey (paper Figure 5); one "colour by an analytics column" flow, its `answer` node's `valueColumn`/`colorMap` set per figure (see `scripts/nrc-walkthrough.mjs`) | bim only (`view3d.instances`, `view3d.color`) |
| `nrc-color-zone-eui` | graph input `model`; the 20 zoned spaces of the Duplex coloured by the energy use intensity stored on their `IfcZone` (the `NRC_ZoneSummary` value, read back through `ZoneOfSpace`), viridis, every other instance grey (synthetic) | bim only (`view3d.color`) |
| `nrc-storey-carbon-chart` | embodied and operational carbon per storey as a bar chart with readable series names, storeys only (Figure 2), plus a Building total table (115,730.3 kgCO2e embodied, 37,196.2 kgCO2e/yr operational) | tables, bim |
| `nrc-property-values` | the 2,469 NRC property values read back from `duplex-enriched.ifc`, one for each row `nrc-enrich-run` handed the byte-exact writer, zone sets included (Figure 4), with `rel.filter`, `rel.join`, `rel.select`, and `rel.sort` | tables, bim |
| `nrc-join-analytics` | a TKT-52 template with graph inputs `csv` and `model`, joining `test-kit/analytics_dataset_with_levels.csv` to `duplex-base.ifc` by GlobalId: rows with no entity (0), physical elements with no row (21), rows matching a non-physical entity (52), per-storey totals, and a Level-versus-storey agreement count (61 of 218 rows disagree); `model` swaps the 3D meshes only, the entity tables still come from the duplex-base database | bim only (`view3d.instances`, `view3d.color`) |

Expected numbers come from `nrc-ifc-llm/poc/results/expected_answers.json` and
`poc/data/nrc_analytics_storeys.csv`; the tests in
`tests/studio/BimOpenFlow.NrcWorkflows.Tests` cite them. The five figure graphs are
what `scripts/nrc-walkthrough.mjs` captures for the paper; `FigureGraphTests`
guards them (216 of the 218 analysed elements have a mesh, so that is the
coloured count).

`nrc-q4-door-instances` asks by GlobalId: "What is the operational carbon of the door
with GlobalId 1hOSvn6df7F8_7GcBWlS8Z?" The earlier wording named the door type
M_Single-Flush:0762 x 2032mm, a Revit family:type name that four IFCDOOR instances
share (`door_verdicts.csv`'s DC-M1 evidence), each with a different value. A
GlobalId names one instance, so the graph returns one row: 54.0 kgCO2e/yr.

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
  has no `NRC_EmbodiedCarbon`.
- A dictionary property with no value in the long table takes the run fact of
  the same name from `nrc-run.csv` (today only `GridEmissionFactor_kgCO2e_per_kWh`).
- Each element is placed on one storey: its `StoreyOfElement` row with the
  smallest `Depth`. Every element with a GlobalId is placed in the model's
  `IFCBUILDING`.
- Storey and building rows aggregate by the metric's `Rollup` (`sum`, `mean`,
  or `count` of distinct elements) and round to its `Decimals`.
- Every set carries `AnalysisRunId` and `ScenarioName`; the project's
  `NRC_AnalyticsProvenance` carries every field of `nrc-run.csv`.
- Rows are ordered by (entityId, psetName, paramName), which is unique, so a
  Run writes the same bytes every time.
