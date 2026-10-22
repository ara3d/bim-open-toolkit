---
id: TKT-420
title: STEP mesher: two needle cone faces of SHO/M2-MAYA-W271.step are refined with interior points whose triangles join the apex's copies half a turn apart, 2 non-manifold and 4 misoriented edges
status: open
depends_on: []
owner:
fence: [sandbox/step-brep-mesh/05-face-meshing/**]
workflow: [W3]
related: [TKT-413, TKT-411, TKT-349]
created: 2026-10-22
kind: defect
---

## Acceptance criteria

- [ ] Faces 1672 and 1730 of the prepared M2-MAYA-W271 model mesh with no mesh edge used by more than two elements and none used twice in one direction, or carry a located diagnostic
- [ ] A law over a needle cone sector witness (radius far below the chordal bound, apex a pole) states that no interior point is joined to two copies of the apex that are not neighbours on the pole line, and fails on the current library

Found 2026-10-22 by track v1-edges (TKT-413, sandbox/step-mesh-staging/v1-edges/TRACK.md) after the loop repair of TKT-413 and TKT-419 cleared the three MAYA REVC files. M2-MAYA-W271's remaining 2 non-manifold and 4 misoriented edges are all inside two cone faces, 1672 and 1730 of the prepared model, each bounded by two lines from the apex and a half circle (u from pi to 2 pi, v from -0.1506 at the apex to 1.0995). Their chart's ScaleU is 0.00025: the cone is a needle about 0.0005 mm across over a 1.25 mm slant, narrower than the chordal bound. The constrained triangulation fans the 14 copies of the apex on the pole line to two points and is sound. Refinement then inserts six interior points; in chart space every point lies almost on one line, and triangles such as 16-19-22 and 16-17-19 join interior point 19 to the apex copy at u = pi while 19-3-22 and 19-20-3 join it to the copy at u = 2 pi. Lifted, all four triangles share the mesh edge from the apex V2525 to point 19. Possible repairs: a face whose width is within the chordal bound takes the constrained triangulation unrefined (as V1G-2 does for planes), or refinement never joins one interior point to two pole copies that are not neighbours.
