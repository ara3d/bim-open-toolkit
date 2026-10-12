---
id: TKT-252
title: Mirrored instances count with a flipped sign in IfcModelStats volume
status: open
depends_on: []
owner:
fence: [deps/bim-open-data/src/data/Ara3D.Ifc.Mesher/IfcModelStats.cs, deps/bim-open-data/tests/data/Ara3D.Ifc.Mesher.Tests/**]
workflow: [W3]
created: 2026-10-11
kind: defect
---

## Acceptance criteria

- [ ] IfcMeshingResult.SignedVolume of a model with one mirrored instance equals the instance's positive volume (a test with a negative-determinant transform)

Found during the kernel plan (docs/plans/ifc-mesher-kernel.md): IfcModelStats.Transform does not reverse winding under a negative determinant while MeshHelpers.Transform does. From reading the code.
