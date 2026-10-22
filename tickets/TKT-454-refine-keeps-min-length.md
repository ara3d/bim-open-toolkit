---
id: TKT-454
title: Layer 4's Refine lowers the chordal bound to the requested one but keeps MinLength, so a short arc never splits
status: open
depends_on: []
owner:
fence: [sandbox/step-mesh-staging/v1-proof/**]
workflow: [W3]
related: [TKT-313, TKT-436, TKT-412]
confidence: high
created: 2026-10-22
kind: defect
---

## Acceptance criteria

- [ ] Refine lowers MinLength in proportion when a request lowers the chordal bound of an edge, and keeps it for a zero requested bound
- [ ] a law shows a one-segment arc shorter than twice the old MinLength splits under a smaller requested chordal bound
- [ ] StepPlatoMesher calls layer 8's Step (no C# restatement of it, no C#-only RefineCriteria or Blocking), and the six files of P4 keep their faces meshed, closedness and boundary counts

Found in P4 (bim-open-data b2d6983). RefineIndexedCounted (04-discretization/discretization-refine-indexed.library.plato) refines a requested edge under c.WithChordal(requested), and WithChordal keeps c.MinLength. DefaultCriteria sets MinLength to a tenth of the chordal bound, so at the host's 1 mm bound no segment shorter than 0.2 mm is ever split, whatever chordal bound a face asks for. u-blox CAM face 124: two one-segment arcs asked for 0.0029 mm and Refine returned them unchanged, so the face stayed FACE-LOOP-NOT-SIMPLE through every round. The host works around it by lowering MinLength for Refine only (StepPlatoMesher.RefineCriteria); passing the lowered value through layer 8's Step also hands it to MeshFace, which kept one ANN-MB2 round running over 10 minutes. Staged with TKT-436 in sandbox/step-mesh-staging/v1-proof (chunk P6).
