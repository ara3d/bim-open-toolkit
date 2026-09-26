---
id: TKT-13
title: Sample graphs with charts across every populated Snowdon table family
status: open
depends_on: [TKT-2, TKT-7, TKT-20]
owner:
fence: [samples/duckdb-analyses/**, samples/snowdon-analyses/**, docs/bim-flow-duckdb.md]
---

## Acceptance criteria

- [ ] At least one graph per populated table family in the canonical Snowdon export (walls, windows, floors, pipes, ducts, materials, plus the existing storeys, spaces, doors, roofs), each ending in a chart node and a table
- [ ] Each graph is green in check-bim-flow-duckdb.mjs and listed with the numbers it produces in the samples README
- [ ] A missing measure stays NULL and the README says so (principle 3)

Serves W1 and W3. docs/bim-flow-duckdb.md says the R5 export fills 48 of 83 tables while the nine samples query storeys, spaces, doors, and roofs only; the owner's aim is detailed analysis and charts over Snowdon. Waits on TKT-2 (which export), TKT-7 (clean-clone sources), and TKT-20 (a chart pane in the studio).
