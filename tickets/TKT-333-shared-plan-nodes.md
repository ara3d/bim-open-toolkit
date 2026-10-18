---
id: TKT-333
title: A pane's planned-node edit (planNodes, planSetParams) becomes the one edit operation the Ask box and the MCP server share
status: open
depends_on: []
owner:
fence: [deps/bim-open-flow/bimopenflow/web/packages/app/src/paneEdits.ts, deps/bim-open-flow/bimopenflow/web/packages/state/**, deps/bim-open-flow/bimopenflow/web/packages/graph/**]
workflow: [W2]
related: [TKT-320, TKT-26]
created: 2026-10-18
kind: idea
---

From the 2026-10-18 review of TKT-320 chunk B1: planNodes and planSetParams (app/src/paneEdits.ts, with port, type and param validation) are the validated 'plan these nodes and wire them' operation that principle 1 (one edit path) wants every surface to share, but they sit in the app package where neither the Ask box nor the MCP server can reuse them. Done would mean: they live in the state or graph package, and the Ask box and the MCP edit path call the same function.
