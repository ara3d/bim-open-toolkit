---
id: TKT-30
title: Merge the seven Snowdon IFC files into one BOS with a correspondence table for storeys, grids, and spaces
status: claimed
depends_on: []
owner: assembly-line-supervisor
fence: [src/**/BuildingModel*/**, src/**/Bos*/**, tools/building-model-workflows/**, samples/snowdon-analyses/**, samples/duckdb-analyses/**, docs/bim-flow-duckdb.md, BIMOPENFLOW.md, scripts/**]
---

## Acceptance criteria

- [ ] A documented command converts the seven discipline files (Architectural, Structural, HVAC, Plumbing, Electrical, Facades, Site) one at a time with the existing converter and unions them with AddBimData into one seven-document BOS, recording the length unit (feet) and keeping the Other.Category parameter so Rooms, Areas, and MEP Spaces stay separable
- [ ] A committed BimOpenFlow graph whose rules are SQL (storeys by elevation within 0.05 ft with name and GlobalId as corroboration; grid axes by tag; MEP spaces to Architectural rooms by the Room Number property) writes a correspondence table with one row per candidate, confirmed, rejected, or unmatched match, the rule and its version, and the evidence values; confirmations live in a second table the graph joins in, so a rerun never erases a decision
- [ ] Run over the real files, the graph reproduces the investigation's numbers: 26 elevation groups, 12 spanning files, the four storey conflicts (Structural L1 names, Electrical L1 - Block 37 at -12.7 mm, the parapets, Site Project at 0.0), and 40 HVAC and 47 Electrical room claims, with Plumbing unmatched
- [ ] DuckDB views FederatedStorey and a federated StoreyOfEntity read the union plus the table, unmatched and conflicting storeys appear as their own rows, and the Snowdon sample graphs group by them; the exported DuckDB and the correspondence table have their SHA-256 recorded next to the graphs
- [ ] docs/bim-flow-duckdb.md and BIMOPENFLOW.md name this export as the canonical Snowdon data and the numbers W1 checks (doors, spaces) are re-derived from it

Decides TKT-2: the canonical Snowdon data is the merged seven-file model, not either single-file export. Design and evidence: docs/proposals/snowdon-federation.md (steps 1 to 4 of 'Where it lives'). GlobalId is not a usable key across the files (the same storey id is L2 in three files and Datum in Site), storeys join on elevation, grids on axis tag, and MEP spaces relate to rooms through Room Number, which means 'space inside room', not 'same thing'. The typed BuildingModel reader is TKT-31. Serves W1 and W3; TKT-7 and TKT-13 wait on this.
