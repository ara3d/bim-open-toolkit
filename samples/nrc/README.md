# samples/nrc

The NRC proof-of-concept data. The element values and CSVs are byte-for-byte
copies from the paper repository `nrc-ifc-llm`, folder `poc/data`, taken
2026-09-18; that repository is read-only for this toolkit. Since TKT-48 the
enriched IFC is made here, by a Run of `samples/nrc-analyses/nrc-enrich-run`,
and the paper repository copies it back. The files live here so the toolkit's
own tests are self-contained and so a host started with `samples/nrc` as a
model root exposes the source name `nrc`.

| File | Rows | What it holds |
|---|---|---|
| `nrc_analytics_elements.csv` | 218 | one row per element: GlobalId, IFC type, storey, category, embodied and operational carbon, energy use intensity |
| `nrc_analytics_long.csv` | 870 | the same numbers in long form: one row per (element, metric) |
| `nrc_analytics_storeys.csv` | 5 | per-storey rollups plus a `Building` total row, as the generator computed them; a reference the tests compare the `nrc-rollup` graph against, not an input |
| `door_verdicts.csv` | 56 | door rule verdicts with evidence and citation text |
| `duplex-enriched.ifc` | — | `duplex-base.ifc` plus 659 property sets holding 2,441 values, written by a Run of `nrc-enrich-run`; a test asserts a fresh Run reproduces it byte for byte |
| `duplex-base.ifc` | — | the unenriched Duplex, byte-identical to `nrc-ifc-llm/IFC-Test-Kit/duplex.ifc` (SHA-256 `b347a2c8…06ed`); the source the enrichment graphs write into |
| `nrc-metrics.csv` | 15 | the metric dictionary: one row per metric and level, naming the property set, property, value type, unit, stage, rollup rule, and the decimals a rolled-up value is rounded to (TKT-48) |
| `nrc-run.csv` | 12 | run-level facts written once: run id, scenario, grid emission factor, and the provenance fields |

Every value is synthetic; NRC has supplied no model or dataset.

`.gitattributes` marks `samples/nrc/*.ifc` as binary so line endings are never converted.
`.gitignore` excludes `*.ifc` repository-wide and re-includes `samples/nrc/*.ifc`,
so the IFC is committed on purpose.

`duplex-enriched.duckdb` and `duplex-base.duckdb` are **not** committed. Each is generated from its IFC by
`Ara3D.Ifc.DuckDb.IfcDuckDbBuild.Build` and matches the repository-wide `*.duckdb`
ignore rule. Build them on demand; never stage one. `duplex-enriched.bos` is
likewise ignored: the host rebuilds it with `IfcDuckDbBuild.SaveBos` whenever the
IFC is newer (`SamplePreparation.NrcBos`).

To regenerate `duplex-enriched.ifc` after a deliberate change to the rows, run
`RollupGraphTests.EnrichRun_WritesTheCommittedFileByteForByte`; its failure
names the fresh file, which replaces the committed one.

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
