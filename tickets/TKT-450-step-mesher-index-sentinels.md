---
id: TKT-450
title: STEP mesher: the 89 XIndex(-1) sentinels become Maybe<XIndex> (or a per-table none case)
status: open
depends_on: [TKT-443]
owner:
fence: [sandbox/step-brep-mesh/00-foundation/**, sandbox/step-brep-mesh/01-geometry/**, sandbox/step-brep-mesh/02-topology/**, sandbox/step-brep-mesh/03-step/**, sandbox/step-brep-mesh/04-discretization/**, sandbox/step-brep-mesh/05-face-meshing/**, sandbox/step-brep-mesh/06-mesh/**, sandbox/step-brep-mesh/07-validation/**, sandbox/step-brep-mesh/08-pipeline/**, sandbox/step-brep-mesh/10-editing/**, sandbox/step-brep-mesh/11-repair/**, sandbox/step-brep-mesh/reviews/verdicts-cpu64.tsv]
workflow: [W3]
related: [TKT-435]
confidence: medium
created: 2026-10-22
---

## Acceptance criteria

- [ ] grep -rnE '\b\w+Index\(-1\)' over the library's .plato files finds none; each became Maybe<XIndex> (TKT-443) or a named none case its callers match
- [ ] The IIndex comment no longer documents -1 as none (00-foundation/foundation-indices.types.plato:6-7)
- [ ] MeshVertexSite has a case for no site in place of ModelVertex(BrepVertexIndex(-1)) (06-mesh/mesh-numbering.library.plato:101,116,276)
- [ ] Law verdicts unchanged except laws that matched a sentinel, listed in the commit

Review: docs/plans/step-mesher-types-review-2026-10-22.md (TKT-435). Counts by type: VertexIndex 20, ElementIndex 15, SurfaceIndex 14, CurveIndex 11, PcurveIndex 8, BrepVertexIndex 6, BrepEdgeIndex 4, nine more types 1 to 3 each. Examples: PcurveIndex(-1) in 01-geometry/geometry-curves.library.plato:436,446-448; CornerOf returns CornerIndex(-1) (06-mesh/mesh.library.plato:76-93). Sentinels are the largest class in the defect record (11 of 58; e.g. a negative ElementFace matching a negative filter, perf-masks). Depends on TKT-443 (generic sums); without it, one sum per index type. Waits for the version 1 wave (TKT-323) to close: it edits library files the version 1 tracks read. Then a builder edits the library directly, one layer per commit, running the laws of each layer it touches before and after (python -I sandbox/step-brep-mesh/tools/plato_laws.py, cpu64); verdicts must not change except named fixes.
