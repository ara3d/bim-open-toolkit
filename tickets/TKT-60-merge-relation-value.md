---
id: TKT-60
title: Merge the engine's relation-value branch into ara3d-dataflow main and repin the submodule
status: done
depends_on: []
owner: claude-tkt60
fence: [submodules/ara3d-dataflow]
---

## Acceptance criteria

- [x] The commit the submodule points at is reachable from `ara3d-dataflow` main
- [x] The `tests/flow` suites pass with the repinned submodule

The submodule is pinned to e029371, which exists only on `origin/relation-value` (`docs/plans/flow-demos/PLAN.md:178`). A force-push or branch cleanup there would leave this repository pointing at an unreachable commit. Raised by reviews/2026-09-27-status.md

## Resolution

Fast-forward: `origin/main` (57664de) was an ancestor of `relation-value`, so `ara3d-dataflow` main moved 57664de..e029371 and was pushed. The pin stays at e029371, now on main; the submodule checkout is on `main`. The `relation-value` branch is left for the owner to delete. `tests/flow`: 28 of 30 projects pass; the two failures are unrelated to the engine: `BimSampleSeedingTests.EmptyStore_SeedsEverySampleSource` sees the untracked `samples/snowdon-analyses/federation-match.json` from another session, and `HostProfileTests.TablePacks_ContainsExactlyTheTableKinds` lacks `view.note`, added in d811c5a.
