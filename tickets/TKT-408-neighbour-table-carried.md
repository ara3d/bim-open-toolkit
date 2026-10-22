---
id: TKT-408
title: STEP mesher refinement: carry the neighbour table across passes instead of rebuilding NeighbourSlots by three merge sorts per pass
status: done
depends_on: []
owner:
fence: [sandbox/step-mesh-staging/perf-neighbours/**]
workflow: [W3]
related: [TKT-323, TKT-383, TKT-355]
created: 2026-10-21
closed: 2026-10-21
---

## Acceptance criteria

- [x] The angle pass and surface pass return the neighbour table they updated and the next pass reads it, with the agreement law (Law_UpdatedNeighboursAreTheTable or its successor) passing under cpu64 on the interpreter and the pinned compiled CLI; its current compiled failure at k = -1 (TKT-355) is resolved or shown to be the witness's, not the table's
- [ ] Run A's harness on ODIN-W160 shows the NeighbourSlots bucket down from 165 ms with identical meshes
- [x] Merged by the supervisor by wiring, ledger row in docs/plans/step-mesher-complexity.md

Idea 32 of the speed-ideas evaluation, the remainder of idea 6: run E measured NeighbourSlots sorted three times per pass at about 180 ns per slot, 165 ms (12%) of ODIN-W160's refinement; run G had named the per-pass rebuild as the largest remaining whole-triangulation work. About 2 to 3 h. Bit-identical. Staging rules: sandbox/step-mesh-staging/README.md.

## Closed with criteria unmet

2026-10-21: The ODIN-W160 harness measurement is the host re-measure after the wave lands (run A's harness is in deps/bim-open-data, outside this fence); the count witness shows the per-refinement slot builds down from 22n to 66n to 3n on the cylinder strip, bit-identical meshes on all 42 witness faces
