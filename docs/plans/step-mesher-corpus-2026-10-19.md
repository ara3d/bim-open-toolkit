# STEP mesher corpus run, 2026-10-19

Step H of `docs/plans/step-mesher-v2.md` (epic TKT-323): the 88 u-blox files of the 3D-Step-Models-Library through the
C# STEP mesher and the Plato library compiled to C#, one process per file and 120 s per file. **2 files meshed fully,
7 partly, 72 failed with no geometry, and 7 hung (passed 120 s); 0 exceptions escaped `StepMesher.Mesh`. The run took
1,150 s (19.2 minutes), 843 s of it in the 7 hung files.** The 72 failures have one cause: `PrepareModel` throws on the
first B-spline edge (TKT-348, new). The 9 files that got past `PrepareModel` meshed 7,624 of 7,719 faces (98.8%), and
every mesh whose faces all meshed is closed and consistently oriented.

## What was measured

- **bim-open-data** `a4298c870bdb4b0c93014ed9203fcd0790b30409` (HEAD of `deps/bim-open-data`, 2026-10-19 00:02), exported
  with `git archive` so the C# wiring track's uncommitted regeneration was not measured.
- **Compiled library**: `Ara3D.StepBrep/Generated` at that commit, generated from Plato `acbc9b94` and bim-open-toolkit
  `6aee137d`, layers 00 to 07. It predates the wave 1 merges: genus (`848b66d6`), triangulation (`7d8dae2d`, TKT-343) and
  termination (`91e6b055`, TKT-346). The working tree's regeneration from `91e6b055` (layers 00 to 08) was not built.
