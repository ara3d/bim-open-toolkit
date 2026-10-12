---
id: TKT-276
title: Four-pane mesher comparison page with a shared camera
status: open
depends_on: []
owner:
fence: [deps/bim-open-data/site-src/**, deps/bim-open-data/bench/ifc-mesher/glb/**, deps/bim-open-data/tests/data/Ara3D.IfcMeshingComparison/Harness/GlbExport*.cs, deps/bim-open-data/tests/data/Ara3D.IfcMeshingComparison/Tests/Comparison/GlbExportTests.cs]
workflow: [W5, W3]
related: [TKT-242, TKT-226]
created: 2026-10-11
---

## Acceptance criteria

- [ ] A web page shows the same IFC file meshed by four meshers (Ara3D.Ifc.Mesher, web-ifc, IfcLite, IfcOpenShell) in four panes on the BIM Open Viewer, with one camera: orbiting, panning or zooming any pane moves all four
- [ ] Several sample IFC files (at least the three quick files and duplex.ifc) are available from a selector, each as one GLB per mesher committed under bench/ifc-mesher/glb with a manifest of triangle counts and sizes
- [ ] The page builds into site/ with the explorer and is served by the dev server; a smoke test loads it and checks four canvases draw

Asked by the owner on 2026-10-11. Plan: docs/plans/mesher-comparison-page.md.
