---
id: TKT-230
title: bim.rooms gains an Area column; bim.classifyRooms default rules cover Utility and Room
status: open
depends_on: []
owner:
fence: [src/flow/BimOpenFlow.Nodes.BimAnalysis/**]
workflow: [W3]
created: 2026-10-11
---

## Acceptance criteria

- [ ] bim.rooms outputs Area, null (not 0) when the model has no area quantity; for IFC-derived files it reads the quantity 'GSA BIM Area'
- [ ] bim.classifyRooms default rules classify names containing Utility as Utility and the plain name Room as Room (B105 named Room is Stairway in the IFC today)
- [ ] viz-room-areas uses bim.rooms Area in place of its sql.query over the IFC quantity

Found building viz-room-areas (docs/plans/viz-demos.md). bim.rooms has no Area column, so the graph used sql.query over the IFC quantity 'GSA BIM Area'. The default classification rules also miss Utility and Room names.
