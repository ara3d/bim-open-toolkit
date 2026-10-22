# STEP mesher: algorithm-level performance findings (2026-10-22)

Read-only sweep of `sandbox/step-brep-mesh` (layers 00 to 08, with 07 read for what it costs on the MeshModel path) and the host (`deps/bim-open-data/src/data/Ara3D.Step.Mesher/Plato/*.cs`), after the 43 `perf-*` chunks of 2026-10-21. No law run, compile or corpus run was made. Costs were read from the Plato source and confirmed in the generated C# (`deps/bim-open-data/src/data/Ara3D.StepBrep/Generated/`) where the runtime matters: `MapRange` and `n.Range` are eager arrays (`Intrinsics/ArrayIntrinsics.cs:29`), `&&`, `||`, `All` and `Any` evaluate every operand, `FlatMap` is linear, `Sort` is a merge sort.

Already landed or already ticketed, so not proposed again: everything in `sandbox/step-mesh-staging/perf-*/TRACK.md` (41 merged chunks plus TKT-406, -407, -408), ideas 1 to 33 of `docs/plans/step-mesher-ideas-evaluation.md`, and TKT-404 (memo of the B-spline search grid per surface, and seeding the refinement test's `SurfaceDistance`; still open, so it appears below only to rank it and to say what it leaves out). TKT-399 (`LocalVertexFibresAreIdentifications`) is left to chunk V1G-7 of the v1-gate session.

Two files moved while this was read: `StepPlatoMesher.cs` (an uncommitted rewrite of the host's refinement loop, `tables.Refined(..., maxRefinementRounds ...)`) and `face-meshing-v1-plane.library.plato` (line numbers shifted by 7). Line numbers below are from 2026-10-22 morning.

Sizes: V vertices, E edges, C coedges (C_f of one face), F faces, L loops of a face, B boundary points of a face, T elements of a face (T_m of the model mesh), N points of a face, k refinement rounds (at most 40), n points of one edge, G arena records, S bodies.

Where the corpus time is (`docs/plans/step-mesher-corpus-2026-10-21.csv`, 87 files, warm): parse 6 s, decode 50 s (C#, outside this scope), prepare 86.9 s (serial), edges 132.5 s, faces 100.5 s (both parallel, so wall time is the slowest rows), assembly 6 s. 45,123 B-spline and surface-curve edges threw the TKT-410 stub early in that run; TKT-410 is done, so the next run sends them, and their 22,410 faces, through the bisection, the anchors and refinement for the first time. Findings 2 to 4 are sized for that run.

## Ranked findings

### 1. `Reduced` builds an O(V) or O(E) array per vertex and per edge: prepare is quadratic

- **Where:** `03-step/step.library.plato:165-167` (`Reduced`, called once per file from `PrepareModelWith:93`):
  ```
  var merged = n.Range.FlatMap(k => roots[k] == k ? n.Range.Take(0) : [k]);
  var drops = m.Edges.Count.Range.FlatMap(k => dropped[k] ? [k] : m.Edges.Count.Range.Take(0));
  var unsettled = m.Edges.Count.Range.FlatMap(k => undecided[k] ? [k] : m.Edges.Count.Range.Take(0));
  ```
  Generated as `n.Range().Take(0)` inside the lambda (`StepReading.g.cs:196-198`); `Range()` is `MapRange(i => i)`, eager. The empty branch is the common one (most vertices are roots, most edges are kept), so each line allocates and fills an array of n or E integers per element. Same pattern, smaller: `03-step/step-loop-chaining.library.plato:121` (`ChangedSensePositions`, O(c^2) per loop of c coedges).
- **Cost before:** O(V^2 + 2 E^2) integer writes and allocations. ELLA-W1 (E = 20,684) is about 8.6e8 writes and 3.4 GB of garbage from `drops` and `unsettled` alone. The corpus agrees: prepare time over E^2 is nearly constant on the large files (ELLA-W1 9.9 s, RCB-F9T 9.6 s at E = 20,166; log-log slope 1.8 over the files with E > 500). A 150,000-face file (E about 400,000) would spend hours here.
- **Cost after:** O(V + E). Use a typed empty array (`[k].Take(0)`, the F4 idiom) or a filter (`n.Range.FlatMap(k => roots[k] == k ? [k].Take(0) : [k])`); the same for `ChangedSensePositions`.
- **Why identical:** the selected indices and their order do not change; only the empty value's construction does.
- **Laws:** a reference kept as `ReducedReference` and `Law_ReducedAgrees` (`SameRawModel`) over the raw witnesses of `step-raw-witnesses.library.plato`; the existing `Law_PrepareIsIdempotent`, `Law_RawUnitCubePreparesToUnitBox`, `StepReadingLaws` reduction laws; a `Witness_ReducedWork` claim (`Insertions(c)` on a chain of n vertices at two sizes).
- **Expected saving:** about 75 to 80 s of the 86.9 s prepare stage, serial, so it comes straight off file wall time.
- **Size:** one small chunk (two files). **Confidence:** high (generated code and corpus slope agree).
- **Grep for the rest:** `Range\.Take(0)` inside a per-element lambda over a non-constant count also appears at `02-topology/topology.library.plato:849, 994`, `topology-shell-tables.library.plato:261`, `topology-faceted.library.plato:55`, `06-mesh/mesh-conversions.library.plato:62`, `mesh-elements.library.plato:124`, `mesh-incidence.library.plato:270`, `mesh-coincident-gridded.library.plato:75`, `07-validation/validation-checks-topology-sparse.library.plato:134`. None is on the host path; the same one-line change fixes each, and they could ride in the same chunk.

### 2. Curve and pcurve inverse searches re-sample their entity on every query (TKT-404 covers surfaces only)

- **Where:** `01-geometry/bspline-inverse.library.plato:193-207` (`MinimizeOverCuts`, `MinimizeOverDomain`), `217-231` (`ClosestParameterBySearchBody`, `PcurveClosestParameterBySearchBody`), and `70-84` (`SearchWindow`, which with `||` evaluating both sides makes 5 evaluations per call even when both ends are finite). Called per bisection midpoint per pcurve image by `AnchorCounted` (`04-discretization/discretization-ranged-bisection.library.plato:147-159`), twice per edge by `EdgeDomain` (`VertexParameter`, `02-topology/topology.library.plato:564`), and again per refined edge per round.
- **Cost before:** per query, 25 to 257 evaluations of the curve or pcurve (`CurveSamplesPerPiece`: 256 / pieces, clamped to 4..24, per piece) plus the polishes. Per edge with a pcurve image: O((S_seeds + n) x I x samples). On a bounded domain the samples `ts` and their points do not depend on the query point; only the distances do. ELLA-W1's 20,684 surface-curve edges (on plane + plane, two pcurve images each) take this path on every midpoint now that TKT-410 is fixed.
- **Cost after:** sample points once per (curve or pcurve) per edge (or per model, as a table), O(samples) evaluations once, then O(samples) distance tests and the polish per query. The same holds for the surface grid of `ProjectBySearchBody` (`:345-361`), which is TKT-404's idea 23; one memo type can serve both.
- **Why identical:** the window, the cuts, `ts` and every `eval(t)` are the same values; the candidate selection and polishes run unchanged. Only when a direction is unbounded does the window depend on p (`SearchWindow`'s doubling); there the memo must not be used (a lines, parabola, hyperbola, extrusion or plane direction, most of which have closed forms anyway).
- **Laws:** `Law_ClosestParameterMemoAgrees` and `Law_ProjectMemoAgrees` (memo answer `==` plain answer on every witness curve, pcurve and surface at the sample points of `BsplineInverseLaws`); existing `BsplineInverseLaws.Law_Project*`, `Law_PcurveClosestParameter*`, `ProjectAlongLaws`, `BisectionCachedLaws`, `Law_ImageChordWithinChordal`; a work claim (curve evaluations per query = 0 after the first).
- **Expected saving:** not measurable on the 2026-10-21 run (these edges threw). Inferred 2x to 5x on the anchor and edge-domain searches of spline and surface-curve edges; on top of TKT-404 this is likely the largest edge-stage item in the next run.
- **Size:** one chunk for curves and pcurves; TKT-404 stays its own. **Confidence:** high on identity, medium on size.

### 3. The quad-grid path evaluates each grid node about 16 times and each shared side twice

- **Where:** `05-face-meshing/face-meshing.library.plato:634-636` (`QuadGrid`: 4 evaluations per cell; `IsKeptQuad` twice per cell; `CellTriangles` built and then `Take(0)` for every kept quad), `05-face-meshing/grid-chordal.library.plato:27-51` (`GridUnlessFoldedOrCoarse`: per element `LiftsFacingFaceNormal`, whose `LiftedVectorArea` evaluates the corners twice, `face-meshing.library.plato:298-308`; then `GridElementWithinChordal` evaluates the corners a third time, the centroid, each interior side's midpoint, and `SurfaceDistance` of the corner mean and each side's chord midpoint; `&&` runs all of it even after a failure). `Lift` then evaluates every node again.
- **Cost before:** about 16 corner evaluations per cell plus 2 midpoint evaluations and 2 projections per interior side, for (n0 + 1)(n1 + 1) nodes. Every four-sided face takes this path since TKT-405 (235 of 239 four-edge cylinders, 41 of 42 full cylinders, 4,755 of 4,771 rectangles on the four baseline files), and so will most corpus B-spline faces (96% are degree (3, 1) swept profiles), where each projection is a global search.
- **Cost after:** one evaluation per node (a positions array indexed by node), one midpoint sample and one chord-midpoint distance per side (indexed by side as in `SampleSlot`), corners read from the array in all three tests and in `Lift`.
- **Why identical:** the same `Eval` at the same uv (`UvMidpoint(a, b)` and `HalfwayPoint` are symmetric in their arguments), so every compared number is the same; the Boolean is the same.
- **Laws:** `Law_QuadGridIndexedAgrees` (outcome `==` the current `QuadGridOnSides` on every `TriangulatedWitness` face and the `CappedWitness` faces); existing `grid-chordal.laws.plato`, `Law_NoQuadsUnlessPreferred`, `Law_BoxFacesStayTwoTriangles`; a work claim (`Evaluations` per node <= 1, per interior side <= 1 plus its projection).
- **Expected saving:** 3x to 5x fewer surface evaluations on grid faces; on analytic strips that is a share of the 0.08 to 0.23 ms median, on B-spline four-sided faces most of the face's evaluation cost. Overlaps TKT-404's idea 24 only in that the grid's `SurfaceDistance` calls are global searches on B-spline faces (TKT-404 names the refinement test's calls, not the grid's).
- **Size:** one chunk. **Confidence:** high on identity and on the count.

### 4. Per-point surface facts recomputed per call, per round and in Lift (collapsed lines, normals, positions)

- **Where:**
  - `05-face-meshing/uv-regions.library.plato:803-813`: `CollapsedLines(f, which)` is `CollapsedAt` of the surface, recomputed on every `IsOnCollapsedLine` call. On a B-spline surface it is `SplineCollapsedAt` -> `BSplineSideCollapses` -> `BoundaryRow` (`01-geometry/bspline-sides.library.plato:27-35`), O(R x C) control work and up to 4 de Boor rows per call, per point. Called per boundary point in the unwrap (`face-meshing-domain-once.library.plato:61-68`), per corner per round in `PointNormalsOf` (`refinement-test-cached.library.plato:35-38`), and per point in `LiftNormal` (`face-meshing.library.plato:341-344`). I5's TRACK.md already lists "CollapsedLines still per point" as debt.
  - `05-face-meshing/triangulation-neighbours-carried.library.plato:43-54`: point normals are recomputed every round for every corner of a tested triangle (R2's debt).
  - `05-face-meshing/triangulation-fast-marks.library.plato:32`: `SmallestCornerAngle` evaluates three corners per unknown triangle per round, though `PositionedTriangulation.Positions` holds them (idea 27's debt).
  - `05-face-meshing/face-meshing-lift.library.plato:151-153`: `SharedPosition(d, s, Eval(...))` evaluates the surface for every class before `SharedPosition` discards it on a vertex or edge source, so every boundary point is evaluated for nothing; interior points are evaluated again after refinement evaluated them.
- **Cost before:** per curved face, O(N x (R C)) for collapsed lines on B-spline surfaces; O(k x corners) normals; 3 evaluations per unknown triangle per round; B wasted plus I repeated evaluations in `Lift`.
- **Cost after:** collapsed lines once per face (two arrays threaded with the domain, as I5 did for the domain); normals and on-line flags carried in `PositionedTriangulationWithNeighbours` beside the positions; `BelowAngleKnown` and `Lift` read the carried positions; `Lift` evaluates only synthetic and interior sources it does not already hold.
- **Why identical:** the same function of the same uv; the carried values are the ones the rounds already computed.
- **Laws:** `Law_CarriedNormalsArePointNormals` (as `Law_CarriedTableIsNeighbourSlots` does for the neighbour table), `Law_LiftFromPositionsAgrees`; existing `NeighboursCarriedLaws`, `RefinementAttainableLaws` (`Law_AttainableRefinementAgrees`), `FaceMeshingLiftIndexedLaws`, `Law_LiftKeepsPoints`; work claims (normals per point <= 1, collapsed-line computations per face = 2).
- **Expected saving:** medium on CDT-refined curved faces (spheres, tori, cones, the cylinders the grid misses), large on B-spline faces where `BoundaryRow` dominates. Under 2% on analytic faces per idea 27's measurement for the angle part alone.
- **Size:** one chunk (two if `Lift` is split off). **Confidence:** high on identity, medium on size. **Overlap:** the duplicate `LiftedVectorArea` and the per-call `CollapsedLines` are also "computed twice" items for the consolidation reader.

### 5. `ImageInFace` rebuilds the face's coedge sites for every coedge: O(C_f^2) per face

- **Where:** `05-face-meshing/uv-regions.library.plato:199-203`, called per coedge from `CoedgeSamples:174`; `onFace.Count == 1 && m.IsSeamEdgeOf(f, e).Not` evaluates `IsSeamEdgeOf` even when the file has no pcurves (generated `.And(...)`). `IsSeamEdgeOf` (`02-topology/topology.library.plato:440-441`) is `CoedgeSitesOfEdgeInFace`, which builds every site of the face and filters it (`:278-300`).
- **Cost before:** O(C_f^2) allocations per face in `LoopToUv`. Small on ordinary faces, large on board faces with hundreds of holes (C_f in the thousands gives millions of site records for one face, and with rows in parallel one such face sets the file's face-stage wall time).
- **Cost after:** O(C_f log C_f): the face's seam set from F1's `SeamEdgesOnce` (already built per face by the unwrap) threaded into `LoopToUv`, or at least a conditional `onFace.Count == 1 ? ... : false`, which removes the test entirely on files without pcurves.
- **Why identical:** the same seam predicate.
- **Laws:** `Law_ImageInFaceGivenAgrees`; existing `Law_PcurveAgreesWithProjection`, `Law_UnwrapKeepsSources`, `Law_LoopToUvCountMatchesDiscretization`.
- **Size:** one small chunk. **Confidence:** high on identity; the saving depends on the many-hole faces, not measured.

### 6. `HullSagitta` builds the whole homogeneous control polygon and filters every knot per bisection test

- **Where:** `04-discretization/bspline-sagitta.library.plato:57-86`: `d.HomogeneousControls` (O(n), `01-geometry/bspline-evaluation.library.plato:206-207`) and `NumberInterval(lo, hi).WindowCuts(d.Basis.Knots.Knots)` (O(K) filter plus sort) on every call; called by `SagittaGiven` once per segment test of a B-spline edge's bisection.
- **Cost before:** O(S x (n + K)) per edge for S tests on a curve of n controls and K knots. `BezierControls` is already local (p + 1 controls).
- **Cost after:** homogeneous controls once per edge (passed down the bisection with the images), cuts by binary search in the sorted knots: O(n + S (p^2 + log K)).
- **Why identical:** the same control values and the same cuts.
- **Laws:** `BsplineSagittaLaws`, `BisectionCachedLaws`, `Law_HullSagittaGivenAgrees`; a work claim with the control count as size.
- **Size:** one small chunk. **Confidence:** high on identity, low to medium on size (corpus B-spline curves are short; matters for long splines).

### 7. Refinement rounds rebuild whole-face arrays when few triangles change

- **Where:** `05-face-meshing/triangulation-neighbours-carried.library.plato:77-116` and `124-169` (each pass copies points, chart points (recomputing `ChartPoint` for all N), positions, triangles and the neighbour table into builders), `37-66` (the test maps `tested`, `first`, `pending`, and three 3T slot arrays every round), `191-209` (`KnownGood`, three `CarriedMarks`, `BelowAngleKnown`, each O(T) per round).
- **Cost before:** O(k x (N + T)) per face on top of the insertions, k up to 40; idea 9's profile already found refinement time in allocation, sorting and copying rather than arithmetic.
- **Cost after:** builders carried across rounds (as the neighbour table already is) and a worklist of the triangles a round created or left unknown, visited in increasing index order: O(N + T + insertions) per face.
- **Why identical:** the passes already visit marked triangles in index order and only append; a sorted worklist visits the same triangles in the same order.
- **Laws:** `NeighboursCarriedLaws`, `RefinementAttainableLaws`, `InsertionBuiltLaws`, `TriangulatedWitnessLaws`; a work claim (array elements written per round <= c x changed).
- **Size:** wide (the marks change representation). **Confidence:** medium; the gain is bounded by about 2x of refinement and depends on how many rounds a face takes.

### 8. Host: each body's mesh is cut from the whole model mesh, O(S x (T_m + V)) per file

- **Where:** `deps/bim-open-data/src/data/Ara3D.Step.Mesher/Plato/StepPlatoBodies.cs:12-19` (`ToShapeMesh`, once per placed item from `StepShapeMesher.MeshItem`): `RestrictedToFaces` scans every element of the model mesh (`06-mesh/mesh-masks.library.plato:125-130`, `FaceSpan`, `FaceMask`, `ElementsOfFaceMaskCounted`), then `ToItemMetres` allocates an index array over every model vertex (`:29-30`).
- **Cost before:** O(S x (T_m + V + F)) for S bodies. Not in the corpus timings (the harness stops at the assembled mesh), but on every real `StepMesher.Mesh` call; a board with hundreds of components pays it hundreds of times.
- **Cost after:** one per-file table of each face's element range (the assembled mesh is built face by face) and a body's elements as the concatenation of its faces' ranges, sorted by face, O(T_m + F) once plus O(T_body + F_body log F_body) per body; the vertex remap over a dictionary or a shared array reset over touched entries.
- **Why identical:** the same elements in element order, the same vertex first-use numbering.
- **Laws or tests:** `Law_RestrictedByRangesAgrees` in layer 06 if the table lives there; a host test comparing every body's `StepShapeMesh` with the current path on the baseline files.
- **Size:** one chunk, host plus one layer 06 function. **Confidence:** high on the asymptotics, unmeasured on size.

### 9. A four-sided face whose opposite counts differ builds and scans a table of every model edge

- **Where:** `05-face-meshing/face-meshing.library.plato:706-712` (`MatchingFloors`: `SegmentFloors(m.Edges.Count.MapRange(...))`) and `735-738` (`QuadCountRequests` walks all E entries), per face with `CountsDiffer`.
- **Cost before:** O(E) per such face, O(F_cd x E) per file. The requests are advisory and the host drops them.
- **Cost after:** O(1): the at most two side edges, sorted, give the requests directly; the dense floors are built only where a caller needs them (no host caller does).
- **Why identical:** the same requests in edge order.
- **Laws:** `Law_QuadCountRequestsSparseAgrees`; existing quad-grid laws.
- **Size:** small. **Confidence:** high on identity; low on saving (the count of such faces is not known).

### 10. The refinement test and the grid check use the O(L) boundary-segment test where the O(1) table is at hand

- **Where:** `05-face-meshing/uv-delaunay.library.plato:50-51` (`IsConstrained` -> `IsBoundarySegmentBody`, a pass over the loops, `uv-boundary-index.library.plato:87-103`), called in `SideNormalsTurn` (`refinement-test-cached.library.plato:49-52`), `IsSampled`, `SidesExceed`, `SideNormalsTurnAttainable` and `GridElementWithinChordal:46`, about six times per tested triangle per round. The `BoundaryIndex` with `Next` (R3) is built in the same round (`triangulation-neighbours-carried.library.plato:218`); the comment at `uv-boundary-index.library.plato:85` says this was left "until it takes the table".
- **Cost before:** O(L) per call; O(k x T x L) per face. **After:** O(1) with `x.Next.IsConstrainedIn`.
- **Why identical:** `Law_IsConstrainedInAgrees`-style laws in `BoundaryIndexLaws` already state the equality.
- **Size:** small. **Confidence:** high; the gain is small except on curved faces with many holes.

## On the MeshModel and validation path (no corpus effect today: the host does not validate)

These scale with the model, not the witness, so the witness timings hide them; they matter the moment a host or a law validates a real file at the Geometric level.

- **V-a. `IsDiscretizedFace` per element.** `07-validation/validation-checks-face-meshing.library.plato:107-111` (`Check_SurfaceWithinSurfaceChordalOfElement`) and `:316-317` (`DeviationExcess`) evaluate `m.IsDiscretizedFace(fm.Face, d)` per element, which runs `Geometry.IsEveryIndexInRange` over the whole arena (`05-face-meshing/face-meshing.library.plato:53-54`). O(T_m x G) per model validation; on a corpus file that is 1e10 and up. Fix: bind it once per face mesh (`IsDiscretizedFaceIn` with `arenaOk` once per report). G2's TRACK.md named the three sites. Distinct from TKT-399's fibre check. One small chunk, high confidence.
- **V-b. `ImageChordExcess` per segment.** `07-validation/validation-checks-discretization.library.plato:342-350` calls `EdgeImages(x.Edge)` three times per segment (each `FacesOfEdge` scans every face's coedges, `02-topology/topology.library.plato:325-327`) and `ImageChordDeviations` twice per segment (each computes all n deviations). O(n x (F C + n)) per edge per image. Fix: E1's `EdgeFaceTable` and the deviations once per (edge, image). E1 and E2 listed both as debt.
- **V-c.** L8, V1 and V5 debts stand as written in their TRACK.md files (assembly checks assembling per sample, `CanEvaluate` -> `IsWellFormed` per sample inside 34 folded layer 01 laws, `CountsAsEdge` per edge).

## Smaller items (one-line fixes, under 2% each)

- `pipeline.library.plato:162-166` `ChangedEdges` compares every edge's arrays every round; only requested edges can change.
- `discretization-edge-domain.library.plato:78` and `discretization-ranged-bisection.library.plato:331`: `EdgeSeedsGiven` runs twice per spline edge (turning, then bisection).
- `03-step/step-loop-chaining.library.plato:148` and `:111`: `ChainedCoedges` runs twice per loop (`EdgesToReverse`, then `WithLoopsChained`).
- `03-step/step.library.plato:140` and `:664-672`: the closure decision of each edge's curve is made in `Reduced` and again per curve in `ClosureMarks`.
- `01-geometry/bspline-inverse.library.plato:358-359`: the best-candidate `Reduce` evaluates the surface three times per candidate pair.
- `bisection SplitSpanCachedCounted:316-318`: `below.Concatenate([middle]).Concatenate(above)` copies at every level, O(n log n) per edge; a builder makes it O(n). Allocation-level; listed only because it is per edge.

The duplicate computations in this list and in findings 3 and 4 (`LiftedVectorArea` twice, `ChainedCoedges` twice, seeds twice, closure twice) are the consolidation reader's kind as well; its `consolidation-findings.md` did not exist when this was written, so overlaps are named here by kind only.

## Checked and already efficient (or not worth a chunk)

- Prepare apart from finding 1: `ModelSize` and `CoordinateExtent` (one pass each), `ClassRoots` (wired to `ClassRootsLinear`), `VertexJoints`, `FoldParity` and `WithFacesReversedMarked` (V8), `ByInstanceOrder` (merge sort), `MirrorFolds`, `ClosureMarks` (one decision per curve and surface; `BSplineSidesCoincideBody` is O(R C) once per surface), `UsedContextsOf` (contexts x occurrences, both small).
- Edges: `StepPlatoTables.Of` once per file (TKT-402), `DiscretizeEdgeRangedCounted` with one edge domain per edge (E2), the edge-face table (E1), the bisection carrying ends and anchors (R5), `RaisedToCountHeap` and the request index (R6). Lines take one segment on one trial; conics start at the closed form. `RaisedForImagesGiven`'s doubling plus binary search re-samples at each trial, O(N log N) evaluations, but only conics reach it and they are 1% of meshing time (idea 11).
- Faces: `UnwrapIndexedIn` (F1, O(B log B)), `CollidingSegments` on a grid (F2), `LiftCounted` (F3, linear), `TriangulateRegionCdtIndexed` (R4; its B^1.5 ear order needs an output change to fix, so it is out of this report's rule), `BoundaryIndex` and the grid inside test (R3, TKT-407), the carried neighbour table (TKT-408), `TryInsertionIndexed` (walk and cavity, local), `ChartOfBody2` (R7), the domain and tolerance once per face (I5), `OuterByContainment` (O(L x B) worst case, O(B) when the file lists the outer first), `IsRedundantVertexLoop` (work only on vertex loops), plane faces skip refinement (`RefineToSurfaceV1`).
- Mesh: `NumberMeshVertices` and `AssembleModelMeshIndexed` (M1), incidence (M2), masks (M3).
- Host first pass: `Rows` in parallel with per-row isolation (TKT-403); `PendingFaces` uses `FaceEdgesOnce`. The refinement loop (`Step`) is linear in the model per round (edge-face table, request index, `FacesTouchingByCoedges`, one arena check per round) but runs `Refine` and the re-meshed faces in sequence; that is a parallelism choice, not an asymptotic one, and the loop is being rewritten now.
- Runtime: `FlatMap` is linear, `Sort` is a merge sort, `MapRange` computes each element once.

Not examined: the C# decoder (`DecodeRaw`, 50 s of the corpus, the second-largest serial stage), the parser, and layers 09 to 11.
