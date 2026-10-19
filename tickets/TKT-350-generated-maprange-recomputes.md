---
id: TKT-350
title: Plato's generated C# recomputes a mapped range on every read (MapRange is lazy), so MeshModel re-meshes every face many times
status: claimed
depends_on: []
owner: session 2b20f2f0
session: 2b20f2f0-4d99-4684-a062-1b2db12618c7
fence: [../plato/src/Plato.Intrinsics/**, ../plato/writers/**, ../plato/tests/**]
workflow: [W3, W4]
related: [TKT-313, TKT-323, TKT-335]
confidence: high
created: 2026-10-19
claimed: 2026-10-19
kind: defect
---

## Acceptance criteria

- [x] a mapped range bound to a name is computed once in generated C#: MapRange is materialised (or memoised) so each element's function runs once, with a writer or intrinsics test that counts the calls Evidence: Plato dcbec43d; ArrayIntrinsicsTests.MapRangeCallsItsFunctionOncePerElement (4 calls for 4 elements read three times), IntegerMapRangeCallsItsFunctionOncePerElement and MapRangeOfANegativeCountIsEmpty failed before and pass after.
- [ ] regenerated Ara3D.StepBrep meshes the unit cylinder through one MeshModel call in under 10 s (over 10 minutes today), with the same mesh as the restated pipeline
- [ ] the change keeps the interpreter and the C# backend agreeing on the stdlib and STEP laws they share

Found 2026-10-19 by the C# wiring track (TKT-313; bim-open-data 374f2b4, CLI 128cf769): MapRange in Plato.Intrinsics (Ara3D.StepBrep/Intrinsics/Integer.cs line 87) returns a lazy list that calls its function on every read, so MeshModel's face outcomes are meshed again each time the refinement loop, assembly and validation read them. Cube 5.1 s, cylinder over 10 minutes. The interpreter's call cache (TKT-332) hides this, which is why laws did not show it.

## Log

- 2026-10-19: fixed in Plato dcbec43d. ArrayIntrinsics.MapRange fills an array once in index order (count <= 0 gives the empty array) and Integer.MapRange delegates to it; nothing in the writer emits a lazy list of its own, so the runtime was the only place. Checks: Plato.Intrinsics.Tests 182 pass cpu64, 180 gpu32; the interpreter's differential against the C# backend on the stdlib's laws passes under both profiles (criterion 3 for the stdlib; the STEP laws are not run through the C# backend here, so their half waits on the C# track); PlatoTests 257 pass, 4 pre-existing failures. Ara3D.StepBrep keeps its own copy of the runtime (Intrinsics/Integer.cs), so the C# track must refresh ArrayIntrinsics.cs and Integer.cs from Plato, not only regenerate. Found in passing: with the library at its current state (120 design files, the B-spline track merged), the whole-library build has 4 new CS0023 errors in BsplineInverse.g.cs and BsplineOracles.g.cs, a lambda written as the receiver of an extension call ('((t) => ...).MinimizeOverDomain(...)'), which needs a delegate cast or a static call; a writer defect separate from this ticket. Durations: runtime tests about 1 min per profile, differential 1.9 min, PlatoTests 4 min, whole-library generate and build 6.5 min (run beside PlatoTests).
