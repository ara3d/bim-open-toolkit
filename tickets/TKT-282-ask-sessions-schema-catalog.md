---
id: TKT-282
title: The studio Ask path builds its AnalysisSessions without the schema catalog, so file and SQL nodes show Error or Unknown in the schemas Claude sees there
status: open
depends_on: []
owner:
fence: [src/studio/BimOpenFlow.Studio/AskEndpoint.cs]
workflow: [W2]
related: [TKT-209]
created: 2026-10-12
kind: defect
---

## Acceptance criteria

- [ ] AskEndpoint uses the host's sessions (host.Sessions) or passes HostComposition.SchemaCatalog, so getAnalysis in the Ask loop reports the same schemas as the MCP server
- [ ] A test in Studio.Tests: an Ask-side getAnalysis over a csv.read graph reports its columns before any run

Found by the declared-schemas wave C1 builder: src/studio/BimOpenFlow.Studio/AskEndpoint.cs line 48 constructs new AnalysisSessions(host.Store, host.Registry) with no catalog.
