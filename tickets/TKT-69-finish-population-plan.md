---
id: TKT-69
title: Finish PLAN.md: the CI BOS conversion job, the nrc-ifc-llm link, and removing the moved projects from studio
status: open
depends_on: []
owner:
fence: [.github/workflows/**, PLAN.md]
workflow: [process]
---

## Acceptance criteria

- [ ] `.github/workflows/build.yml` converts `duplex.ifc` to BOS (Phase 3)
- [ ] The `nrc-ifc-llm` README points at this repository (Phase 5)
- [ ] `studio/ara3d-sdk/wip/Ara3D.Ifc.Mesher`, `studio/ara3d-sdk/wip/platoflow-poc`, and `studio/labs/platoflow` are removed from `studio`, or kept with a reason (Phase 7)
- [ ] `PLAN.md` gets a Status line

`PLAN.md` (last changed 2026-08-30) finished Phases 0 to 4 and 6; these three items have no ticket. Phases 5 and 7 change other repositories. Raised by reviews/2026-09-27-status.md
