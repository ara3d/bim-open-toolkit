---
id: TKT-428
title: STEP mesher: sphere faces over-refine near their poles, 14,500 to 19,600 triangles and up to 9 s per face on moon_buggy_asm.stp, 86% of them within 20 degrees of a pole
status: claimed
depends_on: []
owner: session 5135435e
session: 5135435e-eb61-4194-b168-7b93c64dd2fe
fence: [sandbox/step-brep-mesh/05-face-meshing/**]
workflow: [W3]
related: [TKT-323, TKT-325, TKT-399, TKT-420]
confidence: medium
created: 2026-10-22
claimed: 2026-10-22
kind: defect
---

## Acceptance criteria

- [ ] A law over Witness_Sphere(r) at a relative chordal bound of 1/254 bounds the triangle count near the poles (for example, no more triangles within 20 degrees of a pole than in the band between them), and fails on the current library
- [ ] moon_buggy_asm.stp's sphere faces (14, 16, 21, 23, 59, 60, 80, 82, 87, 89, 139, 141, 146, 148) mesh in under 2,000 triangles each at the default 1 mm bound, still within it, with face time under 0.5 s each
- [ ] The cone faces 26, 76 and 132 are checked for the same apex over-refinement, and fixed here or filed

Found 2026-10-22 on STEP Tools' public sample `data/step-samples/steptools-ap203/moon_buggy_asm.stp` (fetched by `scripts/fetch-step-samples.ps1`), harness `step-corpus-harness` built from bim-open-data at the pin of ba0be0a7, `--path host --parallel`, chordal bound 1 mm (StepMeshingOptions.MaxDeviation).

## What happens

The file has one SPHERICAL_SURFACE (#32030, radius 10 in) on face #32040, which is bounded by one VERTEX_LOOP at its north pole. The sphere is placed 14 times, so the prepared model has 14 sphere faces: 14, 16, 21, 23, 59, 60, 80, 82, 87, 89, 139, 141, 146, 148. Each refines to 14,500 to 19,600 triangles in 3.3 to 9 s, nearly all of it `refine_ms` (`RefineToSurface`). Together they are 227,404 of the model's 481,700 triangles and 94 s of its 151 s of face time (summed over threads).

## Not the units

The decoder converts the inch file to millimetres: face 14's mesh spans ±254 mm, a radius of 254 mm, and the host passes 1 mm in the same units.

## Cause: refinement near the poles

Triangles of face 14 by latitude, in 10 degree bands about the sphere's centre:

| Band | Triangles | Mean edge |
|---|---|---|
| -60 to +60 degrees (12 bands) | about 2,200 | 22 to 29 mm |
| 60 to 80 and -80 to -60 degrees | 6,595 | 3.7 to 16 mm |
| within 10 degrees of either pole | 10,851 | 1.5 to 1.9 mm |

Away from the poles the edges are about 28 mm, within what a 1 mm chordal bound on a 254 mm radius allows (sagitta L^2 / 8r gives 45 mm). Within 20 degrees of the poles the edges are 1.5 to 4 mm, and 86% of the face's triangles sit there. Over the whole face the median smallest corner angle is 7.1 degrees and the 10th percentile 0.1 degrees: refinement toward the 30 degree target (`RefinementMinAngle`, `triangulation-refine.library.plato`) never reaches it, and the points it inserts near the poles buy nothing.

The library's own sphere does the same. `gallery witness:Sphere:254 --chordal 1` (the seamed `Witness_Sphere(r)`, one meridian edge, no vertex loop) gives 20,784 triangles, 9,933 of them within 10 degrees of the north pole at a 1.2 mm mean edge; `gallery witness:Sphere --chordal 0.003937` (the unit sphere at the same bound relative to its radius) gives 17,680. So the cause is neither the inch file nor the pole-only loop: the angle-driven refinement in the sphere's (u, v) chart over-refines wherever the chart pinches to a pole. Corpus spheres need hundreds of triangles because they are small against the bound; the count grows with radius over bound, and the poles dominate it.

The cone faces 26, 76 and 132 (CONICAL_SURFACE #32790, radius 0 at its placement, so an apex) refine to 8,600 triangles each in 2 to 5 s, and 6 to 7% of their triangles are wound against the library's own corner normals. The apex is the same pinch and probably the same cause; not checked separately. TKT-420 (needle cone faces) is a different apex defect.

## Reproduction

```
step-corpus-harness gallery data/step-samples/steptools-ap203/moon_buggy_asm.stp s14.glb --parallel --faces 14 --ring 0
step-corpus-harness gallery witness:Sphere:254 w.glb --chordal 1
```

The latitude table came from a scratch script over the GLB's triangles (unindexed positions, bounding-box centre). TKT-399 (the curved-face check laws on the sphere and torus) and TKT-325 (step C, poles) are the nearest tickets; neither names the triangle count.
