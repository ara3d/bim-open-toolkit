---
id: TKT-313
title: The STEP mesher meshes each B-rep through the Plato geometry library compiled to C#: StepShapeMesher.MeshItem calls it
status: claimed
depends_on: [TKT-311, TKT-312]
owner: session 10b9c9c6
session: 10b9c9c6-0052-40f3-a1c2-c12f2f8861d7
fence: [deps/bim-open-data/src/data/Ara3D.StepBrep/**, deps/bim-open-data/tools/regen-step-brep.ps1, deps/bim-open-data/src/data/Ara3D.Step.Mesher/StepShapeMesher.cs, deps/bim-open-data/src/data/Ara3D.Step.Mesher/Ara3D.Step.Mesher.csproj, deps/bim-open-data/src/data/Ara3D.Step.Mesher/StepMesher.cs, deps/bim-open-data/src/data/Ara3D.Step.Mesher/Model/StepModelBuilder.cs, deps/bim-open-data/src/data/Ara3D.Step.Mesher/StepMeshingContract.cs, deps/bim-open-data/src/data/Ara3D.Step.Mesher/Plato/**, deps/bim-open-data/tests/data/Ara3D.Step.Mesher.Tests/**, deps.json]
workflow: [W3, W4]
related: [TKT-299, TKT-305]
confidence: high
created: 2026-10-17
claimed: 2026-10-18
---

## Acceptance criteria

- [x] a public AP242 or AP214 sample meshes with every solid closed and the bounds matching the file's units (moved from TKT-305)
- [x] the compiled Plato library comes from a reproducible build step, documented, not hand-copied C#
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
- 2026-10-18, builder 10b9c9c6, chunk 1 wiring, bim-open-data 3c2315a (pinned in toolkit d6398051). Status:
  `StepMesher.Mesh` meshes through the Plato library. It calls `StepPlatoMesher.MeshFile` once per file (a throw there is
  recorded, and every item counts as pending); `StepModelBuilder` takes the file's meshes; `StepShapeMesher.MeshItem(file,
  model, item, units, diagnostics)` replaces the per-item signature and reads the item's body at its first occurrence by
  STEP instance id; each face is recorded under its surface's entity name (supported, or unsupported with a dropped
  face); `StepShapeMesh.FacesPending` is new, and an item every face of which is pending counts as GeometryPending. The
  two-cubes assembly is two instances of one mesh (`AssemblyModelHasTwoInstancesOfOneMesh` un-ignored, passes); the
  sphere is one pending item with face #18 dropped. Tests: Ara3D.Step.Mesher.Tests 33 passed, 0 skipped. Durations:
  wiring build 4.4 s, focused tests 8.1 s, full test project 7.7 s build and 6.8 s tests, no waiting. Left for the
  coordinator: the mesher README (outside the fence).
  - **C# half of TKT-314 criterion 3.** The unit cube (`fixtures/unit-cube.stp`) as `StepMesher.Mesh` returns it: one
    mesh, one instance, 8 vertices, 12 triangles, no geometry pending, no dropped face, 6 PLANE faces supported; checked
    in C# on the returned mesh: closed and consistently oriented (each directed edge used once and its reverse once),
    Euler characteristic 2, signed volume 1e-9 m^3 (1 mm^3) and positive (outward), bounds 0 to 0.001 m. On the
    library's `ModelMesh` from the same `MeshFile` call path, called from C#: `IsManifold`, `IsClosed`,
    `IsConsistentlyOriented`, `ReferencedEulerCharacteristic` 2, `SignedVolume` 1 mm^3, `Area` 6 mm^2, and the laws
    `Law_ClosedMeansEveryEdgeHasTwoSides` and `Law_ManifoldMeansNoEdgeHasMoreThanTwoSides` (all 18 edges),
    `Law_OrientedExactlyWhenNoEdgeIsMisoriented`, `Law_ClosedOrientedSurfaceHasGenus`,
    `Law_AngleDefectSumIsTwoPiTimesEuler`, `Law_VectorAreaVanishes`, `Law_ComponentEulerCharacteristicsAddUp`,
    `Law_ReversalNegatesSignedVolume`, `Law_TriangleMeshKeepsArea`, `Law_TriangleMeshKeepsPositions` all hold. Generation:
    Ara3D.StepBrep from library 6aee137d, Plato acbc9b94, cpu64. Tests: `Plato/PlatoStepMesherTests`,
    `Plato/PlatoCubeTests`.
- 2026-10-19, builder 10b9c9c6, regeneration with layer 08. Status: blocked, nothing committed. Inputs: library at
  bim-open-toolkit 7efe05e3 (layers 00 to 08 clean; the header named 7d8dae2d, the last commit touching them, no +local),
  compiler `C:/Users/cdigg/.plato-cli/951a70ab/Plato.CLI.dll`, stdlib and runtime from a clone at Plato 951a70ab (header
  Plato 78be1798), cpu64, `08-pipeline` added to the script's layers. Generation succeeded (928 generated and 13 runtime
  files, 328 s). The C# build of Ara3D.StepBrep failed with two kinds of error. (1) Expected:
  `StepSchemaModel.g.cs(37,160)` and `_Integer.g.cs(125,141)` CS0121, `FlatRecord` now emitted by the writer and also in
  the hand-written `BodilessStubs.cs`; removing that file clears both. (2) **First blocking error, in layer 05, not 08:**
  `TriangulationRefine.g.cs(116,49)` and `(205,72)`: CS1501 "No overload for method 'SplitAt' takes 7 arguments". The
  library function `SplitAt(tris: List<TriangleFace>, q, u, a, b, e, d, pi: Integer): List<TriangleFace>`
  (`05-face-meshing/triangulation-refine.library.plato` line 198, merged with TKT-343) has no generated method at all:
  the C# writer emits nothing for a library function whose first parameter is `List<T>`. With `BodilessStubs.cs` removed,
  these two are the only errors; layer 08 (`StepToMesh.g.cs`, which holds `MeshModel`) compiles. Per the rules,
  Ara3D.StepBrep, `BodilessStubs.cs` and the script were restored to bim-open-data 3c2315a, and the restated MeshModel
  lines in `Plato/StepPlatoMesher.cs` stay; steps 3 to 5 (MeshModel call, cube and cylinder numbers, decoder tests) not
  done. Fix belongs to the Plato writer (emit list-receiver functions, or the library takes `Array<T>` there); then
  regenerate with the same inputs and delete `BodilessStubs.cs`. Durations: regeneration 330 s, StepBrep builds 15.7 s and
  11.0 s, restore build 28.0 s, no tests run.
- 2026-10-19, builder 10b9c9c6, regeneration with layer 08, bim-open-data 374f2b4. Status: regenerated and committed;
  the MeshModel switch held back. Inputs: CLI `C:/Users/cdigg/.plato-cli/128cf769/Plato.CLI.dll`, stdlib and runtime from
  a clone at Plato 128cf769, library at toolkit cda4477d (layers 00 to 08 clean, last touched 91e6b055, no +local),
  cpu64. 929 generated and 13 runtime files (47 s); Ara3D.StepBrep 0 errors, 0 warnings once `BodilessStubs.cs` is
  deleted (TKT-347 closed on this). Decoder tests 14 passed, mesher tests 33 passed.
  **MeshModel tried, not committed.** One `MeshModel(DefaultMeshingOptions(chordal))` call in place of the restated lines
  (it adds the refinement loop and validation at Geometric): cube clean (Ok, 0 rounds, 8 vertices, 12 triangles, closed,
  oriented, Euler 2, 1 mm^3, area 6) in 5.1 s; unit cylinder over 10 minutes at full CPU, not finished; sphere throws
  NotImplementedException (`ExpandedPoles`) out of MeshModel, failing the whole file. Cause: the runtime's `MapRange`
  (`Intrinsics/Integer.cs` line 87) returns a lazy list that calls its function on every read, so the loop's face
  outcomes are meshed again at each read (stack: `StepToMesh.InitialState` under `Extensions.RequestsOf`). Needs
  generated lists computed once (writer or runtime), or a decision to accept the cost; the version is kept in the
  session scratchpad (`meshmodel-version/`).
  **Face meshing got slower with the regeneration** (TKT-343 refinement), on the cylinder's side face via `MeshFace`:
  25 points per circle 5.0 to 9.6 s (354 to 360 triangles), 42 points not done in 240 s; the previous generation took
  3.4 s at 72 points (142 triangles). The 0.001 mm cylinder test now uses the 1 mm default.
  - **C# half of TKT-314 criterion 3** (regenerated library, `StepMesher.Mesh`): unit cube one mesh, one instance, 8
    vertices, 12 triangles, no geometry pending, no dropped face, 6 PLANE faces supported; closed and consistently
    oriented (every directed edge once, its reverse once), Euler characteristic 2, volume 1.0000001e-9 m^3 (1 mm^3,
    float storage) and positive. On the library's ModelMesh from the same path: `IsManifold`, `IsClosed`,
    `IsConsistentlyOriented`, `ReferencedEulerCharacteristic` 2, `SignedVolume` 1 mm^3, `Area` 6 mm^2, and
    `Law_ClosedMeansEveryEdgeHasTwoSides`, `Law_ManifoldMeansNoEdgeHasMoreThanTwoSides` (18 edges),
    `Law_OrientedExactlyWhenNoEdgeIsMisoriented`, `Law_ClosedOrientedSurfaceHasGenus`,
    `Law_AngleDefectSumIsTwoPiTimesEuler`, `Law_VectorAreaVanishes`, `Law_ComponentEulerCharacteristicsAddUp`,
    `Law_ReversalNegatesSignedVolume`, `Law_TriangleMeshKeepsArea`, `Law_TriangleMeshKeepsPositions` all hold.
  - Unit cylinder (r = h = 1 mm) through `StepMesher.Mesh` at the default 1 mm chordal bound: 230 vertices, 456
    triangles, closed (every directed edge paired), Euler 2, volume 3.1217e-9 m^3 = 0.9937 of pi r^2 h (3.1416e-9);
    the inscribed 24-gon prism is 3.1058e-9. Maximum deviation: not reported (validation is not run on this path); side
    interior vertices lie on the surface within 5.7e-11 m, and the 24-segment chord sag is 8.6e-6 m (computed here).
  Durations: regeneration 47 s; StepBrep build 9.0 s; MeshModel probes 300 s and 10 min (cylinder, stopped); sphere probe
  3 s; scaling probes 33 s and 248 s; decoder tests 5.0 s build and 5.8 s; mesher full tests 7.1 s build and 21.0 s
  (one aborted full run of 10 min at 0.001 mm, and a per-class run of 93 s that found it); builds slowed to 82 to 184 s
  twice under machine load.
- 2026-10-21, builder 14b9bcc0, chunks E1 and E3. **E1, regeneration**: bim-open-data 5571854 (pinned in toolkit
  26a7ded4), `tools/regen-step-brep.ps1 -PlatoCli C:/Users/cdigg/.plato-cli/e37c032f/Plato.CLI.dll`, header `Plato
  2847ef71 and bim-open-toolkit 8984df4b`, 1,409 generated and 13 runtime files in 200 s, one DEGRADED body
  (`BisectionCached.SagittaByHullBoundGiven`, a throwing stub, TKT-410); Ara3D.Step.Mesher Release 0 warnings; mesher
  tests 33 passed (the two sphere tests now assert that the unit sphere meshes closed and oriented, one supported item);
  decoder tests 14 passed, `CommittedOutputIsCurrent` skipped because another wave had uncommitted edits in
  `sandbox/step-brep-mesh` by then (the regeneration ran on a clean 8984df4b). Second criterion ticked: the library is
  the script's output, header and all. **Host**: TKT-402 (once-per-model tables, 33206f5), TKT-405 (quads, 376273f),
  TKT-403 (parallel rows, 3245cb7), all closed; the harness `tools/step-corpus-harness` (9680e0f) is the corpus runner.
  **E3, corpus**: docs/plans/step-mesher-corpus-2026-10-21.md and its CSV. 14 files fully meshed, all closed and
  oriented (EMMY-W1, an AP214 sample, among them: first criterion ticked, bounds and units as checked in October on the
  same decoder), 73 partly, 0 failed, 1 over 120 s; 168,965 of 191,450 faces (88.3%); per-surface-kind table in the
  report. Third criterion not met: 45,123 edges throw the compiler's stub (TKT-410), 30 faces throw an index out of
  range (TKT-411); also TKT-412 (45 planes not simple), TKT-413 (4 files with misoriented edges), TKT-414 (NINA-B222-W1x2
  over 600 s in edges). Durations: regeneration 200 s; cold Release build 127 s; test runs 104 and 109 s; harness
  builds 27 to 78 s; verification runs about 12 minutes; corpus 1,065 s plus a 600 s rerun of one file.

