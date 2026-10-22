# STEP mesher corpus run, 2026-10-21

Chunk D2 of TKT-348 and chunk E3 of TKT-313 (epic TKT-323): the 88 u-blox files of the 3D-Step-Models-Library through
the C# STEP mesher's Plato path (`StepPlatoMesher.MeshFile`) and the library compiled to C# at bim-open-toolkit
8984df4b, one process per file and 120 s per file, the way the run of 2026-10-19 was made
(`docs/plans/step-mesher-corpus-2026-10-19.md`). **14 files meshed fully, 73 partly, 0 failed with no geometry, 1
passed 120 s; 0 files fail in `PrepareModel` (72 did in October); 0 exceptions escaped the harness.** 168,965 of the
191,450 faces of the 87 finished files meshed (88.3%; October: 7,624 of the 7,719 faces that got past `PrepareModel`,
with 162,385 faces never reached). Every one of the 14 fully meshed files is closed and consistently oriented; 83 of
the 87 finished files have no misoriented edge. The run took 1,065 s of process time (17.8 minutes) against 1,141 s in
October, but each file was meshed twice (warm-up, see Methods): the warm meshing itself is 384 s over the 87 files,
median 3.0 s per file, slowest 22.8 s.

The 22,485 unmeshed faces have four causes, three of them new: a function the Plato compiler emits as a throwing stub
(`SagittaByHullBoundGiven`, 22,410 faces, TKT-410); 30 three-edge sphere, cone and cylinder faces that throw an index
out of range (TKT-411); 45 plane faces reported not simple (TKT-412); and the four MAYA files whose assembled meshes
hold 2 to 4 non-manifold and 4 misoriented edges (TKT-413). The one file over 120 s stops in edge discretization
(TKT-414).

## What was measured

- **bim-open-data** `3245cb7` for the host (`StepPlatoMesher` with TKT-402's once-per-model tables, TKT-405's quads
  and TKT-403's parallel rows) and `9680e0f` for the harness, built from the working tree into the session's artifacts
  path (`artifacts/builders/14b9bcc0`); the other sessions' uncommitted edits in `deps/bim-open-data` touch the IFC
  mesher and the MCP server, nothing the STEP mesher references.
- **Compiled library**: `Ara3D.StepBrep` at bim-open-data `5571854`, generated from Plato `2847ef71` (CLI `e37c032f`) and
  bim-open-toolkit `8984df4b`, layers 00 to 08, cpu64: the complexity sweep and TKT-348's chunk D1 (closure decided
  from the record). The compiler reported one DEGRADED body, `BisectionCached.SagittaByHullBoundGiven`, emitted as a
  throwing stub.
- **SDK** from the pinned package feed `deps/ara3d-sdk-packages/98a90590...`; Release, net8.0, .NET 8 server GC.
- **Corpus**: `C:\Users\cdigg\git\3d-format-shootout\data\submodules\3D-Step-Models-Library`, 88 files (CEL, POS, SHO).
- **Machine**: the owner's Windows machine, 22 logical processors, with other sessions building during the run, so
  times are noisy; the same day the four baseline files of `docs/plans/step-mesher-ideas-evaluation.md` ran about 2x
  slower than during run A on every path.
- **Harness**: `deps/bim-open-data/tools/step-corpus-harness`, `all <corpus> <outdir> 120 --path host --parallel
  --warmup`: each file in its own process, meshed once untimed and once timed (so a file's process time is about twice
  its meshing time, and the 120 s limit covers both), edges and faces on every core as `MeshFile` runs them, every
  edge and face timed, the assembled mesh digested and checked (boundary, non-manifold and misoriented edges).

## Totals

| Outcome | Files | Faces | Notes |
|---|---|---|---|
| Fully meshed | 14 | 22,094 | EMMY-W1, LILY-W131, LILY-W132, NINA-B111, B112, B221-W1x1, B3x1-B4x1, B3x2, B3x6-B4x6, B400, W1x6, ODIN-W160, W161, W262; all 14 closed and consistently oriented |
| Partly meshed | 73 | 146,871 of 169,356 | median 91.3% of a file's faces; ELLA-W1 0 of 7,754 (every edge a surface curve, TKT-410); 71 are the files with B-spline edges |
| Failed, no geometry | 0 | 0 | October: 72 (`PrepareModel`, TKT-348) |
| Over 120 s | 1 | not reached | NINA-B222-W1x2, edge 2,100 of 2,132 at 120 s (TKT-414); October's 7 all finish now |

October's seven hung files: ODIN-W160 3.0 s warm (358 s at 600 s in October), ODIN-W161 2.8 s, ODIN-W262 3.2 s,
LILY-W131 0.3 s, LILY-W132 0.5 s, all five fully meshed and closed; ODIN-W260 5.9 s, 2,710 of 2,714 faces (4 planes
not simple, TKT-412); ELLA-W1 13.9 s with no face meshed (TKT-410). October's seven partly meshed NINA files are all
fully meshed and closed now (the horn-torus and ellipse edges of TKT-325 and TKT-327 discretize). October's two fully
meshed files: EMMY-W1 0.32 s warm against 10.6 s, NINA-B400 0.72 s against 7.4 s.

