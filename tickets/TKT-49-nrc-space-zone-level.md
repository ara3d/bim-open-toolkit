---
id: TKT-49
title: Space and zone level for NRC analytics: SpaceOfElement, ZoneOfSpace, IfcZoneBuilder, synthetic Duplex zones
status: open
depends_on: [TKT-48]
owner:
fence: []
workflow: [kept]
---

## Acceptance criteria

- [ ] Views SpaceOfElement and ZoneOfSpace in BosDuckDbViews, exposed to ifc_sql and graphs
- [ ] IfcZoneBuilder in Ara3D.Ifc.Editing appends IFCZONE and IFCRELASSIGNSTOGROUP with deterministic GlobalIds, diff-and-reverse tested
- [ ] samples/nrc/nrc-zones.csv (synthetic) groups Duplex's 21 spaces; the enriched file carries the zones and Pset_NRCZoneSummary; graph nrc-q9-zone-eui answers the highest-EUI zone, asserted in NrcWorkflows.Tests

P2 of Proposal: docs/proposals/nrc-deliverables.md. The statement of work names zone level twice; nothing covers it.
