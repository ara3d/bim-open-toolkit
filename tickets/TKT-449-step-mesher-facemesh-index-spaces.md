---
id: TKT-449
title: STEP mesher: FaceMesh and UvTriangulation keep three index spaces apart (UvPointIndex, LocalVertexIndex, global VertexIndex)
status: open
depends_on: []
owner:
fence: [sandbox/step-brep-mesh/05-face-meshing/**, sandbox/step-brep-mesh/06-mesh/**, sandbox/step-brep-mesh/07-validation/**, sandbox/step-brep-mesh/08-pipeline/**, sandbox/step-brep-mesh/10-editing/**, sandbox/step-brep-mesh/11-repair/**, sandbox/step-brep-mesh/reviews/verdicts-cpu64.tsv]
workflow: [W3]
related: [TKT-435]
confidence: medium
created: 2026-10-22
---

## Acceptance criteria

- [ ] UvTriangulation and FaceMesh element corners are UvPointIndex (a face-local triangle and quad over UvPointIndex), FaceMesh.LocalVertex is Array<LocalVertexIndex>, Positions and Provenance are read only by LocalVertexIndex, and the stdlib VertexIndex appears only in ModelMesh (global vertices)
- [ ] QuadSides.FourSided(Corners) holds loop positions in a type of its own, not VertexIndex (05-face-meshing/uv-regions.library.plato:1138)
- [ ] Element lookups go through the ElementShape type of sandbox/step-mesh-staging/v1-types (merged by then), so no reader tests Count == 3
- [ ] Layers 5 to 11 type-check and their law verdicts are unchanged

Review: docs/plans/step-mesher-types-review-2026-10-22.md (TKT-435). VertexIndex means a uv-point index (triangle corners), a local 3D vertex (FaceMesh.LocalVertex, 05-face-meshing/face-meshing.types.plato:66-76), a global vertex (ModelMesh) and a loop position (QuadSides). UvPointIndex and LocalVertexIndex are declared in 00-foundation/foundation-slots.types.plato:58,66 and unused there. IsLiftedPoint(fm, i: VertexIndex) reads UvPoints[i] and then Positions[LocalVertex[i]]: two spaces under one type. Typed wrappers cost nothing in the generated C# (readonly structs). Waits for the version 1 wave (TKT-323) to close: it edits library files the version 1 tracks read. Then a builder edits the library directly, one layer per commit, running the laws of each layer it touches before and after (python -I sandbox/step-brep-mesh/tools/plato_laws.py, cpu64); verdicts must not change except named fixes.
