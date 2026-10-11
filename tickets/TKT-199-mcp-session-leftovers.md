---
id: TKT-199
title: MCP session leftovers: a metric dictionary added after the database is built goes unseen, old bimopenmcp-bos and bimopenmcp-ifc temp folders are never swept, ifc_models reads sessions without a lease
status: open
depends_on: []
owner:
fence: [deps/bim-open-data/src/mcp/BimOpenMcp.Ifc/**, deps/bim-open-data/tests/mcp/**]
workflow: [W2]
related: [TKT-177]
created: 2026-10-11
kind: defect
---

## Acceptance criteria

- [ ] The derived-files key includes the metric dictionary CSV's size and write time when the model names one
- [ ] The start-up sweep also removes %TEMP%/bimopenmcp-bos and %TEMP%/bimopenmcp-ifc from earlier builds
- [ ] ifc_models takes a lease like every other tool

Left by fixer F9 of the BOS middle-layer wave (docs/plans/bos-middle-layer.md), 2026-10-11.
