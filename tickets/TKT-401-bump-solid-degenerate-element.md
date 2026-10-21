---
id: TKT-401
title: STEP mesher: the bump patch solid's top meshes with a degenerate element
status: open
depends_on: []
owner:
fence: [sandbox/step-brep-mesh/05-face-meshing/**]
workflow: [kept]
related: [TKT-391, TKT-399]
created: 2026-10-21
kind: defect
---

## Acceptance criteria

- [ ] Law_BumpSolidValidatesStructurally (08-pipeline/bspline-pipeline-run.laws.plato) passes: ValidateModelMesh at the Structural level reports no ElementIsNotDegenerate on the bump solid's mesh

Found by chunk L2 (TKT-391). MeshModel of Witness_BSplinePatchSolid(0.5) under the witness options assembles a mesh on which ValidateModelMesh at the Structural level reports one Error, ElementIsNotDegenerate at MeshElement(ElementIndex(1541)). The original laws never saw it: their Oracle validation does not finish compiled, so the verdict file recorded them as budget errors. Closed, oriented, well formed, Euler characteristic 2 and the top's area bound all hold. Related: ValidateAssembly at the Structural level takes 366 s compiled on this mesh (the other two validation parts under 1 s each), so the bump solid's witness skips validation.
