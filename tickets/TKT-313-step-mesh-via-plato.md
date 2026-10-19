---
id: TKT-313
title: The STEP mesher meshes each B-rep through the Plato geometry library compiled to C#: StepShapeMesher.MeshItem calls it
status: claimed
depends_on: [TKT-311, TKT-312]
owner: session 10b9c9c6
session: 10b9c9c6-0052-40f3-a1c2-c12f2f8861d7
fence: [deps/bim-open-data/src/data/Ara3D.Step.Mesher/StepShapeMesher.cs, deps/bim-open-data/src/data/Ara3D.Step.Mesher/Ara3D.Step.Mesher.csproj, deps/bim-open-data/src/data/Ara3D.Step.Mesher/StepMesher.cs, deps/bim-open-data/src/data/Ara3D.Step.Mesher/Plato/**, deps/bim-open-data/tests/data/Ara3D.Step.Mesher.Tests/**, deps.json]
workflow: [W3, W4]
related: [TKT-299, TKT-305]
confidence: high
created: 2026-10-17
claimed: 2026-10-18
---

## Acceptance criteria

- [ ] a public AP242 or AP214 sample meshes with every solid closed and the bounds matching the file's units (moved from TKT-305)
- [ ] the compiled Plato library comes from a reproducible build step, documented, not hand-copied C#
- [ ] the 88-file corpus meshes with zero exceptions; per-surface-kind support and failures are in the build log

Plan: docs/plans/step-reader.md, section 'Pivot: geometry in Plato' (owner decision 2026-10-17). Grows chunk by chunk with the Plato library's TASKS.md (cube, cylinder, sphere/torus/cone, B-spline, genus and voids, corpus); this ticket closes when chunk H's corpus criterion holds through the C# entry point StepMesher.Mesh.

## Log

- 2026-10-18, builder 10b9c9c6, chunk 1 (unit cube), bim-open-data f6e45b3. Status: bridge done, wiring blocked on the
  fence. `Ara3D.Step.Mesher/Plato/StepPlatoMesher.MeshFile` meshes a whole file (DecodeRaw, PrepareModel, every edge
  discretized, every face meshed, assembled); per file because DecodeRaw and PrepareModel are (tolerances from the whole
  model's size, mirror folds per occurrence). Layer 08 is not in the committed generation, so its MeshModel is restated
  without the refinement loop and validation. Unit cube: 8 vertices, 12 triangles; the library's IsClosed,
  IsConsistentlyOriented, Euler 2, SignedVolume 1 mm^3 and eleven mesh laws hold from C#; C# agrees on the contract mesh
  (1e-9 m^3, closed, outward). A hand-written cylinder meshes closed; a sphere face is a pending failure. Not done:
  `StepMesher.Mesh` still returns no triangles, because `Model/StepModelBuilder.cs` (outside the fence) calls
  `MeshItem` per item with no way to receive the file's meshes; proposal in the build log. Tests: 30 passed, 1 skipped
  (the two-instance test, which needs the wiring). Durations: builds 3.7 to 16.7 s each (about 14 builds, 110 s), focused
  tests 6 to 24 s each, full test project 15.2 s build and 8.1 s tests, waiting on a hung test 646 s and hang probes
  about 130 s (the substituted-surface finding in the build log).
