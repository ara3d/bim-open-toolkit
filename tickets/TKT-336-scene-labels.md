---
id: TKT-336
title: Text annotation in the 3D view: view3d.label puts a label and an anchor on the instance table, the 3D pane draws it as screen-space text, and a notebook shows it
status: open
depends_on: []
owner:
fence: [src/flow/BimOpenFlow.Nodes.Geometry/LabelNode.cs, src/flow/BimOpenFlow.Nodes.Geometry/GeometryNodes.cs, src/flow/BimOpenFlow.Nodes.Geometry/README.md, tests/flow/BimOpenFlow.Nodes.Geometry.Tests/**, tests/studio/BimOpenFlow.Studio.Tests/DeclaredSchemaTests.cs, docs/nodes.md, docs/nodes.catalog.json, deps/bim-open-notebook/bimopenflow/web/packages/pane-3d/**, samples/notebooks/outlines/s15-text-annotation.outline.json, samples/notebooks/graphs/s15-text-annotation/**, samples/notebooks/s15-text-annotation.notebook.json, docs/bim-flow-3d.md, deps.json]
workflow: [W3]
related: [TKT-54, TKT-320]
confidence: high
created: 2026-10-18
---

## Acceptance criteria

- [ ] view3d.label (pure) adds label, labelX, labelY, labelZ columns to an instance table from a values table joined on a column and a format string; one label per entity (or per group with groupColumn), anchored at the top centre of the union of its instances' boxes; rows without a value get no label (no invented text); tested over in-memory tables
- [ ] The 3D pane draws every row with a non-null label as text at its anchor, kept on screen as the camera moves, capped in count with the cap stated in the status line, in both themes; tested with the fake rig
- [x] A notebook (s15-text-annotation) shows, with no host, the Duplex with each storey's operational carbon total over its slab and each door's width and DC-W1 verdict over the door; the labels are in the recorded snapshot
- [ ] docs/nodes.md, the Geometry README, the pane README and docs/bim-flow-3d.md describe the node and the drawing; deps.json pins the bim-open-notebook commit

Statement of work 1(a) and 2.2 name text annotation beside colour coding for displaying analytics on IFC geometry; today the only text is the property panel (paper v4 section 4.2). Split from TKT-54, whose other half is the Windows handover bundle.

Contract between the node and the pane (fixed before building, so both are built at once): the instance table gains four columns, label (Text, null where there is no label), labelX, labelY, labelZ (Number, model coordinates, the same frame as the table's minX..maxZ bounds; null where label is null). The pane reads only these four columns; it never derives anchors itself. Parameters of view3d.label: joinColumn (default entityId), format (text with {Column} or {Column:0.0} placeholders, invariant culture), groupColumn (empty: one label per joinColumn value; set: one label per group value, its anchor over the union of the group's boxes), limit (default 200; rows past it get no label and the node warns with the count). A placeholder whose column is missing is an error naming it; a value that is null leaves that row unlabelled.

## Notes

- 2026-10-18: s15-text-annotation built (53b6afa0): three turns over graphs nb-s15-text-annotation-*, each 3D view's recorded snapshot keeps every row and the four label columns (3 storey labels over 21 slabs, 14 door labels, 10 value labels, 5 with limit 5). Opened in headless Edge from the built site: the storey labels sit over the three slab stacks and the door and value labels are drawn over their elements, though labels crowd where elements are close. Other criteria (node tests, pane drawing, docs, pin) are by their own commits and are not checked here.
