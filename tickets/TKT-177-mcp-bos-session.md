---
id: TKT-177
title: A BOS session in the MCP server: one cached model per .bos, from IFC or Fragments, that every query tool can use
status: done
depends_on: []
owner:
fence: [deps/bim-open-data/src/mcp/BimOpenMcp.Ifc/**, deps/bim-open-data/tests/mcp/**]
workflow: [W1, W2]
related: [TKT-172]
created: 2026-10-10
closed: 2026-10-11
---

## Acceptance criteria

- [x] A session keyed by .bos path holds the IBimData, its DuckDB database, and the scene view; IFC and Fragments sessions create one
- [x] bos_sql and the bos_export_* tools reuse it instead of re-reading the archive per call, and ifc_table works on a .bos

Found in the BOS formats wave (docs/plans/bos-formats.md, Architecture notes). IfcSessionCache keys sessions by .ifc path, so a .frag or .bos cannot be opened or cached; the bos_* tools re-read the archive on every call.

Done 2026-10-11 (bim-open-data): `e6029e4`, `f0652fc`, `61715c1` (BosSession, BosSessionCache), `1373cab` (ifc_table/ifc_sql/ifc_sql_export/ifc_export_glb take a .bos path), `dfb106e` (leases, content-keyed derived files), `4aed48c`, `964e91a` (BosSession.FromData). bos_sql and bos_table stay as aliases. Leftovers: TKT-194, TKT-199.
