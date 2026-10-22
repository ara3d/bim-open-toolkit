---
id: TKT-407
title: STEP mesher refinement: allocation-free inside test (IsStrictlyInsideOnGrid loops over the grid's Starts and Items, parity first, clear-of-boundary only for inside points)
status: open
depends_on: []
owner:
fence: [sandbox/step-mesh-staging/perf-inside/**]
workflow: [W3]
related: [TKT-323, TKT-385, TKT-355]
created: 2026-10-21
---

## Acceptance criteria

- [x] A staged IsStrictlyInsideOnGridBody2 (or renamed replacement) gives the same verdict as IsStrictlyInsideOnGrid on every witness face and every generated point, as a law passing under cpu64 on the interpreter and the pinned compiled CLI
- [ ] An operation-count law over WorkClaim shows no array allocation per query (no ItemsNear materialisation), and run A's harness on ODIN-W160 shows refinement's clear-of-boundary bucket down from 313 ms with identical meshes
- [ ] Merged by the supervisor by wiring, ledger row in docs/plans/step-mesher-complexity.md

Idea 31 of the speed-ideas evaluation (docs/plans/step-mesher-ideas-evaluation.md), found by run E: on ODIN-W160 the clear-of-boundary part of the inside test, ItemsNear(u, u).All(DistanceToSegment), is 313 ms (23% of refinement) and allocates 1 GB; the row scan, wide segments and parity are 88 ms. Looping over g.Starts and g.Items directly as the row scan does, parity first, then the clear test only for inside points, keeps the verdict and removes the allocation: inferred 250 to 290 ms of ODIN's refinement, about 10% of the file. About 1 h plus the agreement law. Staging rules: sandbox/step-mesh-staging/README.md.
