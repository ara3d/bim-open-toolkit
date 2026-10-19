---
id: TKT-340
title: Notebook s08-thermal-zones says the Duplex has no IfcZone, but duplex-enriched now carries four
status: open
depends_on: []
owner:
fence: [samples/notebooks/outlines/s08-thermal-zones.outline.json, samples/notebooks/graphs/s08-thermal-zones/**, samples/notebooks/s08-thermal-zones.notebook.json]
workflow: [W3]
related: [TKT-329]
created: 2026-10-18
kind: defect
---

## Acceptance criteria

- [ ] s08's replies match its snapshots: the four IfcZone groups the enrichment writes (NRC_ZoneSummary on four zones, per s05) are named, and the zone colouring uses them; regenerated against a fresh host

Found 2026-10-18 by the regeneration for the NRC walkthrough site (TKT-329): every number in s08 is still true of its snapshots, but its framing ('the Duplex has no IfcZone', the zones as a proposal) predates the zone write-back. The owner's notebooks plan (C:/Users/cdigg/nrc/paper/planning/notebooks-plan.md row s03-zones) wants it rebuilt on the zone table, ZoneOfSpace, Q9 and the zone colouring graph.
