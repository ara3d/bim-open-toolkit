---
id: TKT-383
title: STEP mesher complexity chunk R1: TryInsertionInto, SurfacePassBuilt, AnglePassBuilt: points, chart points, 3D positions, triangles and neighbours as List builders through a pass...
status: open
depends_on: [TKT-363]
owner:
fence: [sandbox/step-mesh-staging/perf-insertion/**]
workflow: [W3, W4]
related: [TKT-323, TKT-349, TKT-356, TKT-351]
created: 2026-10-21
---

## Acceptance criteria

- [x] the staged functions of chunk R1 exist in sandbox/step-mesh-staging/perf-insertion with their laws passing under cpu64, and every law the chunk's test column names keeps its verdict against sandbox/step-brep-mesh/reviews/verdicts-cpu64.tsv: `TriangulationLaws.Law_Refine*`, `Law_MinAngle*`, `Law_UpdatedNeighboursAreTheTable`; count witness (array copies per candidate = 0, Evals per accepted point = 1)
- [x] the chunk's Witness_<Family>Work(_: WorkClaim) builds its family at two sizes and passes Law_WorkIsWithinSlope with the slope the chunk states
- [x] every new or rewritten law runs under 2 s on the compiled backend (the pinned CLI, --backend=csharp --budget=2), and a witness that holds a mesh, discretization or triangulation is a shared Witness_* value, never re-meshed per law case
- [ ] merged by the supervisor by wiring (TRACK.md merge instructions), the ledger row written, no regression at merge

Chunk R1 of docs/plans/step-mesher-complexity.md (the STEP mesher complexity sweep, 2026-10-21): ranked candidates 22; expected 2 h; depends on F4. Staging rules: sandbox/step-mesh-staging/README.md (new files only, <Name>Body or a renamed replacement, Law_Perf_* until merge). Testing strategy: the plan's section of that name, binding: laws over shared witnesses, one generic operation-count law over WorkClaim, verdict preservation; no wall-time test.
