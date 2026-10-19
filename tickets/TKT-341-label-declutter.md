---
id: TKT-341
title: Scene labels avoid each other: crowded labels (14 doors in a small pane) are thinned or stacked instead of overlapping
status: open
depends_on: []
owner:
fence: [deps/bim-open-notebook/bimopenflow/web/packages/pane-3d/**]
workflow: [W3]
related: [TKT-336]
created: 2026-10-18
kind: idea
---

Seen 2026-10-18 in the s15-text-annotation screenshots: the 14 door labels overlap in a 400-pixel pane, and the ten top-carbon labels partly overlap. The pane draws every label at its anchor; a screen-space pass that hides lower-priority labels whose chips collide (priority = table order, which view3d.label already preserves) would keep them legible. Also seen: the status line says '660 rendered instances' on a view whose table has 21 rows, worth checking.
