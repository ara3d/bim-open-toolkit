---
id: TKT-12
title: Run from the editor: a Run button, the run record, and sinks that execute
status: open
depends_on: []
owner:
fence: [bimopenflow/web/packages/app/src/nodeBadge.ts, bimopenflow/web/packages/app/src/viewModel.ts, bimopenflow/web/packages/app/src/app.ts, bimopenflow/web/packages/app/src/topbar.ts, bimopenflow/web/packages/app/src/runMessage.ts, bimopenflow/web/packages/app/test/**, bimopenflow/web/packages/state/**, bimopenflow/web/packages/api-client/**, bimopenflow/web/packages/contracts/**, contracts/**, src/flow/BimOpenFlow.Host.Api/**, src/flow/BimOpenFlow.Host/RelationHostResults.cs, src/flow/BimOpenFlow.Host.Store/AnalysisStoreRuns.cs, src/flow/BimOpenFlow.Reports/ReportGenerator.cs, src/flow/BimOpenFlow.Nodes.Effects/README.md, src/flow/BimOpenFlow.Evidence/README.md, src/mcp/BimOpenMcp.Flow/FlowEvalTools.cs, tests/flow/BimOpenFlow.Reports.Tests/**, tests/flow/BimOpenFlow.Host.Api.Tests/**, tests/flow/BimOpenFlow.Host.Tests/**, tests/flow/BimOpenFlow.NrcWorkflows.Tests/RunFromHostTests.cs, tests/mcp/BimOpenMcp.Flow.Tests/CreateRunToolTests.cs, docs/DEMOS.md, docs/plans/run-from-the-editor.md]
---

## Acceptance criteria

- [ ] A Run button in the editor calls POST /api/analyses/{id}/runs; the sinks execute once; the run record lists the graph hash and every input by content hash
- [ ] After a Run over the Duplex verdict graph, report.html and an evidence package (a zip whose manifest.json lists a SHA-256 per member, built with the BimOpenFlow.Evidence library) exist on disk; after a Run over a Snowdon table graph with sink.exportXlsx, the .xlsx exists and is named in the run record
- [ ] Sinks on the canvas say 'will write on Run' before the run and show the written path after it

Serves W3 and W5 (and the enrichment write-back, which is the same mechanism). Effects stay EffectPending forever in the editor: a run record can be created through the HTTP API and the createRun MCP tool, but nothing outside the tests executes effect nodes (docs/plans/nrc-handoff/track-e.md E2 and findings 8 to 10), and no node produces an evidence package although the Evidence library can build one; charts export, reports, evidence packages, and property-set write-back all wait on this one piece.

## Notes

- 2026-10-03: claim released; the session that held it (assembly-line-supervisor) had stopped. Checked against the code that day. Done: chunks C1 (2a0348d, run report prints a terminal relation) and C2 (70d4faf, each relation source pinned by content hash). Left: C3 to C11 of `docs/plans/run-from-the-editor.md`: the run summary, an evidence package per run, the editor's Run button and sink badges, and the Duplex and Snowdon run tests. C3 needs TKT-26 C3. `nodeBadge.ts` has moved since the fence was written.
