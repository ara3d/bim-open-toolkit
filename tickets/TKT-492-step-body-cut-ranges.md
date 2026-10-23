---
id: TKT-492
title: Host body cut from face element ranges, not a scan of the model mesh per body
status: open
depends_on: []
owner:
fence: [deps/bim-open-data/src/data/Ara3D.Step.Mesher/Plato/StepPlatoBodies.cs, deps/bim-open-data/tests/data/Ara3D.Step.Mesher.Tests/Plato/**, sandbox/step-brep-mesh/06-mesh/**]
workflow: [W3]
created: 2026-10-22
---

## Acceptance criteria

- [ ] StepPlatoBodies.ToShapeMesh takes a body's elements from a per-file table of each face's element range, built once, not from a scan of every model element per body
- [ ] A host test compares every body's StepShapeMesh with the current path on the baseline fixtures

Finding 8 of docs/plans/step-mesher-algorithmic-performance-2026-10-22.md: RestrictedToFaces scans every element of the model mesh per body and ToItemMetres allocates an index array over every model vertex, O(S x (T_m + V)) per file.
