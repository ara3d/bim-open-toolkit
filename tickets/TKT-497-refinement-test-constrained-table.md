---
id: TKT-497
title: STEP mesher: the refinement test asks the O(L) IsConstrained where the O(1) table is at hand
status: open
depends_on: []
owner:
fence: [sandbox/step-brep-mesh/05-face-meshing/refinement-test-cached.*, sandbox/step-brep-mesh/05-face-meshing/triangulation-neighbours-carried.*, sandbox/step-brep-mesh/05-face-meshing/refinement-attainable.library.plato]
workflow: [W3]
related: [TKT-323]
created: 2026-10-22
---

## Acceptance criteria

- [ ] The surface refinement test reads IsConstrainedIn on the region's NextBoundaryTable, built once per round, in place of the O(L) IsConstrained, in SideNormalsTurn, SideNormalsTurnAttainable, IsSampled and SidesExceed
- [ ] The existing agreement laws (Law_NeedsRefinementCachedAgrees, Law_CarriedTableIsNeighbourSlots, the attainable laws) keep their verdicts
- [ ] The corpus digests are unchanged

Finding 10 of docs/plans/step-mesher-algorithmic-performance-2026-10-22.md. The grid check's call in grid-chordal.library.plato:46 belongs to the quad-grid agent (TKT-404's neighbour) and is reported, not changed here.
