---
id: TKT-223
title: Mesher test support as its own library, and the mesher's remaining large files
status: open
depends_on: []
owner:
fence: [deps/bim-open-data/src/data/Ara3D.Ifc.Mesher/**, deps/bim-open-data/tests/data/**]
workflow: [W2]
related: [TKT-216, TKT-65]
created: 2026-10-11
---

## Acceptance criteria

- [ ] MicroIfc, MeshTestAssert, the GeometryCoverage attribute, MatrixNorms, and the geometry oracles live in a non-test library (for example Ara3D.Ifc.Mesher.TestSupport) that both test projects reference, so Ara3D.IfcMeshingComparison no longer references a test project
- [ ] GoldenMeshTests.cs (1,737 lines) is split by entity family, with CoverageGateTests still finding every [GeometryCoverage] test in the assembly
- [ ] Harness/ModelComparer.cs (1,122 lines) is split by metric
- [ ] TrimmedCurves.cs has one TrimSampledPolyline over a vector type instead of the 2D and 3D copies
- [ ] MeshingDiagnostics.GeometrySupportStatus and GeometryCoverage.GeometryCreationSupport, two three-valued enums for how well an entity is handled, become one

Left over from the layout work (TKT-216, plan docs/plans/ifc-mesher-layout.md) and its review on 2026-10-11. None blocks the mesher's use; each makes the next change to it cheaper. TrimmedCurves.cs (295), BSplineSurfaceMap.cs (248), and FaceSetBuilder.cs (247) are over the plan's 200-line target but under its 400-line criterion; split them only if a change touches them.
