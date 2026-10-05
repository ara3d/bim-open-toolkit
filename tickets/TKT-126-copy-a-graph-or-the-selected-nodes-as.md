---
id: TKT-126
title: Copy a graph, or the selected nodes, as text to share with Claude over MCP
status: open
depends_on: [TKT-57, TKT-26]
owner:
fence: [src/flow/BimOpenFlow.GraphText/**, tests/flow/BimOpenFlow.GraphText.Tests/**, src/flow/BimOpenFlow.Host.Api/**, src/mcp/BimOpenMcp.Flow/**, bimopenflow/web/packages/app/src/topbar.ts, bimopenflow/web/packages/app/src/toast.ts, bimopenflow/web/packages/graph/src/nodeContextMenu.ts, bimopenflow/web/packages/api-client/**, bimopenflow/web/packages/app/test/**, docs/graph-text.md]
workflow: [W2]
kind: idea
---

## Acceptance criteria

- [ ] GraphText can print a subset of a graph's nodes: the selected nodes with their results, plus a short 'inputs from outside the selection' block naming each upstream node.port a selected node reads, so the excerpt reads on its own
- [ ] The text endpoint from TKT-57 (GET /api/analyses/{id}/text) accepts an optional node list, and describeAnalysis takes optional nodeIds, defaulting to the studio's current selection (TKT-26 session) when asked for 'selection'
- [ ] The editor offers 'Copy as text' for the whole graph (topbar or keyboard) and for the selection (node context menu, nodeContextMenu.ts); it puts the printed text on the clipboard and shows a toast with the node count
- [ ] A test prints a two-node selection from a sample graph and checks the outside-inputs block names the right upstream ports; a web test checks the copy action calls the endpoint with the selected ids
- [ ] docs/graph-text.md describes the selection form and the copy action

Owner's request, 2026-09-29: convert a graph, or just the selected nodes, into text and share it with Claude (in Claude Code over the bimopenflow-duckdb MCP server, or pasted into any chat) as context. Two paths feed the same text: a person copies it from the editor, or the agent pulls it through describeAnalysis. Builds on TKT-57, which adds the printer (src/flow/BimOpenFlow.GraphText, one ANF line per node with results as comments) and the whole-graph MCP tool and endpoint; this ticket adds printing a subset and the editor's copy action. The selection comes from TKT-26's session record, so 'explain the selected nodes' works from Claude Code without an id. Open design point: whether a selection excerpt includes the upstream nodes' results or only their names; default to names and row counts, so the excerpt stays short. Serves W2 (ask in plain language and get a graph you can inspect) and principle 7 (the agent works in the open graph).
