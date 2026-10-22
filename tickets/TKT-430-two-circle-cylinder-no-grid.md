---
id: TKT-430
title: STEP mesher: two-circle cylinder faces whose circle vertices are not on one generator get no quad grid and refine to up to 51,768 triangles (moon_buggy_asm.stp's axle, face 29)
status: open
depends_on: []
owner:
fence: [sandbox/step-brep-mesh/05-face-meshing/**]
workflow: [W3]
related: [TKT-323, TKT-405]
confidence: medium
created: 2026-10-22
kind: defect
---

## Acceptance criteria

- [ ] A law over a two-circle cylinder witness with its circle vertices half a turn apart states that FaceQuadGridIn gives a grid, and fails on the current library
- [ ] moon_buggy_asm.stp's faces 13, 20, 29, 32, 64, 71, 74, 79, 86, 126, 135, 138 and 145 take the grid branch and stay within the 1 mm chordal bound

Found 2026-10-22 on STEP Tools' public sample `data/step-samples/steptools-ap203/moon_buggy_asm.stp` (fetched by `scripts/fetch-step-samples.ps1`), harness `step-corpus-harness` built from bim-open-data at the pin of ba0be0a7, `--path host --parallel`, chordal bound 1 mm, while tracing the file's slow sphere faces (filed separately).

## What happens

13 cylinder faces bounded by two full circles, with no seam edge, take the CDT branch and refine to isotropic triangles: 13, 20, 29, 32, 64, 71, 74, 79, 86, 126, 135, 138, 145. Together they are 224,506 triangles and 34 s of face time. Face 29, the axle (ADVANCED_FACE #33320 on CYLINDRICAL_SURFACE #33310, radius 0.5 in, 80 in long, each loop one circle cut into 24 segments), is 51,768 triangles in 6.4 s. Its median smallest corner angle is 45 degrees: the triangles are well shaped and far too many. The surface is straight along its axis, so a grid of 24 quads over the full length would meet the 1 mm chordal bound.

Faces 35, 67 and 129 have the same counts (two loops, two circle edges, 48 segments) and take the grid: 24 quads each.

## Cause, narrowed

`QuadSidesIn` (layer 5, called by `FaceQuadGridIn`) finds four sides on faces 35, 67, 129 and on the torus band 33, and none on 13, 20, 29, 32, 74 or the cone 26: the outcome is `NoGrid`, not `CountsDiffer`. This came from a scratch program over the harness calling `UnorientedRegionOfIn`, `OrientRegion`, `ChartOf`, `RegionToleranceIn` and `QuadSidesIn`. The difference in the file: the axle's two circle vertices are half a turn apart (#32870 at (0.5, 0, 0), #32890 at (-0.5, 0, 80)), while cylinder face #34620 (face 35) has both vertices at x = -8, on one generator. When the two vertices are not on one generator, the seam the region cuts between them is probably not a straight side, so no four corners are found. Not confirmed in the code.

The two-loop cones 26, 76 and 132 also take the CDT branch; their apex is the case of the sphere ticket.

## Reproduction

```
step-corpus-harness gallery data/step-samples/steptools-ap203/moon_buggy_asm.stp f29.glb --parallel --faces 29 --ring 0
```
