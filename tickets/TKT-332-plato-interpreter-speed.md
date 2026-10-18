---
id: TKT-332
title: Plato interpreter speed: whole-model meshing laws run in seconds, and defect D5 (a conditional's condition evaluates to null) is fixed
status: claimed
depends_on: []
owner: session 2b20f2f0
session: 2b20f2f0-4d99-4684-a062-1b2db12618c7
fence: [../plato/src/Plato.Interpreter/**, ../plato/tests/Plato.Interpreter.Tests/**, ../plato/docs/reports/**]
workflow: [W3, W4]
related: [TKT-323, TKT-317, TKT-314, TKT-328]
confidence: high
created: 2026-10-18
claimed: 2026-10-18
---

## Acceptance criteria

- [ ] a profile of the slowest law (StepToMeshWitnessesLaws.Law_HollowBoxOuterMeshVolumePositive) names where its time goes, recorded in a dated report under ../plato/docs/reports/
- [ ] each of the ten laws that hit the 60 s budget in the 2026-10-18 sweep finishes a case in under 5 s, or the report names the cause that prevents it (for example a quadratic algorithm in the library, which then goes to the supervisor as a finding)
- [ ] D5 is reproduced by a unit test and fixed: Law_HollowBoxOuterMeshVolumePositive at case a = 5.785732621227266, b = 0.5 no longer reports 'a conditional's condition is not a Boolean: null'
- [ ] the interpreter's own tests pass, the stdlib law run keeps its 2026-10-18 verdicts (137 pass, 8 fail, 3 error), and Plato is built only into a private --artifacts-path, never into src/*/bin

Part of the epic TKT-323 (the STEP mesher in Plato); plan docs/plans/step-mesher-parallel.md, track P2. In the 2026-10-18 sweep (Plato docs/reports/interpreter-turnaround-2026-10-17.md, section 'Rerun on 2026-10-18'), ten laws that mesh a whole model took 600 s of the 802 s and got no verdict; without the budget one ran for 33 minutes. Steps A (TKT-314) and G (TKT-328) cannot close until these laws have verdicts. LawRunner.cs belongs to TKT-331 at the same time; do not edit it. Fixes to the library itself (sandbox/step-brep-mesh) are not in this fence: report them to the supervisor.
