---
id: TKT-305
title: STEP model assembly in C#: units, placements, mapped items, assembly tree, colours, and the StepMesher entry point around the shape mesher
status: done
depends_on: [TKT-304]
owner: session 10b9c9c6
session: 10b9c9c6-0052-40f3-a1c2-c12f2f8861d7
fence: [deps/bim-open-data/src/data/Ara3D.Step*/**, deps/bim-open-data/src/data/Ara3D.MeshKernel/**, deps/bim-open-data/src/data/Ara3D.Ifc.Mesher/FaceSetBuilder.cs, deps/bim-open-data/tests/data/**, deps.json]
workflow: [W3, W4]
related: [TKT-250]
confidence: high
created: 2026-10-17
claimed: 2026-10-17
closed: 2026-10-17
---

## Acceptance criteria

- [x] assembly instances are placed through NEXT_ASSEMBLY_USAGE_OCCURRENCE and ITEM_DEFINED_TRANSFORMATION (bim-open-data a3c2423; the two-cube fixture places #126 twice, the second at +0.002 m in x; 81 corpus files with assemblies, depth up to 6; cycles recorded, not followed)
- [x] non-reading code shared with the IFC mesher lives in Ara3D.MeshKernel, not copied (bim-open-data 2b4104b, FaceMesher.AddFace; kept for the IFC mesher after the pivot)
- [x] unsupported entities are counted in diagnostics, never dropped silently (StepMeshingDiagnostics; corpus: 0 exceptions over 88 files, geometric_curve_set and similar counted as unsupported, items awaiting geometry counted as GeometryPending)

Plan: docs/plans/step-reader.md (reading STEP geometry in C# the way IFC is read: generated schema types from EXPRESS via Parakeet). Cones, spheres and tori are flattened by the IFC mesher today; this ticket records what it does for each surface kind.

Re-scoped 2026-10-17 by the owner's decision (TKT-306): the geometry is written in Plato. Part A (C# shape meshing) was stopped before it committed anything; its criterion "a public sample meshes with every solid closed" moved to TKT-313, and decoding into the Plato BrepModel is TKT-312. This ticket keeps part B: units, placements, mapped items, assemblies, colours, the StepMesher entry point, and parser diagnostics in the result.
