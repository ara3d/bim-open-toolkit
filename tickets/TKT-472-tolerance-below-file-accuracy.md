---
id: TKT-472
title: "STEP mesher checks: EdgeLiesOnAdjacentSurfaces, VertexCoincidesWithCurveEnd and EdgeDomainEndsAtVertices judge a file's measured gap against the length tolerance, so they fail on files whose own accuracy is coarser; judge against the file's stated uncertainty and report the gap as Info"
status: open
depends_on: []
owner:
fence: [sandbox/step-brep-mesh/07-validation/**]
workflow: [W3]
related: [TKT-441]
created: 2026-10-22
kind: defect
---

**Deferred until after version 1** (supervisor, 2026-10-22): it changes what three checks say, not the mesh.

## Acceptance criteria

- [ ] EdgeLiesOnAdjacentSurfaces, VertexCoincidesWithCurveEnd and EdgeDomainEndsAtVertices judge a gap against the file's stated uncertainty (layer 3's context uncertainty, when the file states one), not against the decided length tolerance
- [ ] a measured gap above the length tolerance is reported as an Info diagnostic located at its edge or vertex, with its size as the measure, instead of failing the check
- [ ] on the prepared models of POS/MAX (STEP-AP214), POS/SAM_AP203 and AP214, SHO/JODY-W4, SHO/M2_JODY-W5 and W6 CARD, POS/ZOE_S-LGA51 (both), SHO/NORA-B120, B121, B126 and POS/ANN-MB2 the three checks pass, and each file's gaps appear as Info diagnostics
- [ ] PrepareModel's decided tolerance is unchanged (the meshes of those files keep their digests)

Found by layer 7's checks on every corpus file (TKT-441; docs/plans/step-mesher-reliability-2026-10-22.md, TKT-441 section; run: step-corpus-harness all <corpus> <out> 300 --child laws, bim-open-data 97495d8, library before J5). Prepared models: edges off their adjacent surfaces by 2.0e-5 to 3.6e-4 mm against a length tolerance of 2e-6 to 1e-5 mm (MAX face 156 3.6e-4, SAM face 0 8.8e-5, JODY-W5/W6 face 897 1e-4, JODY-W4 face 61 2e-5); vertices off their curve ends by 2.4e-5 mm (NORA-B120 edge 7981, B121 7727, B126 7871, bound 2e-6) and 3.9e-3 mm (ZOE_S-LGA51 edges 2418, 2420, bound 1e-5); ANN-MB2 edge 1252 1.2e-5 against 1e-5. NINA-B222's 0.365 mm (edge 1507) predates J5 and is not counted.

## Why the checks change and the tolerance does not

The ticket first asked whether the decided tolerance should rise to the files' measured accuracy. Measured, 2026-10-22 (v1-reliability): a scratch probe repeats PrepareModelWith's body with only the length tolerance replaced (parameter floors re-derived as ModelTolerances derives them) and meshes the way the harness's time mode does (toolkit HEAD with J5, Plato c8c83c8b), each file at its decided tolerance and at about twice its worst measured gap; 24 runs, 166 s.

| File | Tolerance | Vertices | Triangles | Boundary | Non-manifold | Misoriented | Contract |
|---|---|---|---|---|---|---|---|
| MAX AP203 | 1e-5 decided | 918 | 1,796 | 0 | 0 | 0 | holds |
| MAX AP203 | 1e-3 | 869 | 1,858 | 236 | 22 | 44 | holds |
| MAX AP214 | 1e-5 decided | 918 | 1,796 | 0 | 0 | 0 | holds |
| MAX AP214 | 1e-3 | 869 | 1,858 | 236 | 22 | 44 | holds |
| SAM AP203 | 1e-5 decided | 248 | 417 | 51 | 0 | 0 | holds |
| SAM AP203 | 2e-4 | 248 | 417 | 51 | 0 | 0 | holds (same digest) |
| SAM AP214 | 1e-5 decided | 248 | 417 | 51 | 0 | 0 | holds |
| SAM AP214 | 2e-4 | 248 | 417 | 51 | 0 | 0 | holds (same digest) |
| JODY-W4 | 2e-6 decided | 3,520 | 1,070 | 0 | 0 | 0 | holds |
| JODY-W4 | 4e-5 | 3,520 | 398 | 0 | 0 | 0 | holds |
| JODY-W5/W6 | 1e-5 decided | 2,175 | 2,442 | 0 | 108 | 216 | broken, 3 flipped |
| JODY-W5/W6 | 2e-4 | 2,175 | 2,442 | 0 | 108 | 216 | broken, 3 flipped (same digest) |
| ZOE_S-LGA51 AP203 | 1e-5 decided | 1,712 | 3,790 | 104 | 0 | 0 | holds |
| ZOE_S-LGA51 AP203 | 8e-3 | 968 | 4,674 | 3,248 | 204 | 266 | broken, 118 flipped |
| ZOE_S-LGA51 AP214 | 1e-5 decided | 1,712 | 3,790 | 104 | 0 | 0 | holds |
| ZOE_S-LGA51 AP214 | 8e-3 | 968 | 4,634 | 3,256 | 204 | 258 | broken, 116 flipped |
| NORA-B120 | 2e-6 decided | 5,580 | 5,609 | 17 | 0 | 0 | holds |
| NORA-B120 | 5e-5 | 5,580 | 5,407 | 33 | 0 | 0 | holds |
| NORA-B121 | 2e-6 decided | 5,415 | 5,211 | 17 | 0 | 0 | holds |
| NORA-B121 | 5e-5 | 5,415 | 5,017 | 33 | 0 | 0 | holds |
| NORA-B126 | 2e-6 decided | 5,511 | 5,219 | 17 | 0 | 0 | holds |
| NORA-B126 | 5e-5 | 5,511 | 5,017 | 33 | 0 | 0 | holds |
| ANN-MB2 | 1e-5 decided | 3,371 | 14,856 | 0 | 0 | 0 | broken, 1 flipped |
| ANN-MB2 | 2.5e-5 | 3,371 | 14,878 | 0 | 0 | 0 | broken, 1 flipped |

A raised tolerance removes no gap, hole or non-manifold edge in any file, and it creates them in MAX, ZOE and NORA by merging vertices that are distinct (49 and 744 vertices merged in MAX and ZOE). The gaps the checks measure are the file's own inaccuracy, harmless to the mesh because each edge carries its own 3D points. So PrepareModel's tolerance stays, and only the three checks change. The JODY-W5/W6 rows predate TKT-465 cause A (its 3 flipped faces) and its non-manifold edges are J7's double sheets.
