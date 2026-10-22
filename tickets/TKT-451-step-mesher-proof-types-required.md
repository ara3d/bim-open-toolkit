---
id: TKT-451
title: STEP mesher: functions that need a checked property take its proof type (InRangeModel, PreparedModel), and the pipeline returns MeshResult
status: open
depends_on: [TKT-444]
owner:
fence: [sandbox/step-brep-mesh/00-foundation/**, sandbox/step-brep-mesh/01-geometry/**, sandbox/step-brep-mesh/02-topology/**, sandbox/step-brep-mesh/03-step/**, sandbox/step-brep-mesh/04-discretization/**, sandbox/step-brep-mesh/05-face-meshing/**, sandbox/step-brep-mesh/06-mesh/**, sandbox/step-brep-mesh/07-validation/**, sandbox/step-brep-mesh/08-pipeline/**, sandbox/step-brep-mesh/10-editing/**, sandbox/step-brep-mesh/11-repair/**, sandbox/step-brep-mesh/reviews/verdicts-cpu64.tsv]
workflow: [W3]
related: [TKT-435]
confidence: medium
created: 2026-10-22
---

## Acceptance criteria

- [ ] The 20 functions whose comment says 'Precondition: m.IsEveryIndexInRange' take an InRangeModel (02-topology/topology-proofs.types.plato:23) and do not re-check
- [ ] Layers 4 to 8 take PreparedModel where they read prepared tolerances, and MeshModel returns the MeshResult sum (08-pipeline/pipeline-decided.library.plato) in place of MeshOutcome { Ok: Boolean }
- [ ] QuadGridOutcome.Grid holds the GridWithinChordal decision of sandbox/step-mesh-staging/v1-types, so no grid reaches a face mesh unchecked
- [ ] The proof types are sealed (TKT-444) to their checkers; laws keep their verdicts, and the re-checks found by perf-samplers and perf-sparse-grids are gone

Review: docs/plans/step-mesher-types-review-2026-10-22.md (TKT-435). Every proof type in the library has zero parameters naming it; 289 Precondition comments stand in. Two performance defects were re-checks a proof parameter removes (IsWellFormed per sample, 26 s in one law; IsEveryIndexInRange per edge, O(E M)), and FINDINGS F-54 is a law over a mesh no constructor made. Depends on TKT-444 (sealed constructors), or the proof is a convention. Waits for the version 1 wave (TKT-323) to close: it edits library files the version 1 tracks read. Then a builder edits the library directly, one layer per commit, running the laws of each layer it touches before and after (python -I sandbox/step-brep-mesh/tools/plato_laws.py, cpu64); verdicts must not change except named fixes.
