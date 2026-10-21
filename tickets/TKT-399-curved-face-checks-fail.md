---
id: TKT-399
title: STEP mesher: the curved-face check laws fail on the sphere, torus and pinned torus once the budget no longer hides them, and ValidateFaceMesh takes up to 61 s on a built mesh
status: open
depends_on: []
owner:
fence: [sandbox/step-brep-mesh/07-validation/**, sandbox/step-brep-mesh/05-face-meshing/**]
workflow: [W3, W4]
related: [TKT-394, TKT-356, TKT-323]
confidence: medium
created: 2026-10-21
kind: defect
---

## Acceptance criteria

- [ ] the six *FaceChecksHold laws of 07-validation/poles.laws.plato, restated over PoleWitness (chunk L5's staged forms in sandbox/step-mesh-staging/perf-poles-oracles/poles-witness.laws.plato), pass on the sphere, the sphere by pole loops, the torus, the torus pinned at a vertex and both cone faces, or each failing check is named with its measure and filed
- [ ] ValidateFaceMesh on an already built curved face mesh runs under 2 s compiled (today 3.25 s, 4.45 s, 54 s and 61 s on four of the six witnesses)

Found 2026-10-21 by chunk L5 (TKT-394) of docs/plans/step-mesher-complexity.md. The baseline (reviews/verdicts-cpu64.tsv) records the *FaceChecksHold laws as 120 s budget errors (only the cone's lateral face as a fail), so their verdicts were never seen. Restated over a PoleWitness (the curved model meshed once, round zero, no validation) they fail on every curved witness: the cone's base disk passes, its lateral face fails as the baseline says, the two spheres at chordal 0.01, the torus and the pinned torus fail where the baseline showed only budget errors. The builder could not name which checks fail because the runner shrinks a failing case's strings. Four of the laws take 3.25 s to 61 s compiled inside ValidateFaceMesh on meshes already built, so a face-mesh report chunk of the kind V6 did for the mesh report (tables once per report) is needed before the laws can be wired under the 2 s budget. The staged laws stay in the staging folder until then.
