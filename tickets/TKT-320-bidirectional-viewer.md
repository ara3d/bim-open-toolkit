---
id: TKT-320
title: Bidirectional viewer: a pick highlights and reaches the table, the selection and a comment become graph nodes, BCF viewpoints save camera and selection, write-back from the property panel
status: done
depends_on: []
owner: session e2aa2b2c
session: e2aa2b2c-7acb-41a8-96ea-ad30e584b1f4
fence: [deps/bim-open-data/src/data/Ara3D.BimOpenSchema.IO.Bcf/**, deps/bim-open-data/tests/data/Ara3D.BimOpenSchema.IO.Bcf.Tests/**, deps/bim-open-flow/bimopenflow/web/packages/panes/**, deps/bim-open-flow/bimopenflow/web/packages/app/src/app.ts, deps/bim-open-flow/bimopenflow/web/packages/app/src/paneArea.ts, deps/bim-open-flow/bimopenflow/web/packages/app/src/paneEdits.ts, deps/bim-open-flow/bimopenflow/web/packages/app/test/**, deps/bim-open-flow/bimopenflow/web/packages/client/src/**, deps/bim-open-notebook/bimopenflow/web/packages/pane-3d/**, src/flow/BimOpenFlow.Nodes.BimAnalysis/**, src/flow/BimOpenFlow.Nodes.Bcf/**, src/flow/BimOpenFlow.Nodes.Geometry/CameraNode.cs, src/flow/BimOpenFlow.Nodes.Geometry/README.md, tests/flow/**, docs/nodes.md, docs/nodes.catalog.json, docs/bim-flow-3d.md, docs/plans/bidirectional-viewer.md, deps.json]
workflow: [W3, W2]
related: [TKT-28, TKT-26, TKT-222, TKT-171, TKT-12]
confidence: high
created: 2026-10-18
claimed: 2026-10-18
closed: 2026-10-18
---

## Acceptance criteria

- [x] In the 3D pane a click highlights the element in the viewer, shift-click adds to the selection, and the Table tab of the same node shows the picked rows highlighted (the selection carries both the entity id and the GlobalId)
- [x] A 'Use selection' control adds a bim.selection node holding the selected GlobalIds (or updates the one it made), so view3d.isolate, table.filter or table.aggregate run over the selection; the gesture is one undo step
- [x] A 'Comment' control takes a title, a comment and an author and adds a view3d.camera node (the current camera, with fov) wired into a bcf.issue node (the selection, the text, the creation time); bcf.write writes that camera and comment into the topic's viewpoint and Comments and the model file into the Header, validated against the BCF 3.0 XSDs; bcf.read reads them back
- [x] The property panel offers a property edit (set, name, value) that adds a table.inline row wired into sink.writePsets with the model's source path, so Run performs the byte-exact write-back
- [x] deps.json pins the bim-open-data, bim-open-flow and bim-open-notebook commits; docs/nodes.md, the pack READMEs and docs/bim-flow-3d.md describe the controls and nodes

From the paper's account of the bidirectional viewer (2026-10-18): of eight operations, colouring by value and the property panel were built; picking, aggregates over a selection, annotation and write-back were partial; comments on an element and model version and BCF viewpoints saving camera and selection were not built. Design and chunks: docs/plans/bidirectional-viewer.md. Every gesture goes through the graph's own edit operations (principle 1) and nothing writes until Run (principle 2).

## Notes

- 2026-10-18: verified live in the studio on viz-door-accessibility over the Duplex: a pick gave "1 selected" and the property panel; Use selection saved selection1 with the GlobalId; Comment saved camera1 (fov 50 from the viewer) wired into issue1; Edit property saved inline1 wired into writePsets1 (IFC source path, -reviewed target, EffectPending until Run). The Table tab highlight is covered by the pane area and table pane tests; live it could not be shown because the picked roof was past the table's first page of 200 rows. Build log, review, and fixes: docs/plans/bidirectional-viewer.md. Follow-ups: TKT-333, TKT-334; found on the way: TKT-329, TKT-330.

## Close gates

2026-10-18, toolkit sample graphs: `npx vitest run test/sampleCards.test.ts test/sampleLayout.test.ts` in `bimopenflow/web/packages/studio-web` passed.

```
 RUN  v3.2.7 C:/Users/cdigg/git/bim-open-toolkit/bimopenflow/web/packages/studio-web
 ✓ test/sampleLayout.test.ts (2 tests) 6ms
 ✓ test/sampleCards.test.ts (5 tests) 5337ms
   ✓ no sample graph has overlapping node cards  332ms
   ✓ no text overflows its card > for every sample graph as shown and at least width  3607ms
   ✓ no text overflows its card > for every catalog kind with default and long values  1390ms
 Test Files  2 passed (2)
      Tests  7 passed (7)
   Start at  15:53:41
   Duration  12.87s (transform 3.08s, setup 0ms, collect 12.23s, tests 5.34s, environment 1ms, prepare 1.96s)
```

2026-10-18, bim-open-flow pin: `node scripts/check-pin.mjs bim-open-flow` in `.` passed.

```
bim-open-flow: pinned at 6846390, pushed
```
