---
id: TKT-335
title: STEP mesher library: three costs the interpreter's cache hides but the compiled C# will pay (constants computed by loops, a whole-arena check per sample point, laws that mesh one model three times)
status: open
depends_on: []
owner:
fence: [sandbox/step-brep-mesh/00-foundation/foundation.library.plato, sandbox/step-brep-mesh/01-geometry/geometry.library.plato, sandbox/step-brep-mesh/07-validation/**, sandbox/step-brep-mesh/08-pipeline/pipeline-witnesses.laws.plato]
workflow: [W3, W4]
related: [TKT-323, TKT-332, TKT-324, TKT-315]
confidence: medium
created: 2026-10-18
---

## Acceptance criteria

- [ ] RoundingUnit and SmallestNormal no longer loop at each call: they are constants of the Number profile (cpu64: 2^-53 and 2^-1022; gpu32: 2^-24 and 2^-126), supplied by the host or by a profile-selected literal, with a law that the constant equals the loop's definition under each profile
- [ ] a law over a sampled grid checks the arena's well-formedness once, not at every sample: CheckGrid's callers (or CanEvaluate) take an already-checked GeometrySet, and every law that used CanEvaluate keeps its verdict
- [ ] the Law_HollowBox* and planted-face laws in 08-pipeline/pipeline-witnesses.laws.plato mesh each model once per case (bind the mesh, then test it), with unchanged verdicts
- [ ] one hollow-box case is timed with the interpreter's call cache switched off before and after, and the times are in the ticket log

Part of the epic TKT-323 (the STEP mesher in Plato); plan docs/plans/step-mesher-parallel.md. Found 2026-10-18 by the interpreter speed session (TKT-332) while profiling StepToMeshWitnessesLaws.Law_HollowBoxOuterMeshVolumePositive: in one 90 s hollow-box case, 30 s went to RoundingUnit and SmallestNormal (halving loops of 53 and about 1000 steps, asked for 19,200 times through ResolutionAt), 26 s to CanEvaluate re-running IsWellFormed over the whole GeometrySet at each CheckGrid sample, and the laws themselves meshed Witness_HollowBox(a, b) three times in one expression. TKT-332's call cache absorbs all three in the interpreter, but the compiled C# library has no cache, so they will cost it at native speed. Start after step B (TKT-324) closes: its session holds layers 00 and 01 now, and the topology session holds 07 and 08. The constants loop on purpose so one source serves both Number profiles; the fix keeps that property.
