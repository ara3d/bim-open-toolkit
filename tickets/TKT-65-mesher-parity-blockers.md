---
id: TKT-65
title: Clear the Ara3D.Ifc.Mesher parity blockers and rerun its scorecard
status: open
depends_on: []
owner:
fence: [src/data/Ara3D.Ifc.Mesher/**, tests/data/**]
workflow: [W3]
---

## Acceptance criteria

- [ ] The Schependomlaan window and door offset (about 10 m, mapping origin inverse versus target times origin) is fixed and its entity bbox match rises above 15%
- [ ] PRIMARK oracle-only null meshes fall under the gate of 100 (232 at the last run)
- [ ] The SHS volume metric, steelplates clipped-beam booleans, DigitalHub mesh-bbox (target 0.55), and W12 tessellation each pass or are recorded as out of scope with a reason
- [ ] The M4 scorecard is rerun and committed with the date

The progress notes in `src/data/Ara3D.Ifc.Mesher/progress-notes/` (`wp-backlog-placement-voids-primark.md:88`, `wp-m4-session.md:78`, `wp-mesh-index-session.md:39`, `wp-placement-schependomlaan.md:43`, `wp-w5.md:81`) list these; the last run was 2026-07-09. The mesher feeds the Geometry nodes and the IFC MCP server, and no ticket mentioned it. Split into one ticket per blocker when picked up. Raised by reviews/2026-09-27-status.md
