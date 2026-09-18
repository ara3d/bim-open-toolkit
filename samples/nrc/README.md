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

`.gitignore` excludes `*.ifc` repository-wide and re-includes `samples/nrc/*.ifc`,
so the IFC is committed on purpose.

`duplex-enriched.duckdb` is **not** committed. It is generated from the IFC by
`Ara3D.Ifc.DuckDb.IfcDuckDbBuild.Build` and matches the repository-wide `*.duckdb`
ignore rule. Build it on demand; never stage one.
