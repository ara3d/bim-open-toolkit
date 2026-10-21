---
id: TKT-403
title: STEP mesher host: edges and faces meshed on all cores (Parallel.For over Rows), owner decision 2 of the speed brainstorm
status: open
depends_on: [TKT-402]
owner:
fence: [deps/bim-open-data/src/data/Ara3D.Step.Mesher/Plato/**]
workflow: [W3]
related: [TKT-323, TKT-402]
created: 2026-10-21
---

## Acceptance criteria

- [ ] Rows runs its row function through Parallel.For with per-row exception isolation kept and failures collected in order of row index
- [ ] On the four baseline files of docs/plans/step-mesher-ideas-evaluation.md the parallel mesh equals the sequential one by vertex count, triangle count and position hash, and the face stage is at least 2x faster on the owner's machine
- [ ] The owner has confirmed decision 2 of docs/plans/step-mesher-brainstorm-2026-10-21.md (default yes) in the ticket or in chat

Idea 7 of the speed-ideas evaluation. Run A measured, with the harness's --parallel flag on 22 logical processors: face stage 2.1x (EMMY-W1), 2.2x (NINA-B400), 5.4x (ODIN-W160), 3.4x (LILY-W131); whole file under 4x because parse, decode and prepare are serial (84 to 570 ms) and one 50 to 110 ms cylinder face is a floor on small files. Identical meshes on every file. No static mutable state was found on the path (the generated code is pure; the harness's parallel run shares the once-per-model tables read-only). Depends on TKT-402 so the parallel loop runs the hoisted entries, not the per-item rescans.
