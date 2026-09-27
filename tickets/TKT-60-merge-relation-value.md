---
id: TKT-60
title: Merge the engine's relation-value branch into ara3d-dataflow main and repin the submodule
status: open
depends_on: []
owner:
fence: [submodules/ara3d-dataflow]
---

## Acceptance criteria

- [ ] The commit the submodule points at is reachable from `ara3d-dataflow` main
- [ ] The `tests/flow` suites pass with the repinned submodule

The submodule is pinned to e029371, which exists only on `origin/relation-value` (`docs/plans/flow-demos/PLAN.md:178`). A force-push or branch cleanup there would leave this repository pointing at an unreachable commit. Raised by reviews/2026-09-27-status.md
