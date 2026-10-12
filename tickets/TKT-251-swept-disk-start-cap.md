---
id: TKT-251
title: Solid straight swept disk has no start cap
status: open
depends_on: []
owner:
fence: [deps/bim-open-data/src/data/Ara3D.Ifc.Mesher/SweptDisks.cs, deps/bim-open-data/tests/data/Ara3D.Ifc.Mesher.Tests/**]
workflow: [W3]
created: 2026-10-11
kind: defect
---

## Acceptance criteria

- [ ] A solid IFCSWEPTDISKSOLID with no inner radius and a straight directrix is closed at both ends (a micro-IFC test counts boundary edges as zero)

Found by reading SweptDisks.cs during the kernel plan (docs/plans/ifc-mesher-kernel.md): AddFanCapFaces(faces, 0, segments, reverse: true) passes vertex 0 as the centre and segments as the ring start, so the start ring stays open. Not yet seen on a file.
