---
id: TKT-55
title: NRC performance budgets: measure, set budgets, fix what misses, and gate it
status: claimed
depends_on: [TKT-48, TKT-52]
owner: parallel-wave-builder-perf
fence: [scripts/profile-nrc-performance.mjs, docs/nrc-performance.md, artifacts/nrc-perf/**, scripts/nrc-perf/**]
---

## Acceptance criteria

- [ ] One script measures cold and warm IFC-to-BOS conversion, DuckDB build, warm evaluation of every nrc-* graph, first frame in the 3D pane, and host memory, for duplex.ifc and IFC-Test-Kit/large_test_model.ifc (49 MB), into docs/nrc-performance.md
- [ ] Budgets set from the first measurement (starting points: nrc-* graphs under 500 ms warm, Duplex coloured under 2 s warm, large model warm open under 5 s); every miss is fixed or has a ticket naming the cause
- [ ] A local gate reruns the measurement and fails when a number exceeds its budget by more than 25 percent

P8 of Proposal: docs/proposals/nrc-deliverables.md, added at the owner's request. The fence covers measurement; fixes get their own fences once the numbers name the cause. Measures after TKT-48 and TKT-52 land so parallel builds do not distort timings.

## Staging, 2026-09-27

Claimed by hand at the owner's request before TKT-48 lands (ticket.py refuses on the dependency): stage 1 writes and smoke-tests the measurement script only. The baseline table and the budgets wait until no other builder is compiling, so the numbers are not distorted.
