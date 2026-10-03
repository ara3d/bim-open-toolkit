---
id: TKT-139
title: The notebook's 3D embed shows IFC classes in its legend instead of the colouring node's legend
status: open
depends_on: []
owner:
fence: [bimopenflow/web/packages/bim-open-notebook/src/embeds/view3d.ts, bimopenflow/web/packages/bim-open-notebook/test/**, bimopenflow/web/packages/panes/src/viewPane3D.ts, bimopenflow/web/packages/panes/src/instanceLegend.ts]
kind: defect
---

## Acceptance criteria

- [ ] In samples/notebooks/nrc-door-check.notebook.json the 3D embed's legend reads Pass 8 and Fail 6, from the graph's legend output
- [ ] In nrc-test-kit turn 3 the 3D legend lists the CSV categories (Door, Finish, Floor, ...), matching the turn's Legend table
- [ ] A test in the notebook package fails before the fix and passes after

Seen 2026-10-03. Cause: `src/embeds/view3d.ts`'s `planFeed` sends the pane only an instances, boxes, or view input, never the node's `legend` port, so `legendFromSlice` in `panes/src/instanceLegend.ts` (lines 11 and 39) falls back to the first of `verdict` or `category` present in the instances table, which is the IFC class. `viewPane3D.ts` already accepts a `legend` input (about line 266). The reply text in nrc-door-check says the doors are coloured by verdict, so the sample contradicts itself on screen. Related: TKT-16 (one colour domain and legend across panes).
