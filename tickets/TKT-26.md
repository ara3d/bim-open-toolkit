---
id: TKT-26
title: The agent works in the open graph: MCP and Ask default to the analysis the studio has open
status: claimed
depends_on: []
owner: small-job-builder
fence: [src/mcp/BimOpenMcp.Flow/**, src/flow/BimOpenFlow.Host.Api/**, src/flow/BimOpenFlow.Host/**, src/flow/BimOpenFlow.Host.Store/AtomicFile.cs, src/studio/BimOpenFlow.Studio/AskEndpoint.cs, contracts/**, bimopenflow/web/packages/app/src/editorSession.ts, bimopenflow/web/packages/app/src/askRequest.ts, bimopenflow/web/packages/app/src/selection.ts, bimopenflow/web/packages/app/src/app.ts, bimopenflow/web/packages/app/src/duckdbDemo.ts, bimopenflow/web/packages/app/test/**, bimopenflow/web/packages/api-client/**, bimopenflow/web/packages/contracts/**, tests/flow/BimOpenFlow.Host.Api.Tests/**, tests/flow/BimOpenFlow.Host.Tests/CompositionTests.cs, tests/mcp/BimOpenMcp.Flow.Tests/**, tests/studio/BimOpenFlow.Studio.Tests/**, scripts/demo-bim-flow-mcp.mjs, docs/bim-flow-mcp-demo.md, docs/plans/agent-in-the-open-graph.md]
---

## Acceptance criteria

- [ ] The studio tells the host which analysis is open, which nodes are selected, and the last evaluation (a small session endpoint the editor keeps current)
- [ ] Every bimopenflow MCP tool that takes analysisId accepts its absence and uses the open analysis; a getSession tool returns id, selection, and last result so Claude Code can ask 'what am I looking at'
- [ ] The Ask box sends the open analysis and selection with each request, so a follow-up such as 'add a chart to this' needs no id
- [ ] scripts/demo-bim-flow-mcp.mjs gains a case that edits the open graph without naming it, and the edit appears on the canvas without a reload (with TKT-17)

Owner's finding of 2026-09-26: interacting with the MCP seemed unaware of the currently active graph. Today every tool in src/mcp/BimOpenMcp.Flow/FlowDocumentTools.cs and FlowEditTools.cs takes an explicit analysisId (FlowToolArgs.cs), and nothing in the host records what the editor shows. Serves W2 and the new principle 7. Design the session record first: it is a contract between the app, the host API, and the MCP server.
