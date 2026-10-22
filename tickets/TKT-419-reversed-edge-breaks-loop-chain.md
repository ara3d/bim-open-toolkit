---
id: TKT-419
title: STEP mesher: an edge whose two vertices are written against its loop's vertex chain turns a 9.6 degree arc into a 350 degree one, and 27 MAYA plane faces cross themselves
status: claimed
depends_on: []
owner: session 53a578f9
session: 53a578f9-98e0-45c4-bc66-a8c1cacb3bae
fence: [sandbox/step-brep-mesh/03-step/**, sandbox/step-brep-mesh/11-repair/**]
workflow: [W3]
related: [TKT-412, TKT-413]
created: 2026-10-22
claimed: 2026-10-22
kind: defect
---

## Acceptance criteria

- [ ] A law over a witness cut from SHO/MAYA-W260_REVC.step loop #39396 (12 edges, edge #39442 the arc) states that the prepared model's loop joins end to start and that the arc spans the short way (about 9.6 degrees), and fails on the current library
- [ ] Decoding or repair reads an edge whose vertices run against both neighbours in its loop the other way, records the repair, and the 27 twelve-edge plane faces of the three MAYA files mesh (none reported FACE-NOT-SIMPLE)
- [ ] A loop whose chain is broken in a way one reversal does not mend keeps a located diagnostic

Found 2026-10-22 by the v1-gate track (TKT-412, sandbox/step-mesh-staging/v1-gate/TRACK.md). In SHO/MAYA-W260_REVC.step, EDGE_LOOP #39396 lists ORIENTED_EDGE #39441 forward over EDGE_CURVE #39442 (a CIRCLE of radius 0.15 about +Z, start #39443 at (7.47, 2.3971, 0.16), end #39435 at (7.445, 2.395, 0.16), sense true). The previous edge of the loop ends at #39442's end vertex and the next one starts at its start vertex, so the chain joins only if the edge is read backward. Read as written the arc runs counter-clockwise from its start, which the circle's reference direction puts at angle 0, to its end at -9.6 degrees: 350.4 degrees. Layer 5 then receives a loop that runs almost a whole circle through three of its own vertices (2213, 2214, 2218 in the prepared model lie within 2e-9 of that circle), and the collision test reports it correctly as not simple. With the edge's vertices the other way round the chain joins and the arc is the 9.6 degree corner the loop's lines imply.\n\nA script over the eight TKT-412 files (vertex ids compared end to start) finds 9 broken twelve-edge loops in each of the three MAYA REVC files, mended by reversing one or two edges: the 27 twelve-edge faces of TKT-412. ODIN-W260, LENA-R8 and ANNA-B4 have no broken chain, so their not-simple faces have another cause. ANN-MB2 and CAM show many id breaks, which probably come from separate vertex entities at one point, not from this defect. The non-manifold and misoriented edges of TKT-413 are in the same three files plus M2-MAYA-W271, so the same defect may cause them.

Note 2026-10-22: the polystrata spike (sandbox/step-mesh-staging/polystrata-spike/REPORT.md, not committed) reads the same face in the prepared model as a full circle at vertex 2218 that overlaps the polygon. It finds the same self-overlap in all 32 faces of the three MAYA families, at any chordal bound, including circles written twice in the 54-edge and two-loop faces. Whether a repair should read the circle as a boss or as a hole needs the cylinder faces adjacent to edge #39442.
