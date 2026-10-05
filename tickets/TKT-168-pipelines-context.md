---
id: TKT-168
title: Pipelines context: a page of ETL graphs that convert between IFC, BOS, DuckDB, Parquet, CSV, and XLSX over a public building, run from the editor
status: open
depends_on: [TKT-12]
owner:
fence: [samples/pipeline-analyses/**, bimopenflow/web/packages/studio-web/**, docs/DEMOS.md, site/**]
workflow: [W3]
created: 2026-10-05
---

## Acceptance criteria

- [ ] Four graphs over a public building each read one format and write another (IFC to BOS, BOS to DuckDB, a DuckDB query to Parquet and to XLSX, a CSV join written back as a property set), and after Run the files exist and the run record names them
- [ ] The page names its audience (a data engineer feeding downstream systems) and shows each writer as pending before Run and as written after
- [ ] Rerunning an unchanged graph is a no-op the run record explains by content hash

Serves W3 (export and report after Run) and principle 2 (nothing writes until Run). The fourth of the five demo contexts in docs/proposals/demo-contexts.md, and the one most blocked: sinks do not execute until TKT-12 lands, so this context is built fourth. The readers exist (view3d.instances for IFC, bos.load, duck.*, rel.csv, xlsx.read); GLB and BOS export sinks are TKT-66. Missing readers or writers found while building the samples are filed in ara3d/bim-open-data.
