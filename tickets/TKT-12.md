---
id: TKT-12
title: Run from the editor: a Run button, the run record, and sinks that execute
status: claimed
depends_on: []
owner: assembly-line-supervisor
fence: [bimopenflow/web/packages/app/**, bimopenflow/web/packages/state/**, bimopenflow/web/packages/api-client/**, src/flow/BimOpenFlow.Host.Api/**, src/flow/BimOpenFlow.Nodes.Effects/**, src/flow/BimOpenFlow.Evidence/**, docs/DEMOS.md]
---

## Acceptance criteria

- [ ] A Run button in the editor calls POST /api/analyses/{id}/runs; the sinks execute once; the run record lists the graph hash and every input by content hash
- [ ] After a Run over the Duplex verdict graph, report.html and an evidence package (a zip whose manifest.json lists a SHA-256 per member, built with the BimOpenFlow.Evidence library) exist on disk; after a Run over a Snowdon table graph with sink.exportXlsx, the .xlsx exists and is named in the run record
- [ ] Sinks on the canvas say 'will write on Run' before the run and show the written path after it

Serves W3 and W5 (and the enrichment write-back, which is the same mechanism). Effects stay EffectPending forever in the editor: a run record can be created through the HTTP API and the createRun MCP tool, but nothing outside the tests executes effect nodes (docs/plans/nrc-handoff/track-e.md E2 and findings 8 to 10), and no node produces an evidence package although the Evidence library can build one; charts export, reports, evidence packages, and property-set write-back all wait on this one piece.
