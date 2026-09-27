---
id: TKT-50
title: IDS for NRC analytics: a synthetic NRC IDS, an Ara3D.Ids evaluator over BOS, a check.ids node, and an ifc_ids_check MCP tool
status: claimed
depends_on: [TKT-48]
owner: parallel-wave-builder-ids
fence: [src/data/Ara3D.Ids/**, tests/data/Ara3D.Ids.Tests/**, samples/nrc/ids/**, docs/proposals/ids-reuse.md, BimOpenToolkit.sln]
---

## Acceptance criteria

- [ ] samples/nrc/nrc-analytics.ids is generated from nrc-metrics.csv; samples/nrc/dc-w1.ids expresses rule DC-W1
- [ ] check.ids emits the standard verdict table; an unsupported facet yields InfoNotAvailable with a warning, never a pass
- [ ] Pass and fail counts match IfcOpenShell ifctester on the same file (recorded parity transcript); the roof fails; dc-w1.ids gives 8 pass and 6 fail

P3 of Proposal: docs/proposals/nrc-deliverables.md. Run no-new-wheels over Xbim.InformationSpecifications and ifctester first. NRC has sent no IDS, so this one is written from the metric dictionary.


## Staging, 2026-09-27

First half now (claimed by hand; ticket.py refuses because the second half depends on TKT-48): the reuse check (docs/proposals/ids-reuse.md) and the Ara3D.Ids library over BOS tables, with the IDS files under samples/nrc/ids/. The check.ids node and the ifc_ids_check MCP tool follow once TKT-48 releases src/mcp/BimOpenMcp.Ifc; the fence widens then.
