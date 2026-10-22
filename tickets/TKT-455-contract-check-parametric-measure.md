---
id: TKT-455
title: STEP mesher: the harness's contract check reports moon_buggy's B-spline faces 41 and 117 at 3.8 times the chordal bound, but their meshes are within it; the measure compares each triangle with the surface over its own parameter triangle
status: claimed
depends_on: []
owner: session 5135435e
session: 5135435e-eb61-4194-b168-7b93c64dd2fe
fence: [deps/bim-open-data/tools/step-corpus-harness/**, sandbox/step-brep-mesh/08-pipeline/pipeline-v1-gate.library.plato]
workflow: [W3]
related: [TKT-415, TKT-435, TKT-418]
created: 2026-10-22
claimed: 2026-10-22
kind: defect
---

## Acceptance criteria

- [ ] The harness's ContractCheck measures surface-to-mesh deviation as the distance from each surface sample of an element's parameter region to the element's split as a whole (for a quad, the union of the split's two triangles), and mesh-to-surface by projection, and reports faces 41 and 117 of moon_buggy_asm.stp within the bound
- [ ] The staged gate claim QuadSplitsWithin (pipeline-v1-gate.library.plato) states the same measure, or says why the stricter per-triangle form is kept

Found 2026-10-22 by the v1-gate track (V1G-9, sandbox/step-mesh-staging/v1-gate/TRACK.md). Faces 41 and 117 of data/step-samples/steptools-ap203/moon_buggy_asm.stp are B-spline faces meshed by the quad grid as 13 planar quads (strips about 80 mm by 1016 mm), with F1's and T1's keep rules both keeping them. The harness's contract check reports a deviation of 3.80 against a bound of 1.00: on quad 0, the surface point at the parameter midpoint of the split's diagonal, (0.938, 0.5), lies 3.80 from triangle (0 1 2) and 0.77 from triangle (0 2 3) of the same split. The B-spline's parametrization is not uniform across the strip, so that point lands in 3D beside the triangle whose parameter triangle it belongs to, inside its neighbour. Measured geometrically with a 21 x 21 sample (scratch probe on a regeneration of HEAD dc2ccca4 with V1G-4, chordal 1.0): every point of every triangle of both splits is within 0.954 of the surface (projection), and every surface point over each quad is within 0.956 of the quad. So the mesh meets the contract's chordal bullet; the per-triangle parametric measure overstates it. The staged gate laws of V1G-1 (CornerTriangleGap in pipeline-v1-gate.library.plato) use the same per-triangle form and would flag such a face too. Gate kind: chordal (the measure, not the mesh).
