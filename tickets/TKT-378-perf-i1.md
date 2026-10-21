---
id: TKT-378
title: STEP mesher complexity chunk I1: RoundingUnit and SmallestNormal as profile constants (TKT-335 H1): a closed form per profile with a law that the constant equals the loop's valu...
status: open
depends_on: [TKT-357]
owner:
fence: [sandbox/step-mesh-staging/perf-constants/**]
workflow: [W3, W4]
related: [TKT-323, TKT-349, TKT-356, TKT-335]
created: 2026-10-21
---

## Acceptance criteria

- [x] the staged functions of chunk I1 exist in sandbox/step-mesh-staging/perf-constants with their laws passing under cpu64, and every law the chunk's test column names keeps its verdict against sandbox/step-brep-mesh/reviews/verdicts-cpu64.tsv: every law of layers 00 to 02 keeps its verdict (`BrepFoundation*Laws`, `BrepGeometryLaws`, `BrepTopologyLaws`); the equality law under both profiles
- [x] every new or rewritten law runs under 2 s on the compiled backend (the pinned CLI, --backend=csharp --budget=2), and a witness that holds a mesh, discretization or triangulation is a shared Witness_* value, never re-meshed per law case
- [x] merged by the supervisor by wiring (TRACK.md merge instructions), the ledger row written, no regression at merge

Chunk I1 of docs/plans/step-mesher-complexity.md (the STEP mesher complexity sweep, 2026-10-21): ranked candidates 20; expected 1.5 h; depends on W0. Staging rules: sandbox/step-mesh-staging/README.md (new files only, <Name>Body or a renamed replacement, Law_Perf_* until merge). Testing strategy: the plan's section of that name, binding: laws over shared witnesses, one generic operation-count law over WorkClaim, verdict preservation; no wall-time test.
