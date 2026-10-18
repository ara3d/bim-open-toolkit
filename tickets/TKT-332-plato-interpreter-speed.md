---
id: TKT-332
title: Plato interpreter speed: whole-model meshing laws run in seconds, and defect D5 (a conditional's condition evaluates to null) is fixed
status: done
depends_on: []
owner: session 2b20f2f0
session: 2b20f2f0-4d99-4684-a062-1b2db12618c7
fence: [../plato/src/Plato.Interpreter/**, ../plato/tests/Plato.Interpreter.Tests/**, ../plato/docs/reports/**]
workflow: [W3, W4]
related: [TKT-323, TKT-317, TKT-314, TKT-328]
confidence: high
created: 2026-10-18
claimed: 2026-10-18
closed: 2026-10-18
---

## Acceptance criteria

- [x] a profile of the slowest law (StepToMeshWitnessesLaws.Law_HollowBoxOuterMeshVolumePositive) names where its time goes, recorded in a dated report under ../plato/docs/reports/ Evidence: Plato docs/reports/interpreter-speed-2026-10-18.md, 'Where one case spent its time' (profiler ad14b152): of a 90 s window, 30 s in SmallestNormal and RoundingUnit (constants written as loops, asked 19,200 times), 26 s in IsWellFormed re-run per sample point; the model's validation, not the mesher, held the time.
- [x] each of the ten laws that hit the 60 s budget in the 2026-10-18 sweep finishes a case in under 5 s, or the report names the cause that prevents it (for example a quadratic algorithm in the library, which then goes to the supervisor as a finding) Evidence: same report, 'The ten laws, before and after': Plato 93907bd7 (call memo) gives all ten verdicts in 78.6 s together (600 s and no verdict before), mean per case 0.15 to 1.5 s; the D5 case alone 4.1 s cold. Library findings (loop constants, IsWellFormed per sample, a model meshed three times per law, and the four non-pass verdicts) sent to the supervisor 2026-10-18.
- [x] D5 is reproduced by a unit test and fixed: Law_HollowBoxOuterMeshVolumePositive at case a = 5.785732621227266, b = 0.5 no longer reports 'a conditional's condition is not a Boolean: null' Evidence: Plato 8cbf8894; UnitTests.Buffer_slots_never_set_hold_the_default failed with the exact message before the fix and passes after; the law at that case returns true in 4.1 s.
- [x] the interpreter's own tests pass, the stdlib law run keeps its 2026-10-18 verdicts (137 pass, 8 fail, 3 error), and Plato is built only into a private --artifacts-path, never into src/*/bin Evidence: tests/Plato.Interpreter.Tests all pass (64, the C# differential under cpu64 and gpu32 included); stdlib run 148 laws: 137 pass, 8 fail, 3 error, same laws; every build used --artifacts-path under the session scratchpad.

Part of the epic TKT-323 (the STEP mesher in Plato); plan docs/plans/step-mesher-parallel.md, track P2. In the 2026-10-18 sweep (Plato docs/reports/interpreter-turnaround-2026-10-17.md, section 'Rerun on 2026-10-18'), ten laws that mesh a whole model took 600 s of the 802 s and got no verdict; without the budget one ran for 33 minutes. Steps A (TKT-314) and G (TKT-328) cannot close until these laws have verdicts. LawRunner.cs belongs to TKT-331 at the same time; do not edit it. Fixes to the library itself (sandbox/step-brep-mesh) are not in this fence: report them to the supervisor.

## Log

- 2026-10-18: done in Plato 8cbf8894 (D5: a new Buffer holds its element default), ad14b152 (CallProfile), 93907bd7 (CallMemo, the speed fix), 6e7726a1 (report docs/reports/interpreter-speed-2026-10-18.md). Left: the per-call price of the interpreter (about 1.2 us) is unchanged; memo memory over a full sweep not measured; cold timings on an idle machine not taken; CLI flags for the profiler and for turning the memo off belong to the CLI (TKT-331 fence).
- 2026-10-18: supervisor follow-up on top-level Number law parameters (docs/interpreter.md Limits): already fixed in Plato 1a3298fa, inside the pinned 062b8dc7; Law_TighterChordalStaysWithinLooserBound passes 25 cases. Plato 88aa0277 adds ValueDomainTests to guard it, and fixes the gap that test found (String.Count and String.At were host obligations through ICountable). The Limits entry in docs/interpreter.md is stale (TKT-331 fence).
