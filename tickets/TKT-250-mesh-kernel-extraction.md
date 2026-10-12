---
id: TKT-250
title: Extract the IFC-free mesh kernel into Ara3D.MeshKernel
status: open
depends_on: []
owner:
fence: [deps/bim-open-data/src/data/Ara3D.MeshKernel/**, deps/bim-open-data/tests/data/Ara3D.MeshKernel.Tests/**, deps/bim-open-data/src/data/Ara3D.Ifc.Mesher/**]
workflow: [W3]
related: [TKT-223, TKT-65]
created: 2026-10-11
---

## Acceptance criteria

- [ ] Ara3D.MeshKernel builds and tests alone with no reference to Ara3D.Ifc.Entities, Ara3D.IfcTypes or Ara3D.IO.StepParser, and git grep for ifc over its folders prints nothing
- [ ] The mesher's fast tests pass with their source unchanged, and the comparison suite keeps the same pass and fail set
- [ ] MeshHelpers holds only entity readers; PolygonWithHoles, Tolerance, SweepRings, MeshDedup and the SurfaceMap family are gone from Ara3D.Ifc.Mesher

Track B. Plan with chunks B0 to B15: docs/plans/ifc-mesher-kernel.md.
