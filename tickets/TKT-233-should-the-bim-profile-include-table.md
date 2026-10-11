---
id: TKT-233
title: Should the bim profile include table.fillNulls?
status: open
depends_on: []
owner:
fence: [src/studio/BimOpenFlow.Studio/StudioComposition.cs]
workflow: [W3]
created: 2026-10-11
kind: question
---

Found building the visualization demos (docs/plans/viz-demos.md). table.fillNulls is in the node catalog (docs/nodes.catalog.json) but not in the bim profile (StudioComposition.BimPacks), so a graph that uses it fails validation in the studio. Options: (a) add it to the bim profile (recommended: it is a generic table op and graphs that fill missing measures need it; honest absence still holds because the node is explicit); (b) keep it out and document the reason, then have the catalog stop listing it for the bim profile. Default: (a).
