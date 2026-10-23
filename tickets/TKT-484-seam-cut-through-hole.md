---
id: TKT-484
title: STEP mesher: a hole that crosses a periodic face's seam is left straddling the chart's cut, so the region is refused as not simple (Witness_CrossHole's band)
status: claimed
depends_on: []
owner: v1-gate
fence: [sandbox/step-brep-mesh/05-face-meshing/**]
workflow: [W3]
related: [TKT-324, TKT-468]
confidence: high
created: 2026-10-22
kind: defect
---

## Acceptance criteria

- [ ] A law over Witness_CrossHole (gallery-witnesses) states that its band, face 2, meshes: no FACE-LOOP-NOT-SIMPLE, and every loop of its region lies inside the chart's domain
- [ ] On a periodic face whose holes avoid some value of the periodic parameter, the seam cut is placed at such a value, so no hole loop crosses it; the 88 corpus files mesh no worse

Found 2026-10-22 by track v1-edges while checking the supervisor's case for E5. Witness_CrossHole is a cylinder band (surface 2) with a hole along x through it; the hole meets the band in two closed B-spline loops, at u near 0 and near pi. The band's oriented region (WitnessOptions) has 3 loops: the outer, the two circles joined along the seam, spanning u in [0, 2 pi]; the -x hole, inside the domain; and the +x hole, whose points run from u below -0.01 to above +0.01, across the cut at u = 0 and outside the domain. CollidingSegments flags segments of the outer loop and of that hole; no pair properly crosses (CrossingSegments, E5b), but hole vertices lie on the outer loop's seam side (a T-touch under E5b's ConflictingSegments). The cause is where the seam is cut, not a weakly simple region: E5's merges and splits cannot repair it, and E5c's SplitAt does not apply (the seam is the face's own cut, not an edge another face shares). A fix places the cut at a u that no hole reaches (here near pi / 2), or unwraps the straddling hole to one side of the cut. Probe laws: the session scratchpad's probe-crosshole folder.
