---
id: TKT-177
title: A BOS session in the MCP server: one cached model per .bos, from IFC or Fragments, that every query tool can use
status: open
depends_on: []
owner:
fence: [deps/bim-open-data/src/mcp/BimOpenMcp.Ifc/**, deps/bim-open-data/tests/mcp/**]
workflow: [W1, W2]
related: [TKT-172]
created: 2026-10-10
---

## Acceptance criteria

- [ ] A session keyed by .bos path holds the IBimData, its DuckDB database, and the scene view; IFC and Fragments sessions create one
- [ ] bos_sql and the bos_export_* tools reuse it instead of re-reading the archive per call, and ifc_table works on a .bos

Found in the BOS formats wave (docs/plans/bos-formats.md, Architecture notes). IfcSessionCache keys sessions by .ifc path, so a .frag or .bos cannot be opened or cached; the bos_* tools re-read the archive on every call.
