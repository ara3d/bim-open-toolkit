---
id: TKT-468
title: STEP mesher: ear clipping stops early on plane regions with many collinear boundary points and drops 3,221 triangles in 72 faces of 36 corpus files, opening the closed shells around them
status: open
depends_on: []
owner:
fence: [sandbox/step-brep-mesh/05-face-meshing/**]
workflow: [W3]
related: [TKT-323, TKT-462, TKT-349]
created: 2026-10-22
kind: defect
---

## Acceptance criteria

- [ ] A law over a witness plane region with holes whose boundary has straight angles and points aligned on the bridges (a pad array: an outer rectangle and a grid of rectangular holes in rows) states that the seed triangulation has n + 2h - 2 triangles for n boundary points and h holes of three or more points, and fails on the current library
- [ ] When no ear is found, the triangulation does not return a partial triangle list silently: it finishes by another rule, or the face carries a located diagnostic
- [ ] On the 88 corpus files no face's seed triangulation is short of n + 2h - 2 triangles, and the harness's boundary check (bim-open-data 97495d8 or later) reports no GapBetweenMeshedFaces or InsideFace edges that this defect explains

Found 2026-10-22 by track v1-edges while classifying the boundary edges of the corpus run of 2026-10-22 (library 43dd439b, bim-open-data b2cfaf3). Of the boundary edges in shells the file declares closed, 1,749 are gaps between two meshed faces and 1,152 lie inside a face, in 28 and 29 files: RCB-F9T, TOBY-L4, NORA-B100/B101/B106, MPCI, PAM, LARA, the SARA family, LEA, LEXI, ZOE, M2-ZED, SAM, NEO, MIA, CAM and others. They trace to one face per file in most cases, a big plane face with many holes (a board with a pad array): CEL/LARA F742 (101 loops, 404 boundary points, 100 holes) gets 546 seed triangles where n + 2h - 2 = 602, and F504 118 where 154. Its own triangulation then has open sides (the InsideFace edges, long diagonals between hole vertices) and the small faces round its holes (pad sides, one-quad grids, the cylinders of NORA's vias) keep sides it no longer meets (the gaps). Hole bridging is not the cause: the bridged ring has exactly n + 2h entries and every hole is in it. Ear clipping is: TriangulateRegionCdtIndexed's EarClippedIndexedCounted and the reference EarClipped (face-meshing.library.plato) both stop at the same count (546 on F742) when no position passes IsEar, whose test needs a strictly positive triangle and no ring point in the closed triangle; the rings have many straight angles (116 of 604 positions on F742) and points exactly on bridges and triangle sides. A probe of every face's seed (ears.txt in this session's notes) finds 72 faces in 36 files, 3,221 triangles missing, 11 of the faces with no hole at all (ELLA-W1 F304, one loop, 191 missing). Related: TKT-462 (the same planes emit collinear slivers), and the refinement and flips downstream add no triangle where the seed has none.
