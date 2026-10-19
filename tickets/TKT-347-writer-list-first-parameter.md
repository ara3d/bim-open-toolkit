---
id: TKT-347
title: Plato C# writer drops a library function whose first parameter is List<T> (SplitAt is missing, so Ara3D.StepBrep does not build)
status: claimed
depends_on: []
owner: session 2b20f2f0
session: 2b20f2f0-4d99-4684-a062-1b2db12618c7
fence: [../plato/writers/**, ../plato/src/Plato.Compiler/**, ../plato/tests/**, ../plato/tracker/**]
workflow: [W3, W4]
related: [TKT-313, TKT-343, TKT-315, TKT-323]
confidence: high
created: 2026-10-19
claimed: 2026-10-19
kind: defect
---

## Acceptance criteria

- [x] a function whose first parameter is List<T> (and Buffer<T>, Plato tracker compiler-416) is emitted as a C# method; a writer test generates one from a fixture and compiles it Evidence: Plato 128cf769, BuilderReceiverEmissionTests (fixture tests/plato-test-codegen/builder-receivers.plato): List and Buffer, concrete and generic, emitted as extension methods on PlatoList / PlatoBuffer, compiled with Roslyn and run; 6 of 6 failed before the fix and pass after.
- [ ] generating sandbox/step-brep-mesh layers 00 to 08 under cpu64 with the fixed CLI builds Ara3D.StepBrep with 0 errors once BodilessStubs.cs is deleted (the CS0121 the writer now makes unnecessary), checked by the C# wiring track
- [x] the fix is pushed and its commit named in this ticket, so the supervisor can pin a CLI from it Evidence: Plato 128cf769 on origin/main.

Found 2026-10-19 by the C# wiring track (TKT-313; log entry bf68a0df): regenerating from the library at 7efe05e3 with CLI 951a70ab gives CS1501 'No overload for method SplitAt takes 7 arguments' at TriangulationRefine.g.cs(116,49) and (205,72). SplitAt(tris: List<TriangleFace>, q, u, a, b, e, d, pi: Integer): List<TriangleFace> is at 05-face-meshing/triangulation-refine.library.plato line 198, merged from TKT-343. The writer is fixed rather than the library worked around, so the next List-first function does not hit it.

## Log

- 2026-10-19: fixed in Plato 128cf769 (CSharpWriter.WriteInterfaceLibraryMethods takes List and Buffer receivers; Plato tracker compiler-416, its first two boxes ticked). Checks: PlatoTests 257 pass, the 4 failures pre-existing and unrelated; the stdlib tiers plus the 107 STEP design files generate and build under cpu64 with 0 errors in the session's scratch harness, SplitAt emitted as `SplitAt(this PlatoList<TriangleFace> tris, ...)`. Waiting on the C# wiring track (TKT-313) to confirm the Ara3D.StepBrep build with BodilessStubs.cs deleted before closing. Durations: writer tests about 1 min per run (three), PlatoTests 2.8 min, whole-library generate and build about 3.5 min.
