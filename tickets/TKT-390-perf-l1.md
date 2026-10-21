---
id: TKT-390
title: STEP mesher complexity chunk L1: MeshedWitness type, Witness_*Meshed for the unit box, hollow box, block with hole, planted-face and cylinder witnesses; pipeline-witnesses.laws....
status: done
depends_on: []
owner:
fence: [sandbox/step-mesh-staging/perf-witnesses/**]
workflow: [W3, W4]
related: [TKT-323, TKT-349, TKT-356, TKT-335, TKT-356]
created: 2026-10-21
closed: 2026-10-21
---

## Acceptance criteria

- [x] the staged functions of chunk L1 exist in sandbox/step-mesh-staging/perf-witnesses with their laws passing under cpu64, and every law the chunk's test column names keeps its verdict against sandbox/step-brep-mesh/reviews/verdicts-cpu64.tsv: the rewritten laws keep their verdicts; each new law under 2 s compiled
- [x] every new or rewritten law runs under 2 s on the compiled backend (the pinned CLI, --backend=csharp --budget=2), and a witness that holds a mesh, discretization or triangulation is a shared Witness_* value, never re-meshed per law case
- [x] merged by the supervisor by wiring (TRACK.md merge instructions), the ledger row written, no regression at merge

Chunk L1 of docs/plans/step-mesher-complexity.md (the STEP mesher complexity sweep, 2026-10-21): ranked candidates 36; expected 2 h; depends on nothing but W0. Staging rules: sandbox/step-mesh-staging/README.md (new files only, <Name>Body or a renamed replacement, Law_Perf_* until merge). Testing strategy: the plan's section of that name, binding: laws over shared witnesses, one generic operation-count law over WorkClaim, verdict preservation; no wall-time test.