Elements over the 87 finished files: 553,133 vertices, 533,270 triangles and 181,867 quads (quads since TKT-405; the
contract's `ToTriangleMesh3D` splits them, so the triangle count a consumer sees is 897,004). Parse diagnostics: not
recorded by the harness (none in any file in October, same parser). Bounds and units: not measured by this harness,
which stops at the library's assembled mesh in model millimetres; October checked them on the 9 files with geometry.

Warm time by stage over the 87 files: parse 6.0 s, decode 50.0 s, prepare 86.9 s, edges 132.5 s, faces 100.5 s,
assembly 6.0 s (tables under 0.1 s per file). Prepare is the largest serial stage now: 9.9 s on ELLA-W1, 9.6 s on
RCB-F9T, 8.6 s on JODY-W3. The slowest files: RCB-F9T(AP214) 22.8 s (8,475 faces), JODY-W3 20.8 s (5,191),
c211_case_with_odin_v1 15.0 s (12.9 s in 539 faces' edges), THEO-P173 14.4 s, ELLA-W1 13.9 s.

## Per surface kind

Faces of the 87 finished files by the surface the decoder gave them. "Unmeshed, edge stubbed" is `PIPELINE-FACE-UNDISCRETIZED`: an edge of the face threw the compiler's stub (TKT-410). "Threw" is the host's `HOST-LIBRARY-THREW` on the face itself. No face is pending on a bodiless library function: every `NotImplementedException` of the run is the one stub.

| Surface | Faces | Meshed | Unmeshed, edge stubbed | Threw | Not simple | Share meshed |
|---|---|---|---|---|---|---|
| plane | 159,066 | 147,731 | 11,290 | 0 | 45 | 92.9% |
| B-spline (both kinds) | 15,580 | 6,530 | 9,050 | 0 | 0 | 41.9% |
| cylinder | 13,595 | 11,972 | 1,618 | 5 | 0 | 88.1% |
| sphere | 1,347 | 1,312 | 17 | 18 | 0 | 97.4% |
| torus | 1,218 | 1,127 | 91 | 0 | 0 | 92.5% |
| cone | 367 | 248 | 112 | 7 | 0 | 67.6% |
| surface of linear extrusion | 261 | 29 | 232 | 0 | 0 | 11.1% |
| surface of revolution | 16 | 16 | 0 | 0 | 0 | 100% |
| **all** | **191,450** | **168,965** | **22,410** | **30** | **45** | **88.3%** |

B-spline faces reach meshing for the first time: 6,530 meshed, and the 9,050 unmeshed ones are lost to their edges,
not to the surface. Edges by curve kind: line 385,171, all discretized; circle 29,173, all; ellipse 100, all;
B-spline 40,378, of which 15,915 discretized, 24,439 threw the stub and 24 came back undiscretized; surface curve
(`SURFACE_CURVE`, ELLA-W1 only) 20,684, all threw the stub.

## Failures by kind

### 1. The compiler's throwing stub for `SagittaByHullBoundGiven`: B-spline and surface-curve edges throw, their faces go unmeshed

| Files | Edges, faces | Ticket |
|---|---|---|
| 72 (71 with B-spline edges, and ELLA-W1) | 45,123 edges throw; 22,410 faces unmeshed (11,290 plane, 9,050 B-spline, 1,618 cylinder, 232 extrusion, 112 cone, 91 torus, 17 sphere) | **TKT-410** (new) |

`NotImplementedException: plato: no ground TIR for moved member BisectionCached.SagittaByHullBoundGiven [recv
BrepModel] (not monomorphized)`: the regeneration's one DEGRADED body (run A noted it as "not reached by any file"; the
corpus reaches it on every edge whose sagitta falls to the hull bound). 24,439 of the 40,378 B-spline edges throw
(CEL/LARA.STEP 566 of 1,100, CEL/LENA-R8.STEP 488 of 562; two files lose every B-spline edge, none loses none) and all
20,684 surface-curve edges of SHO/ELLA-W1.STEP (each on plane+plane), which leaves that file with no face meshed. The
host isolates each edge (`StepPlatoFailure`, kind edge), so the files keep every face whose edges all discretize:
this kind is the whole difference between 88.3% and about 100% of faces. Fix on the Plato side (monomorphize the moved
member) or in the library (call the bound through a form the compiler grounds); TKT-410 names both.

### 2. Three-edge sphere, cone and cylinder faces throw an index out of range

| Files | Faces | Ticket |
|---|---|---|
| 7 (LENA-R8, MPCI, M2-ZED-F9T-25B-00, MAYA-W160, MAYA-W260_REVC, NORA-B100, NORA-B120) | 30: 18 sphere, 7 cone, 5 cylinder | **TKT-411** (new) |

`ArgumentOutOfRangeException: Index was out of range (Parameter 'index')` out of layer 5. Every sphere and cone case
is one loop of three edges (CEL/LENA-R8.STEP faces 202 to 204; POS/M2-ZED-F9T-25B-00.STEP face 753; SHO/MAYA-W160.step
faces 3337 and 3638); the cylinder cases are SHO/MAYA-W260_REVC.step faces 1566, 1577 and 1588 (8, 8 and 6 edges).
Spheres and cones were never reached in October.

### 3. Plane faces reported not simple

| Files | Faces | Ticket |
|---|---|---|
| 8 (LENA-R8, ANN-MB2, CAM, ANNA-B4, MAYA-W260_REVC, MAYA-W261_W271_REVC, MAYA-W266_W276_REVC, ODIN-W260) | 45 planes, most with one loop of 12 edges (27) or 6 (7); 3 with 54, and single faces down to 2 edges | **TKT-412** (new) |

`FACE-NOT-SIMPLE`, layer 5's colliding-segments test on the UV region: an unmeshed outcome, not an exception, and a
hole in the solid. Whether the 12-edge family in the three MAYA files is self-intersecting in the file or a false
collision from the region tolerance is the ticket's first question. ODIN-W260, hung in October on a 212-line plane
(TKT-349), finishes in 5.9 s and loses only these 4 faces.

### 4. Non-manifold and misoriented edges in the four MAYA meshes

| Files | Edges | Ticket |
|---|---|---|
| 4 (M2-MAYA-W271; MAYA-W260_REVC, W261_W271_REVC, W266_W276_REVC) | 2 to 4 non-manifold and 4 misoriented per file; 0 in the other 83 finished files | **TKT-413** (new) |

Found by the harness's `MeshCheck` over the assembled mesh (every directed edge counted). Boundary edges are expected
wherever faces are unmeshed and are not counted as a defect; these four files are the only ones whose meshed faces
disagree on an edge. Not traced to a face yet.

### 5. One file over 120 s in edge discretization

| Files | Ticket |
|---|---|
| SHO/NINA-B222-W1x2.STEP: edge 2,100 of 2,132 at 120 s | **TKT-414** (new) |

Rerun alone with a 600 s limit and no warm-up, the file was killed again with nothing written: at least one of the 32
outstanding edges (rows run on every core, so they are not the last 32 by index) takes over 8 minutes or does not
terminate. The file holds the corpus's 21 surface-curve edges outside ELLA-W1 (October's census), whose stub throw
(kind 1) returns in 0.4 ms, so the hang is in an edge that gets past that point. In October the file failed in
`PrepareModel` with the other B-spline files, so this is the first time its edges were reached.

