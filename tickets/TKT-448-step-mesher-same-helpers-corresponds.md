---
id: TKT-448
title: STEP mesher: replace the 32 hand-written Same* array helpers with Corresponds, and every Count == Count && guard with a conditional
status: open
depends_on: []
owner:
fence: [sandbox/step-brep-mesh/00-foundation/**, sandbox/step-brep-mesh/01-geometry/**, sandbox/step-brep-mesh/02-topology/**, sandbox/step-brep-mesh/03-step/**, sandbox/step-brep-mesh/04-discretization/**, sandbox/step-brep-mesh/05-face-meshing/**, sandbox/step-brep-mesh/06-mesh/**, sandbox/step-brep-mesh/07-validation/**, sandbox/step-brep-mesh/08-pipeline/**, sandbox/step-brep-mesh/10-editing/**, sandbox/step-brep-mesh/11-repair/**, sandbox/step-brep-mesh/reviews/verdicts-cpu64.tsv]
workflow: [W3]
related: [TKT-435]
confidence: high
created: 2026-10-22
---

## Acceptance criteria

- [ ] grep -rnE '^\s+Same\w+\(\w+: Array<' over sandbox/step-brep-mesh finds no helper whose body is a count test and an elementwise fold: each is a call to Corresponds (00-foundation/foundation.library.plato:837) or is deleted with its callers moved
- [ ] No expression of the form X.Count == Y.Count && ... Y[...] remains in sandbox/step-brep-mesh; each is cond ? ... : false
- [ ] Every law that used a replaced helper keeps its verdict, except laws that errored on unequal lengths, which now pass or fail; the commit lists them

Review: docs/plans/step-mesher-types-review-2026-10-22.md (TKT-435). 32 helpers (SameUvPoints, SamePositions, SameNormals, ...) duplicate the generic, guarded Corresponds(xs, ys, same), which already has 87 uses. At least 9 guard with && (05-face-meshing/face-meshing-lift.laws.plato:116, 07-validation/validation-oracles-once.laws.plato:65, 08-pipeline/bspline-pipeline-run.laws.plato:78), so a longer first array throws and the law reports an error where it should fail (found by v1-gate and perf-angle). If TKT-442 (short-circuit &&) lands first, the guard half is moot; the helper half stays. Waits for the version 1 wave (TKT-323) to close: it edits library files the version 1 tracks read. Then a builder edits the library directly, one layer per commit, running the laws of each layer it touches before and after (python -I sandbox/step-brep-mesh/tools/plato_laws.py, cpu64); verdicts must not change except named fixes.
