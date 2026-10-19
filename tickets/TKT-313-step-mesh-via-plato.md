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