### Kinds not found

No file fails in `PrepareModel` (TKT-348's third criterion holds); no exception escaped the harness or crashed a
process; no face or edge reached a bodiless library function (October's kind 4, the horn torus and the long ellipse
arc, is gone: all seven NINA files mesh fully); October's six slow plane faces (TKT-349) are the slowest faces of their files still, at 0.8 to 1.5 s
each in this run's per-face times (which are taken while 22 rows share the cores; run A timed ODIN-W160's 80-edge
planes at 76 to 80 ms sequentially), against 86 s to over 8 minutes in October, and their files finish in 0.3 to 5.9 s. The 14 fully meshed files are all closed and
oriented.

## Per-file results

`docs/plans/step-mesher-corpus-2026-10-21.csv`, one row per file: status and outcome (full, partial, timeout),
process time (two meshings) and warm time by stage, faces and faces meshed, faces that threw, edges and edges that
threw, the assembled mesh's vertices, triangles and quads and its digest, closed and oriented with the boundary,
non-manifold and misoriented edge counts, the last stage reached, and October's status, time and faces meshed beside
them. October's mesh, instance, placement, extent and unit columns are not in this file: the harness measures the
library path up to the assembled mesh, not `StepMesher.Mesh`'s contract assembly.

## How to rerun

The harness is committed (`deps/bim-open-data/tools/step-corpus-harness`, README there). With the toolkit's
`deps/bim-open-data` at the host commit above:

1. `dotnet build deps/bim-open-data/tools/step-corpus-harness -c Release --artifacts-path <out>` (the project is not in
   `BimOpenData.sln`, so another session's edits to the solution do not matter; the library must be regenerated first
   if the Plato library moved, `deps/bim-open-data/tools/regen-step-brep.ps1`).
2. `<out>/bin/StepCorpusHarness/release/step-corpus-harness.exe all <corpus> <outdir> 120 --path host --parallel
   --warmup`: one process per file, `all.csv` with each file's status and last stage, and per file the edge and face
   tables and the summary.
3. The tables and totals above come from a script over `<outdir>` (summaries, `all.csv`, the face and edge tables)
   that also writes the per-file CSV; the script was not committed, the columns it needs are all in the harness's
   output.

A rerun for one file: `step-corpus-harness time <file> <prefix> --path host --parallel --warmup`.
