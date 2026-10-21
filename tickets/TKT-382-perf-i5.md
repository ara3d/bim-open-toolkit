---
id: TKT-382
title: STEP mesher complexity chunk I5: A law that closure marks are sorted; IsMarkedClosedSorted by binary search; DomainOnce, TrimmedToBasisOnce; domain and tolerance once per face i...
status: done
depends_on: [TKT-360]
owner:
fence: [sandbox/step-mesh-staging/perf-closure-marks/**]
workflow: [W3, W4]
related: [TKT-323, TKT-349, TKT-356]
created: 2026-10-21
closed: 2026-10-21
---

## Acceptance criteria

- [x] the staged functions of chunk I5 exist in sandbox/step-mesh-staging/perf-closure-marks with their laws passing under cpu64, and every law the chunk's test column names keeps its verdict against sandbox/step-brep-mesh/reviews/verdicts-cpu64.tsv: `Law_ClosureMark*`, `Law_TrimmedRangeInsideBasis`, `Law_RectangularTrimmedInsideBasis`, `Law_UnwrapMovesByWholePeriods`; count witness (mark comparisons per Domain <= 2 log K + 2)
- [x] the chunk's Witness_<Family>Work(_: WorkClaim) builds its family at two sizes and passes Law_WorkIsWithinSlope with the slope the chunk states
- [x] every new or rewritten law runs under 2 s on the compiled backend (the pinned CLI, --backend=csharp --budget=2), and a witness that holds a mesh, discretization or triangulation is a shared Witness_* value, never re-meshed per law case
- [x] merged by the supervisor by wiring (TRACK.md merge instructions), the ledger row written, no regression at merge

Chunk I5 of docs/plans/step-mesher-complexity.md (the STEP mesher complexity sweep, 2026-10-21): ranked candidates 26; expected 2 h; depends on F1. Staging rules: sandbox/step-mesh-staging/README.md (new files only, <Name>Body or a renamed replacement, Law_Perf_* until merge). Testing strategy: the plan's section of that name, binding: laws over shared witnesses, one generic operation-count law over WorkClaim, verdict preservation; no wall-time test.
