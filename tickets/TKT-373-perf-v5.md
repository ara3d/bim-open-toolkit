---
id: TKT-373
title: STEP mesher complexity chunk V5: The seven sparse topology checks (Check_EveryEdgeUsedTwiceInClosedShellSparse and siblings) over V4's tables, iterating only cited pairs in the ...
status: done
depends_on: [TKT-372]
owner:
fence: [sandbox/step-mesh-staging/perf-sparse-grids/**]
workflow: [W3, W4]
related: [TKT-323, TKT-349, TKT-356]
created: 2026-10-21
closed: 2026-10-21
---

## Acceptance criteria

- [x] the staged functions of chunk V5 exist in sandbox/step-mesh-staging/perf-sparse-grids with their laws passing under cpu64, and every law the chunk's test column names keeps its verdict against sandbox/step-brep-mesh/reviews/verdicts-cpu64.tsv: `BrepWitnessesLaws.Law_SharedCorner*`, `Law_RedundantPoleLoop*`, `Law_FlippedFaceFailsExactlyOneLaw`, `Law_WitnessIsStructurallyClean`; count witness (cells visited <= C)
- [x] the chunk's Witness_<Family>Work(_: WorkClaim) builds its family at two sizes and passes Law_WorkIsWithinSlope with the slope the chunk states
- [x] every new or rewritten law runs under 2 s on the compiled backend (the pinned CLI, --backend=csharp --budget=2), and a witness that holds a mesh, discretization or triangulation is a shared Witness_* value, never re-meshed per law case
- [x] merged by the supervisor by wiring (TRACK.md merge instructions), the ledger row written, no regression at merge

Chunk V5 of docs/plans/step-mesher-complexity.md (the STEP mesher complexity sweep, 2026-10-21): ranked candidates 14 (checks); expected 2 h; depends on V4. Staging rules: sandbox/step-mesh-staging/README.md (new files only, <Name>Body or a renamed replacement, Law_Perf_* until merge). Testing strategy: the plan's section of that name, binding: laws over shared witnesses, one generic operation-count law over WorkClaim, verdict preservation; no wall-time test.
