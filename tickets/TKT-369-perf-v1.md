---
id: TKT-369
title: STEP mesher complexity chunk V1: CanEvaluateGiven(g, ok, x) for the four index kinds; *Hoisted samplers computing IsWellFormed once and each entry's samples once; the inline gua...
status: open
depends_on: [TKT-357]
owner:
fence: [sandbox/step-mesh-staging/perf-samplers/**]
workflow: [W3, W4]
related: [TKT-323, TKT-349, TKT-356, TKT-335]
created: 2026-10-21
---

## Acceptance criteria

- [ ] the staged functions of chunk V1 exist in sandbox/step-mesh-staging/perf-samplers with their laws passing under cpu64, and every law the chunk's test column names keeps its verdict against sandbox/step-brep-mesh/reviews/verdicts-cpu64.tsv: `BrepWitnessesLaws.Law_*ValidatesClean`, `BrepCheckingProofsLaws`, `BrepCheckingDefectsLaws`; count witness (`IsWellFormed` runs per check = 1)
- [ ] the chunk's Witness_<Family>Work(_: WorkClaim) builds its family at two sizes and passes Law_WorkIsWithinSlope with the slope the chunk states
- [ ] every new or rewritten law runs under 2 s on the compiled backend (the pinned CLI, --backend=csharp --budget=2), and a witness that holds a mesh, discretization or triangulation is a shared Witness_* value, never re-meshed per law case
- [ ] merged by the supervisor by wiring (TRACK.md merge instructions), the ledger row written, no regression at merge

Chunk V1 of docs/plans/step-mesher-complexity.md (the STEP mesher complexity sweep, 2026-10-21): ranked candidates 12; expected 2 h; depends on W0. Staging rules: sandbox/step-mesh-staging/README.md (new files only, <Name>Body or a renamed replacement, Law_Perf_* until merge). Testing strategy: the plan's section of that name, binding: laws over shared witnesses, one generic operation-count law over WorkClaim, verdict preservation; no wall-time test.
