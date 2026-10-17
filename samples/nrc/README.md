# samples/nrc

The NRC proof-of-concept data. The element values and CSVs are byte-for-byte
copies from the paper repository `nrc-ifc-llm`, folder `poc/data`, taken
2026-09-18; that repository is read-only for this toolkit. Since TKT-48 the
enriched IFC is made here, by a Run of `samples/nrc-analyses/nrc-enrich-run`,
and the paper repository copies it back. The files live here so the toolkit's
own tests are self-contained and so a host started with `samples/nrc` as a
model root exposes the source name `nrc`.
The Duplex files are buildingSMART International's, CC BY 4.0; `NOTICE.md` in this folder carries the attribution.

| File | Rows | What it holds |
|---|---|---|
| `nrc_analytics_elements.csv` | 218 | one row per element: GlobalId, IFC type, storey, category, embodied and operational carbon, energy use intensity |
| `nrc_analytics_long.csv` | 870 | the same numbers in long form: one row per (element, metric) |
| `nrc_analytics_storeys.csv` | 5 | per-storey rollups plus a `Building` total row, as the generator computed them; a reference the tests compare the `nrc-rollup` graph against, not an input |
| `door_verdicts.csv` | 56 | door rule verdicts with evidence and citation text |
| `duplex-enriched.ifc` | — | `duplex-base.ifc` plus 663 property sets holding 2,469 values and four `IfcZone` groups (one `NRC_ZoneSummary` set each) and an `IfcDocumentReference` on the project naming `nrc_analytics_long.csv` with its format, SHA-256, and join key `GlobalId`, written by a Run of `nrc-enrich-run`; a test asserts a fresh Run reproduces it byte for byte |
| `duplex-base.ifc` | — | the unenriched Duplex, byte-identical to `nrc-ifc-llm/IFC-Test-Kit/duplex.ifc` (SHA-256 `b347a2c8…06ed`); the source the enrichment graphs write into |
| `nrc-metrics.csv` | 20 | the metric dictionary: one row per metric and level, naming the property set, property, value type, unit, stage, rollup rule, and the decimals a rolled-up value is rounded to (TKT-48) |
| `nrc_analytics_spaces.csv` | 60 | the synthetic per-space values of the 20 conditioned spaces: floor area (a copy of the model's `GSA BIM Area`, rounded to 0.01 m2), annual operational energy, and annual operational carbon; made by `make-zone-data.mjs`; no zone total is supplied |
| `nrc-zones.csv` | 20 | the Duplex zoning, synthetic: one zone per dwelling per floor (Unit A Level 1, Unit A Level 2, Unit B Level 1, Unit B Level 2) over the 20 conditioned spaces, the unconditioned roof space left out; made by `node samples/nrc/make-zone-data.mjs` from the spaces of `duplex-base.ifc`; the model has no zones, so `nrc-enrich-run` writes this table back as `IfcZone` groups |
| `nrc-run.csv` | 12 | run-level facts written once: run id, scenario, grid emission factor, and the provenance fields |

Every value is synthetic; NRC has supplied no model or dataset.

`ids/` holds the two IDS files the checking graphs read (see `ids/README.md`).
`ids/nrc-analytics.ids` is generated from `nrc-metrics.csv` by `node scripts/nrc-ids.mjs`,
so the property sets and names it requires are the ones the enrichment writes; rerun it after
editing the dictionary, or `--check` to see whether the file is current. `dc-w1.ids` is
written by hand.

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
| `AnalysisRunId`, `ScenarioName` | every NRC set: the three element sets, `NRC_StoreySummary`, `NRC_BuildingSummary`, `NRC_ZoneSummary`, and the provenance set |
| `GridEmissionFactor_kgCO2e_per_kWh` | each element's `NRC_OperationalCarbon`, because `nrc-metrics.csv` lists it there as `NRC.GRID.FACTOR` with no value in the long table; also the provenance set |
| every field | the project's `NRC_AnalyticsProvenance`, one property per row, with the row's `ValueType` |

`MetricDictionaryURI` names `nrc-metrics.csv` relative to the enriched IFC, so
an agent that finds the provenance set can find the dictionary beside the file.

## The zone level

The Duplex has no zones. `nrc-zones.csv` is the zoning, supplied as analytics-contract data (an energy
model would supply it): one zone per dwelling per floor, over the 20 conditioned spaces, the
unconditioned roof space left out. `nrc-enrich-run` writes it back as four `IfcZone` groups, each
assigned its spaces through `IfcRelAssignsToGroup`, and attaches one `NRC_ZoneSummary` set to each.
The set's values are computed by `nrc-rollup` from the space values of `nrc_analytics_spaces.csv`:
counts and sums by the dictionary's `count` and `sum` rules, and the zone intensity by the
`ratio:NRC.ENERGY.ANNUAL/NRC.AREA.FLOOR` rule, zone energy divided by the sum of the zone's floor areas
in kWh/m2/yr. Element values are unchanged, so the answers to questions 1 to 8 do not move. `ZoneOfSpace`
reads the zoning back from the enriched file. All zone and space values are synthetic.

