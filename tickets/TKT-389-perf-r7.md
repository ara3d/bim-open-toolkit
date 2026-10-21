---
id: TKT-389
title: STEP mesher complexity chunk R7: CutSegmentCountFast by doubling with each step point evaluated once; MeanSpeedBoth from one sample set; ChartOfBody2
status: done
depends_on: [TKT-357]
owner:
fence: [sandbox/step-mesh-staging/perf-chart/**]
workflow: [W3, W4]
related: [TKT-323, TKT-349, TKT-356]
created: 2026-10-21
closed: 2026-10-21
---

## Acceptance criteria

- [ ] the staged functions of chunk R7 exist in sandbox/step-mesh-staging/perf-chart with their laws passing under cpu64, and every law the chunk's test column names keeps its verdict against sandbox/step-brep-mesh/reviews/verdicts-cpu64.tsv: `Law_RegionLoopClosesInPlane`, `Law_SeamCutCopiesRunOpposite`, `Law_BoxFacesStayTwoTriangles`; count witness (Evals per cut <= c n)
- [x] the chunk's Witness_<Family>Work(_: WorkClaim) builds its family at two sizes and passes Law_WorkIsWithinSlope with the slope the chunk states
- [x] every new or rewritten law runs under 2 s on the compiled backend (the pinned CLI, --backend=csharp --budget=2), and a witness that holds a mesh, discretization or triangulation is a shared Witness_* value, never re-meshed per law case
- [x] merged by the supervisor by wiring (TRACK.md merge instructions), the ledger row written, no regression at merge

Chunk R7 of docs/plans/step-mesher-complexity.md (the STEP mesher complexity sweep, 2026-10-21): ranked candidates 31; expected 1.5 h; depends on W0. Staging rules: sandbox/step-mesh-staging/README.md (new files only, <Name>Body or a renamed replacement, Law_Perf_* until merge). Testing strategy: the plan's section of that name, binding: laws over shared witnesses, one generic operation-count law over WorkClaim, verdict preservation; no wall-time test.

## Notes

- 2026-10-21, builder R7: the staged functions and their laws pass under cpu64 and the three named laws keep their verdicts, but the first box's count criterion (evaluations per cut at most c n) is not met: `CutSegmentCount`'s stopping test is not monotone in n, so only the linear search returns the same n, and its work is quadratic in n (at most 3 evaluations per grid point placed, n (n + 3) / 2 points, against about 7 before). The witness states that slope. Whether a doubling search (about 4 n points, a different but valid n where the test is not monotone) is acceptable is the owner's decision; sandbox/step-mesh-staging/perf-chart/TRACK.md, Findings.

## Closed with criteria unmet

2026-10-21: the cut-count stop rule is not monotone in the segment count, so only the exact linear search keeps the count bit for bit; evaluations per grid point placed fell from about 7 to 3 (2,207 against 14,000 at 64 steps), not to c x n; a doubling search that may return a different valid n is an owner decision
