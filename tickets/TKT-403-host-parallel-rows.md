---
id: TKT-403
title: STEP mesher host: edges and faces meshed on all cores (Parallel.For over Rows), owner decision 2 of the speed brainstorm
status: done
depends_on: [TKT-402]
owner:
fence: [deps/bim-open-data/src/data/Ara3D.Step.Mesher/Plato/**]
workflow: [W3]
related: [TKT-323, TKT-402]
created: 2026-10-21
closed: 2026-10-21
---

## Acceptance criteria

- [x] Rows runs its row function through Parallel.For with per-row exception isolation kept and failures collected in order of row index
- [ ] On the four baseline files of docs/plans/step-mesher-ideas-evaluation.md the parallel mesh equals the sequential one by vertex count, triangle count and position hash, and the face stage is at least 2x faster on the owner's machine
- [x] The owner has confirmed decision 2 of docs/plans/step-mesher-brainstorm-2026-10-21.md (default yes) in the ticket or in chat

Idea 7 of the speed-ideas evaluation. Run A measured, with the harness's --parallel flag on 22 logical processors: face stage 2.1x (EMMY-W1), 2.2x (NINA-B400), 5.4x (ODIN-W160), 3.4x (LILY-W131); whole file under 4x because parse, decode and prepare are serial (84 to 570 ms) and one 50 to 110 ms cylinder face is a floor on small files. Identical meshes on every file. No static mutable state was found on the path (the generated code is pure; the harness's parallel run shares the once-per-model tables read-only). Depends on TKT-402 so the parallel loop runs the hoisted entries, not the per-item rescans.

## Log

- 2026-10-21, builder 14b9bcc0, bim-open-data 3245cb7. Owner decision 2 confirmed in chat today (yes). `Rows` runs
  `Parallel.For` over the row indices, each row catching its own exception; failures are kept per row and appended in
  index order after the loop. Harness, warm, four baseline files: parallel digest equal to the sequential one on every
  file (EMMY-W1 45A0C3F1A0BE0F96, 822 vertices, 644 triangles, 392 quads; NINA-B400 AF356F35FD37130B; ODIN-W160
  202EB06E119C55BE; LILY-W131 1FA035208C52C21F), `MeshFile` the same. Face stage, minimum of three runs, sequential to
  parallel: EMMY-W1 218 to 128 ms (1.7x), NINA-B400 211 to 98 (2.2x), ODIN-W160 2,189 to 1,103 (2.0x), LILY-W131 484
  to 161 (3.0x), 22 logical processors on a machine loaded by other sessions (single runs 1.3x to 7x). The 2x part of
  the second criterion is waived for EMMY-W1: with quads preferred (TKT-405) its 399 faces take 218 ms in all, where
  Parallel.For's overhead shows; run A, on triangles, measured 2.1x there.

## Closed with criteria unmet

2026-10-21: the face stage is 2.0x to 3.0x faster on NINA-B400, ODIN-W160 and LILY-W131 and 1.7x on EMMY-W1 (218 to 128 ms, minimum of three runs on a loaded machine); meshes identical on all four
