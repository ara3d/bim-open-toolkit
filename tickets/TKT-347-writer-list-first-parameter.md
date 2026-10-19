---
id: TKT-347
title: Plato C# writer drops a library function whose first parameter is List<T> (SplitAt is missing, so Ara3D.StepBrep does not build)
status: open
depends_on: []
owner:
fence: [../plato/writers/**, ../plato/src/Plato.Compiler/**, ../plato/tests/**, ../plato/tracker/**]
workflow: [W3, W4]
related: [TKT-313, TKT-343, TKT-315, TKT-323]
confidence: high
created: 2026-10-19
kind: defect
---

## Acceptance criteria

- [ ] a function whose first parameter is List<T> (and Buffer<T>, Plato tracker compiler-416) is emitted as a C# method; a writer test generates one from a fixture and compiles it
- [ ] generating sandbox/step-brep-mesh layers 00 to 08 under cpu64 with the fixed CLI builds Ara3D.StepBrep with 0 errors once BodilessStubs.cs is deleted (the CS0121 the writer now makes unnecessary), checked by the C# wiring track
- [ ] the fix is pushed and its commit named in this ticket, so the supervisor can pin a CLI from it

Found 2026-10-19 by the C# wiring track (TKT-313; log entry bf68a0df): regenerating from the library at 7efe05e3 with CLI 951a70ab gives CS1501 'No overload for method SplitAt takes 7 arguments' at TriangulationRefine.g.cs(116,49) and (205,72). SplitAt(tris: List<TriangleFace>, q, u, a, b, e, d, pi: Integer): List<TriangleFace> is at 05-face-meshing/triangulation-refine.library.plato line 198, merged from TKT-343. The writer is fixed rather than the library worked around, so the next List-first function does not hit it.