- **SDK** from the pinned package feed `deps/ara3d-sdk-packages/98a90590...`; Release, net8.0.
- **Corpus**: `C:\Users\cdigg\git\3d-format-shootout\data\submodules\3D-Step-Models-Library`, 88 files (CEL, POS, SHO).
- **Machine**: the owner's Windows machine, with another session building in the same period, so times are noisy
  (for example NINA-B3x1-B4x1's assembly took 22 s against under 1 s for its neighbours).

## Totals

| Outcome | Files | Faces | Notes |
|---|---|---|---|
| Fully meshed | 2 | 1,312 | SHO/EMMY-W1 (399 faces, 7 meshes, 54 instances), SHO/NINA-B400 (913, 54, 142); all closed and oriented |
| Partly meshed | 7 | 6,312 of 6,407 | all NINA modules; 95 faces unmeshed, 9 of 340 meshes open because of them |
| Failed, no geometry | 72 | 162,385 (before `PrepareModel`) | `Success` true, 0 triangles; every face lost to one exception |
| Hung (over 120 s) | 7 | not reached | 5 in face meshing, 2 in edge discretization |

Parse diagnostics: none in any file. Bounds: the 9 files with geometry span 10.6 to 19.8 mm, matching module sizes, in
millimetre (EMMY-W1) and metre (NINA) files alike; no file has wrong bounds or units. Faces of the 72 failed files by
surface, counted from the raw decoded model: 131,406 PLANE, 14,564 B_SPLINE_SURFACE_WITH_KNOTS, 12,262
CYLINDRICAL_SURFACE, 1,334 SPHERICAL_SURFACE, 1,160 TOROIDAL_SURFACE, 1,016 rational B-spline, 366 CONICAL_SURFACE, 261
SURFACE_OF_LINEAR_EXTRUSION, 16 SURFACE_OF_REVOLUTION.

## Failures by kind

### 1. `PrepareModel` throws on a B-spline edge: the whole file is lost

| Files | Faces | Ticket |
|---|---|---|
| 72 | 162,385 (all of each file's faces; 15,580 are B-spline surfaces) | **TKT-348** (new); the B-spline bodies are TKT-327 |

`NotImplementedException` at `StepReading.Reduced` (the lambda over `m.Edges`): `RunsBackToStart` calls `DecidesClosed`,
which evaluates the curve's ends, and B-spline evaluation (`BSplineCurveData.BSplinePoint`) has no body. A census of the
72 files, each edge's `RunsBackToStart` called alone, found the throw on every B-spline edge: B_SPLINE_CURVE_WITH_KNOTS
38,721 of 38,721 edges (71 files), the rational complex B-spline 1,657 of 1,657 (34 files), and SURFACE_CURVE 21 of
2,131 (SHO/NINA-B222-W1x2). LINE (340,527 edges), CIRCLE (26,120), ELLIPSE (50) and SEAM_CURVE (1) never throw.
Examples: CEL/LARA.STEP edge #109 on curve #93500; CEL/LENA-R8.STEP edge #304815 on curve #301160; CEL/LEXI.STEP edge
#65038 on rational curve #65041. Each of these files fails in under 3.6 s.

TKT-327 will remove the cause, but not the blast radius: the same gap in layers 4 and 5 costs only the faces it touches,
because `StepPlatoMesher.Rows` isolates each edge and face, while `Reduced` is one call the host cannot split. TKT-348
asks for closure to be decided without evaluation (a clamped B-spline's ends are its end control points) or reported as
undecided.

### 2. Plane faces with many boundary edges take minutes

| Files | Faces | Ticket |
|---|---|---|
| 6 (LILY-W131, LILY-W132, ODIN-W160, ODIN-W161, ODIN-W260, ODIN-W262) | 8 named plane faces | **TKT-349** (new) |

A rerun with a 600 s limit and a timer per face (seven files in parallel, so times are inflated): ODIN-W160 finished in
358 s, faces #15368 (1 loop, 80 edges) and #19250 taking 86 s each; ODIN-W161 finished in 378 s, faces #14327 and #16423
taking 88 s each. Still running at 600 s, each on one plane face: LILY-W131 face #2846 (13 loops, 102 edges), LILY-W132
face #2958 (13 loops), ODIN-W260 face #10196 (212 lines), ODIN-W262 face #9213 (212 edges). The nine files that finish
average 3 to 14 ms per face. TKT-346 bounded these loops for termination, not cost, and TKT-343's triangulation was
tested on witnesses with few edges, so neither covers it; TKT-335's whole-arena check per sample is a candidate cause.

### 3. Slow edge discretization

| Files | Edges | Ticket |
|---|---|---|
| 2 (SHO/ELLA-W1, SHO/ODIN-W260) | ELLA-W1 reached edge 1,200 of 20,684 at 120 s; ODIN-W260 edge 4,600 of 5,766 | TKT-346, TKT-335 |

Both pass 120 s in the edge stage (about 90 and 26 ms per edge). In the 600 s rerun both finished their edges, so this is
cost, not a hang. TKT-346's fix replaces the one-segment-at-a-time raise in `RaisedForImages` that made each edge cost
grow with its segment count; it is merged in `91e6b055` but not in the measured library. Recheck after the
regeneration; ELLA-W1 (7,754 faces) also needs TKT-349 or more time to finish.

### 4. Edges that reach unwritten functions in layer 4: faces dropped, file partly meshed

| Files | Edges, faces | Ticket |
|---|---|---|
| 7 (NINA-B111, B112, B221-W1x1, B3x1-B4x1, B3x2, B3x6-B4x6, W1x6) | 114 edges throw; 95 faces unmeshed (60 cylinder, 28 torus, 7 plane), code `PIPELINE-FACE-UNDISCRETIZED` | TKT-325, TKT-327 |

Two sites, identified by curve and surface in NINA-B112 and NINA-B3x2; across the seven files 64 edges threw in `CanonicalImagePoints` and 50 in a frame inlined into the caller (the ellipse edges throw there; the other inlined throws were not traced):

- **Horn torus**: circles shared by a TOROIDAL_SURFACE whose major and minor radii are equal (NINA-B112 #3414: 0.1 mm and
  0.1 mm). `Project` has a closed form only for a full torus with major radius greater than minor, so it falls to the
  bodiless `ProjectBySearch` from `EdgeDiscretizing.CanonicalImagePoints`. 16 edges in each of the two files. Torus is TKT-325;
  `ProjectBySearch` is in TKT-327's body list.
- **Ellipse arc of half a turn or more** on a cylinder: `ClosedFormSagitta` returns -1 for a span of pi or more and
  `Sagitta` falls to the bodiless `SagittaByHullBound`. 1 edge per file (NINA-B112 curve #10186, NINA-B3x2 curve
  #14320). The hull-bound sagitta is in TKT-327's list ("layer 4 Sagitta"); no TKT-327 witness has an ellipse, so recheck
  this edge when it lands.

Examples of dropped faces: NINA-B111 face #1905 (cylinder #3134) and #2031 (torus #3323); NINA-B112 face #2071
(cylinder #3478). The 9 open meshes (NINA-B112 and NINA-B3x2 two each, the others one) are exactly the solids that lost
these faces: 24 or 50 boundary edges each.

### Kinds not found

No exception escaped `StepMesher.Mesh` or crashed a process; no parse diagnostics; no misoriented or non-manifold mesh;
no wrong bounds or units. Spheres and cones were never reached: every file holding them failed at kind 1 first.

## Per-file results

`docs/plans/step-mesher-corpus-2026-10-19.csv`, one row per file: status, process time, faces and faces meshed, edges,
meshes, instances, placements, vertices and triangles (distinct and placed), meshes closed and oriented, boundary edges,
extent in metres, units, cause, and the rerun note for the hung files. For failed files the face and edge counts are
those of the raw decoded model.

## How to rerun

The harness is a throwaway console project, not committed. It calls `StepMesher.Mesh`'s steps in order (`StepModel`,
`StepShapeCollector.AddProducts`, `AddUnreachedShapes`, `AddUnitContexts`, `StepModelBuilder.Build`), with
`StepPlatoMesher.MeshFile` restated so each library exception keeps its stack trace and each edge and face its timing.
It writes one JSON file per STEP file.

1. Export the committed sources beside a copy of the toolkit's `deps.json`, so the build uses the pinned SDK feed and
   leaves `deps/bim-open-data` alone:
   `mkdir -p X/deps/bim-open-data && cp deps.json X/ && cp deps/.deps-root X/deps/ && cp -r deps/ara3d-sdk-packages/<pin> X/deps/ara3d-sdk-packages/ && git -C deps/bim-open-data archive HEAD src/data/Ara3D.Step.Mesher src/data/Ara3D.Step.Entities src/data/Ara3D.Step.Decode src/data/Ara3D.StepBrep src/data/Ara3D.StepTypes src/data/Ara3D.MeshKernel Directory.Build.props Directory.Build.targets nuget.config Platonic.props | tar -x -C X/deps/bim-open-data`
2. Put an exe project under `X/deps/bim-open-data/harness` that references `..\src\data\Ara3D.Step.Mesher`, and build:
   `dotnet build -c Release --artifacts-path X/out -m:1 -v q`.
3. Run each file in its own process with a wall-clock limit, for example `timeout 120 Harness.exe one <file> <out.json>`
   per file, or the harness's `all <corpus> <outdir> 120` mode, which does the same and records the last stage reached.

A committed corpus runner is part of TKT-313's third criterion (the 88-file corpus with zero exceptions and
per-surface-kind counts in the build log); this run's harness is the shape it would take.
