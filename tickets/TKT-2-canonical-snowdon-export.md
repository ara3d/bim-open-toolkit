---
id: TKT-2
title: Which Snowdon DuckDB export is canonical for analysis and charts?
status: done
depends_on: []
owner:
fence: []
kind: question
---

Two documents dated 2026-09-18 disagree. docs/bim-flow-duckdb.md says the R5 export populates 48 of 83 tables and holds walls and windows; docs/bim-flow-mcp-demo.md item 1 and .claude/skills/bim-flow say the export has 11 tables with rows and no walls or windows. Either one is an older build, or they are two files. PROJECT.md workflow 1 and every chart over Snowdon depend on the answer, and the bim-flow skill's line 'The supplied Snowdon export has no walls or windows' is wrong for one of them.

To settle: list the tables with rows in the file artifacts/building-model-workflows/snowdon-cli.duckdb and in whatever /duckdb.html loads; record the SHA-256 of the chosen file next to the graphs.

## Direction (owner, 2026-09-26)

Neither export. The canonical Snowdon data comes from the discipline IFC files at C:/Users/cdigg/git/3d-format-shootout/data/misc/Snowdon-IFC (Architectural, Structural, HVAC, Plumbing, Electrical, Facades, Site; IFC4, one Revit 24 export of 2023-08-17), merged into one model. The open problem, not documented anywhere in the repository: each file has its own storeys, rooms or spaces, and other shared concepts, and they need a shared identity after the merge. An investigation is under way; its answer goes to docs/proposals/snowdon-federation.md. This ticket stays open until that design names the merge step and its home; TKT-7 and TKT-13 then build on the merged model rather than on the single Architectural BOS.

## Decision (2026-09-26)

Answered by the investigation in docs/proposals/snowdon-federation.md. The canonical Snowdon data is one BOS with seven documents, each file converted on its own and unioned with AddBimData, plus a correspondence table that a BimOpenFlow graph of SQL rules writes: storeys by elevation within 0.05 ft, grid axes by tag, MEP spaces to rooms by the Room Number property, with candidate, confirmed, rejected, and unmatched rows and their evidence. GlobalId is not a key across files. The merge step is TKT-30; the typed reader is TKT-31. TKT-7 and TKT-13 now depend on TKT-30. Neither single-file export is canonical; the disagreement between the two documents is moot.
