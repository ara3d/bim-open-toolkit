---
id: TKT-13
title: Sample graphs with charts across every populated Snowdon table family
status: open
depends_on: [TKT-2, TKT-7]
owner:
fence: [samples/duckdb-analyses/**, samples/snowdon-analyses/**, docs/bim-flow-duckdb.md]
---

Serves W1 and W3. docs/bim-flow-duckdb.md says the R5 export fills 48 of 83 tables while the nine samples query storeys, spaces, doors, and roofs only; the owner's aim is detailed analysis and charts over Snowdon. Waits on TKT-2 (which export) and TKT-7 (clean-clone sources).
