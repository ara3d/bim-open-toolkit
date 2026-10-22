---
id: TKT-458
title: STEP mesher: refine curved faces with poles in a chart whose u scale follows the latitude, so a sphere meshes in about what its chordal bound needs
status: open
depends_on: []
owner:
fence: [sandbox/step-brep-mesh/05-face-meshing/**]
workflow: [W3]
related: [TKT-428]
created: 2026-10-22
kind: idea
---

From the v1-gate track's V1G-13 (sandbox/step-mesh-staging/v1-gate/TRACK.md), 2026-10-22. After V1G-4 (chordal-only refinement) and V1G-13 (collapsed triangles at a pole no longer refined), moon_buggy_asm.stp's spheres (radius 254 mm, 1 mm bound) mesh in 2,928 triangles each, against about 1,000 to 1,500 that edges up to 45 mm would need. The mesh stays near uniform in the sphere's (u, v) chart, 150 to 190 triangles per 10 degree latitude band at every latitude, so the bands near the poles, about a tenth of the area, are about 5 times denser than the equator. A coarser pole segment (a 60 degree step) made it worse (3,042). Idea: refine, or triangulate, in a chart whose u scale is the parallel's radius at each latitude (cos v on a sphere, the distance to the axis on a cone or torus), so chart-isotropic triangles are isotropic in 3D near a pole too. Element count is a quality and size matter, not the version 1 contract: after version 1.
