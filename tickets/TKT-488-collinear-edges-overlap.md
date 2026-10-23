---
id: TKT-488
title: STEP mesher: two edges of one face that run along each other (a zero-width notch) are not reported, so ELLA-W1's 210 gap edges count against the mesher
status: open
depends_on: []
owner:
fence: [sandbox/step-brep-mesh/03-step/**, sandbox/step-brep-mesh/05-face-meshing/**, deps/bim-open-data/tools/step-corpus-harness/**]
workflow: [W3]
related: [TKT-468]
confidence: high
created: 2026-10-22
kind: defect
---

## Acceptance criteria

- [ ] PrepareModel reports two edges of one loop that overlap along one line within the model's tolerance with a located warning, StepDiagnosticCode.EdgesOverlap (STEP-EDGES-OVERLAP, AboutInstance, Measure the other edge's index); a law states it on a synthetic zero-width notch and on ELLA-W1 face 305 (one per tooth, 30)
- [ ] The corpus harness's boundary check counts a boundary edge that lies on an edge so reported as the file's overlap, not as GapBetweenMeshedFaces or InsideFace; ELLA-W1's 210 gap and 30 inside-face edges move there
- [ ] A split point (E5c) that lands within the merge distance of a model vertex is that vertex in the assembled mesh, so ELLA-W1 305's 30 inside-face edges close; or the ticket says why not

Found 2026-10-23 by track v1-edges while checking E5c (SplitAt) on ELLA-W1 (supervisor's condition before merging E5c). Each of the 30 comb teeth of faces 304 and 305 is a zero-width notch: on face 305, edge 31 runs from vertex 22 down to the notch tip (vertex 20) through vertex 18's position, and edge 20-18 runs straight back up along the end of edge 31 (two model edges of the face on one line). E5c splits edge 31 at vertex 18, the faces mesh (272 triangles each), and the file's boundary falls from 608 edges beside the unmeshed faces to 240: 210 gap edges, because the notch's sides run both ways and get no triangle, leaving the neighbouring faces about 7 mesh edges per tooth without a partner; and 30 inside-face edges, because at the notch's mouth one triangle spans the sector and carries vertex 18 where its side along edge 31 needs the split point (two distinct mesh vertices, OnEdge(31) and OnVertex(18), at one place). The B-rep is at fault: closing the notch's sides would need three faces on one edge. Probe: probe8 in the session scratchpad (the host's loop, then face meshes' boundary edges by provenance). Tell v1-proof the diagnostic's name (supervisor, 2026-10-23).
