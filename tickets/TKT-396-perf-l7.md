---
id: TKT-396
title: STEP mesher complexity chunk L7: Tooling: Of-form law-runner helpers meshing each witness once, WitnessNames, StatesOf, RunOutcomeFrom
status: open
depends_on: [TKT-390]
owner:
fence: [sandbox/step-mesh-staging/perf-tooling/**]
workflow: [W3, W4]
related: [TKT-323, TKT-349, TKT-356]
created: 2026-10-21
---

## Acceptance criteria

- [x] the staged functions of chunk L7 exist in sandbox/step-mesh-staging/perf-tooling with their laws passing under cpu64, and every law the chunk's test column names keeps its verdict against sandbox/step-brep-mesh/reviews/verdicts-cpu64.tsv: `ToolingLawRunnerLaws`, `ToolingDumpsLaws`
- [x] every new or rewritten law runs under 2 s on the compiled backend (the pinned CLI, --backend=csharp --budget=2), and a witness that holds a mesh, discretization or triangulation is a shared Witness_* value, never re-meshed per law case
- [ ] merged by the supervisor by wiring (TRACK.md merge instructions), the ledger row written, no regression at merge

Chunk L7 of docs/plans/step-mesher-complexity.md (the STEP mesher complexity sweep, 2026-10-21): ranked candidates 40; expected 1.5 h; depends on L1. Staging rules: sandbox/step-mesh-staging/README.md (new files only, <Name>Body or a renamed replacement, Law_Perf_* until merge). Testing strategy: the plan's section of that name, binding: laws over shared witnesses, one generic operation-count law over WorkClaim, verdict preservation; no wall-time test.
