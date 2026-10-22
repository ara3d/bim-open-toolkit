---
id: TKT-349
title: STEP mesher: meshing one plane face with 80 to 212 boundary edges takes 86 s to over 8 minutes in the compiled library
status: open
depends_on: []
owner:
fence: [sandbox/step-brep-mesh/05-face-meshing/**]
workflow: [W3, W4]
related: [TKT-323, TKT-313, TKT-335, TKT-343, TKT-346]
created: 2026-10-19
kind: defect
---

## Acceptance criteria

- [ ] In the compiled C# library (Release, one process, nothing else running), each of these plane faces meshes in under 2 s, or returns a located diagnostic within 2 s: SHO/ODIN-W160.STEP faces #15368 and #19250, SHO/ODIN-W161.STEP faces #14327 and #16423, SHO/LILY-W131.STEP face #2846, SHO/LILY-W132.STEP face #2958, SHO/ODIN-W260.STEP face #10196, SHO/ODIN-W262.STEP face #9213
- [ ] SHO/LILY-W131, LILY-W132, ODIN-W160, ODIN-W161 and ODIN-W262 each finish StepMesher.Mesh within the corpus run's 120 s limit
- [ ] The cost is named in the log: whether it grows with the face's boundary (edge count, holes) or with the whole model (for example TKT-335's whole-arena check per sample), with a timing of one face before and after

Found 2026-10-19 by the corpus run, step H of docs/plans/step-mesher-v2.md (report: docs/plans/step-mesher-corpus-2026-10-19.md, per-file CSV beside it). Measured library: Ara3D.StepBrep at bim-open-data a4298c8, generated from Plato acbc9b94 and bim-open-toolkit 6aee137d (layers 00 to 07), before the triangulation merge (7d8dae2d, TKT-343) and the termination merge (91e6b055, TKT-346).

Five files passed the 120 s limit in the face stage, and a sixth reached it after a slow edge stage. A rerun with a 600 s limit (seven files in parallel, so times are inflated) and a timer per face: ODIN-W160 finished in 358 s, two plane faces taking 86 s each (#15368: 1 loop, 80 edges, 44 lines and 36 circles; #19250). ODIN-W161 finished in 378 s, faces #14327 and #16423 taking 88 s each. Still running at 600 s, each on one plane face: LILY-W131 face #2846 (13 loops, 102 edges), LILY-W132 face #2958 (13 loops), ODIN-W260 face #10196 (1 loop, 212 lines), ODIN-W262 face #9213 (1 loop, 212 edges, 160 lines and 52 circles). Every other plane face in these files meshed in under 1 s, and the nine files that finish average 3 to 14 ms per face.

Not covered: TKT-346 bounded the loops of layers 4 and 5 against non-termination, not against cost; TKT-343 replaced ear clipping with constrained Delaunay but tested witnesses with a few edges; TKT-335 names whole-arena checks per sample point, which may be the cause here and is to be ruled in or out by criterion 3. The faces to rerun first are #15368 in ODIN-W160 (finishes) and #10196 in ODIN-W260 (does not).

Note 2026-10-21, owner's decision: in version 1 the angle-quality refinement pass does not run on planar faces (the boundary is locked, so no angle guarantee exists, MESHING-REQUIREMENTS finding 8). A fix here may take that route.
