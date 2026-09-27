# samples/nrc

Byte-for-byte copies of the proof-of-concept data from the paper repository
`nrc-ifc-llm`, folder `poc/data`, taken 2026-09-18. That repository is read-only
for this toolkit; the copies live here so the toolkit's own tests are
self-contained and so a host started with `samples/nrc` as a model root exposes
the source name `nrc`.

| File | Rows | What it holds |
|---|---|---|
| `nrc_analytics_elements.csv` | 218 | one row per element: GlobalId, IFC type, storey, category, embodied and operational carbon, energy use intensity |
| `nrc_analytics_long.csv` | 870 | the same numbers in long form: one row per (element, metric) |
| `nrc_analytics_storeys.csv` | 5 | per-storey rollups plus a `Building` total row |
| `psets_to_write.csv` | 2438 | property-set writes keyed by STEP entity id, with a `valueType` column |
| `door_verdicts.csv` | 56 | door rule verdicts with evidence and citation text |
| `duplex-enriched.ifc` | — | the buildingSMART Duplex sample enriched with the property sets above |
| `duplex-base.ifc` | — | the unenriched Duplex, byte-identical to `nrc-ifc-llm/IFC-Test-Kit/duplex.ifc` (SHA-256 `b347a2c8…06ed`); the source the enrichment graphs write into |
| `nrc-metrics.csv` | 15 | the metric dictionary: one row per metric and level, naming the property set, property, value type, unit, stage, rollup rule, and the decimals a rolled-up value is rounded to (TKT-48) |
| `nrc-run.csv` | 12 | run-level facts written once: run id, scenario, grid emission factor, and the provenance fields |

Every value is synthetic; NRC has supplied no model or dataset.

`.gitattributes` marks `samples/nrc/*.ifc` as binary so line endings are never converted.
`.gitignore` excludes `*.ifc` repository-wide and re-includes `samples/nrc/*.ifc`,
so the IFC is committed on purpose.

`duplex-enriched.duckdb` and `duplex-base.duckdb` are **not** committed. Each is generated from its IFC by
`Ara3D.Ifc.DuckDb.IfcDuckDbBuild.Build` and matches the repository-wide `*.duckdb`
ignore rule. Build them on demand; never stage one.

## Where the run facts go

The graphs `nrc-element-psets` and `nrc-rollup` (in `samples/nrc-analyses`)
place the fields of `nrc-run.csv` as follows:

| Field | Written to |
|---|---|
| `AnalysisRunId`, `ScenarioName` | every NRC set: the three element sets, `Pset_NRCStoreySummary`, `Pset_NRCBuildingSummary`, and the provenance set |
| `GridEmissionFactor_kgCO2e_per_kWh` | each element's `Pset_NRCOperationalCarbon`, because `nrc-metrics.csv` lists it there as `NRC.GRID.FACTOR` with no value in the long table; also the provenance set |
| every field | the project's `Pset_NRCAnalyticsProvenance`, one property per row, with the row's `ValueType` |

`MetricDictionaryURI` names `nrc-metrics.csv` relative to the enriched IFC, so
an agent that finds the provenance set can find the dictionary beside the file.
