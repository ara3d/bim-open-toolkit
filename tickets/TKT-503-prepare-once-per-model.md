---
id: TKT-503
title: STEP mesher prepare: once-cited edges of every shell in one pass, loop chaining and closure decided once
status: open
depends_on: []
owner:
fence: [sandbox/step-brep-mesh/03-step/**, sandbox/step-brep-mesh/08-pipeline/pipeline-prepare-speed.laws.plato, docs/plans/step-mesher-prepare-speed-2026-10-22.md]
workflow: [W3]
related: [TKT-467]
created: 2026-10-22
---

## Acceptance criteria

- [ ] OnceCitedEdgesByShell gives OnceCitedEdges(s) for every shell of every witness model and the three sewing cubes (agreement laws pass), and Sewn, SewnVertexRoots and SewnEdgeRoots read it once per model
- [ ] Sewn agrees with the kept SewnReference (SameRawModel and the same diagnostics) on every raw witness and the three sewing cubes
- [ ] ChainedCoedges runs once per loop and the closure decision once per curve, each with an agreement law against a kept reference
- [ ] Law_PrepareIsIdempotent, the StepReadingLaws reduction laws and the J6 sewing laws keep their verdicts
- [ ] Prepare over the five largest u-blox files is several times faster than a back-to-back baseline, recorded in docs/plans/step-mesher-prepare-speed-2026-10-22.md with the profile

Profile of 2026-10-22 (prepare-profile, scratchpad): Sewn holds 85 to 95% of prepare on every file; inside it, OnceCitedEdges(s) builds an EdgeUseTable with O(E) buffers per shell and is called per shell by SewnVertexRoots, SewnEdgeRoots and WithOpenShellsReported, so Sewn is about 4 S E (ELLA-W1: 429 shells x 20,684 edges, four shares of 0.9 to 1.1 s). The duplicated ChainedCoedges (per loop) and closure decision (per curve) are 2 to 5% each. Finding 1 of step-mesher-algorithmic-performance-2026-10-22.md (Reduced quadratic) was already landed by J3 and J4; the log-log slope of prepare against E over the evening corpus is 0.87.
