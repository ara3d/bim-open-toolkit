---
id: TKT-429
title: STEP mesher: a torus band bounded by two full circles is meshed on the wrong half of the tube, 180 misoriented edges on moon_buggy_asm.stp (faces 33, 65, 127)
status: open
depends_on: []
owner:
fence: [sandbox/step-brep-mesh/05-face-meshing/**]
workflow: [W3]
related: [TKT-323, TKT-413, TKT-410, TKT-325]
confidence: medium
created: 2026-10-22
kind: defect
---

## Acceptance criteria

- [ ] A law over a torus band witness bounded by two v-circles, with the band crossing the v seam, states that the meshed points lie on the band the loops bound, and fails on the current library
- [ ] moon_buggy_asm.stp's assembled mesh has 0 misoriented edges, and faces 33, 65 and 127 lie 177.8 to 190.5 mm from their axis
- [ ] The corpus rerun's misoriented counts do not rise in any file

Found 2026-10-22 on STEP Tools' public sample `data/step-samples/steptools-ap203/moon_buggy_asm.stp` (fetched by `scripts/fetch-step-samples.ps1`), harness `step-corpus-harness` built from bim-open-data at the pin of ba0be0a7, `--path host --parallel`. The assembled mesh has 180 misoriented and 112 boundary edges, more misoriented edges than any u-blox corpus file.

## Which faces

A scratch program over the harness attributes every edge: `TimedMesh.Run`, the face meshes assembled with `AssembleModelMesh`, and each directed edge credited to its element's face through `ModelMesh.ElementFace`.

- **Misoriented, 180:** 30 on each of six face pairs, all torus against plane: (33, 34), (33, 36), (65, 66), (65, 68), (127, 128), (127, 130). Faces 33, 65 and 127 are three placements of ADVANCED_FACE #34380 on TOROIDAL_SURFACE #34370 (major radius 7 in, minor 0.5 in, sense .T.). Two FACE_BOUNDs bound it, each holding one closed circle edge of radius 7 in: #34080 at z = -37 and #34260 at z = -38, the top and bottom of the tube. Each torus face disagrees with both its plane neighbours, so the torus face is the wrong one, in all three placements; this is not a mirrored occurrence.
- **Boundary, 112:** all on faces beside the 20 undiscretized faces of TKT-410's compiler stub: faces 37, 38, 39, 40, 42, 44, 46 and their second placement 113, 114, 115, 116, 118, 120, 122, 56 edges each. None lies between two meshed faces, so they belong to TKT-410, not to this ticket.

## Cause: the band is meshed on the wrong half of the tube

The two circles split the tube into two bands: the outer half (7 to 7.5 in from the axis, through v = 0) and the inner half (6.5 to 7 in, through v = pi). The file asks for the outer half. With sense .T. the face's normal is the tube's outward normal, and the face lies to the left of edge #34080 as the loop runs it; at the start vertex (-14.5, -0.5, -37) the tangent is +y, and normal x tangent points radially outward. The neighbouring plane face #34500 is the annulus from 0.5 in to 7 in, so the solid is a disc with a rounded rim.

The mesher meshes the inner half. Face 33's mesh (grid branch, 360 quads) lies 165.1 to 177.8 mm from the axis (6.5 to 7 in). Its winding agrees with the library's corner normals on every element, so the face is not flipped against its own normals. It is the complementary band, carrying the tube's outward normals, which there point into the solid. The rim renders as a groove, and its edges disagree with both caps.

Narrowed question for the fix: where the circles' two v values become an interval. The outer band runs from v = 3pi/2 through 0 to pi/2, across the surface's v seam. An interval built from the two values as numbers in [0, 2pi), smaller first, gives [pi/2, 3pi/2], the inner band. The suspects are layer 5's region for a face whose loops are closed curves with no seam edge (`UnorientedRegionOfIn`, `OrientRegion`) and the quad grid it feeds (`FaceQuadGridIn`). The loops' direction, not the numeric order, has to choose the band. Not confirmed in the code.

## TKT-413's staged fix does not cover it

Track v1-edges' chunk E1 (`sandbox/step-mesh-staging/v1-edges/loop-chaining.library.plato`, TKT-413 and TKT-419) re-senses edge loops that do not chain head to tail. Each loop here holds one closed edge whose start and end vertex are the same, so it already chains, and E1 leaves it as written (`LeavingVertex` keeps a closed edge). The defect is in face meshing, not in preparation.

## Reproduction

```
step-corpus-harness gallery data/step-samples/steptools-ap203/moon_buggy_asm.stp f33.glb --parallel --faces 33 --ring 1
```

The GLB shows face 33 inside the solid; the JSON sidecar's check gives the whole file's counts.
