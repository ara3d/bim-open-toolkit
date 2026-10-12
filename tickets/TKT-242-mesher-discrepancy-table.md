---
id: TKT-242
title: Per-product discrepancy table from the five-mesher dumps
status: open
depends_on: []
owner:
fence: [deps/bim-open-data/tests/data/Ara3D.IfcMeshingComparison/Harness/DiscrepancyTable*.cs, deps/bim-open-data/tests/data/Ara3D.IfcMeshingComparison/Harness/ProductDiscrepancy.cs, deps/bim-open-data/tests/data/Ara3D.IfcMeshingComparison/Tests/Comparison/DiscrepancyTableTests.cs, deps/bim-open-data/bench/ifc-mesher/discrepancies/**]
workflow: [W3]
related: [TKT-65, TKT-190]
created: 2026-10-11
---

## Acceptance criteria

- [ ] DiscrepancyTable.Build(file, backends) lists per product which meshers produced it, triangle counts, bounds, volume, and the shape score against the majority, sorted by how far Ara3D.Ifc.Mesher is from the majority; runs on the three quick files from the committed dumps in under 10 s
- [ ] The Markdown tables for the quick files are committed under bench/ifc-mesher/discrepancies/ and name TKT-65's one example.ifc bounds product, the 4 of 14 steelplates shapes, and the 28 of 116 example.ifc shapes by express id with the entity kind of their geometry

Track A of docs/plans/ifc-mesher-roadmap.md. The majority of five meshers is not truth, but a product where four agree and ours differs is a defect with a reference answer attached.
