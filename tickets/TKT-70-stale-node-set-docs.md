---
id: TKT-70
title: Correct two documents the code no longer matches: core-node-sets Set 4 and CANDIDATE-WORK line 121
status: done
depends_on: []
owner: wave-w3
fence: [docs/proposals/core-node-sets.md, docs/CANDIDATE-WORK.md]
---

## Acceptance criteria

- [x] `docs/proposals/core-node-sets.md:257-269` says `view3d.colormap` is consumed by `view3d.color` through its `scale` input
- [x] `docs/CANDIDATE-WORK.md:121` marks per-instance colour buffers done (`viz/packages/core/src/group-object.ts:120`)

Raised by reviews/2026-09-27-status.md
