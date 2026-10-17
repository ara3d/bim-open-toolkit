# Lessons from the existing IFC mesher

Written 2026-10-17 for TKT-299 (the design of a Plato library that meshes the exact boundary representation in a
STEP file). Subject: `deps/bim-open-data` at commit `fa4b801`: `src/data/Ara3D.MeshKernel` (1,130 lines of shared
geometry), `src/data/Ara3D.Ifc.Mesher` (5,610 lines; the B-rep face path is about 2,200 of them with the curve
and surface-map files it calls), their tests, and the comparison harness.

Tags. Evidence: **[R]** read in the code or tests, with file and line; **[P]** run on 2026-10-17 with a throwaway
console program outside the repository that references the built `Ara3D.MeshKernel.dll` (inputs stated in the text);
**[H]** taken from commit messages or from the progress notes that commit `7f76b3b` deleted, which the owner called
"working theories" at the time, so each is either backed by code still present or marked as a theory. Design:
**D1 to D8** are the bullets of "Decisions made before the layers were written" in `../README.md`, in order (D1
closed sums, D2 flat tables, D3 natural parameterization, D4 the file's tolerance, D5 one discretization per edge,
D6 every law names its tolerance, D7 nothing is a flag that could be a proof, D8 diagnostics, never exceptions);
**G1, G2, G3** are the topological, geometric and quality constraint groups.

File names: unqualified ones are in `src/data/Ara3D.Ifc.Mesher/`; `Kernel/` is `src/data/Ara3D.MeshKernel/`;
`Tests/` is `tests/data/Ara3D.Ifc.Mesher.Tests/`; `Compare/` is `tests/data/Ara3D.IfcMeshingComparison/`;
`sdk/` is `deps/ara3d-sdk/src/Ara3D.Geometry/`.

Terms. *Newell plane*: the best-fit plane of a polygon from Newell's formula (sum of the edge cross products).
*Earcut*: a polygon triangulator that cuts off ears (triangles at convex corners); here the mapbox/earcut port.
*Weld*: merge vertices that sit at the same position. *T-junction*: a vertex of one face lying on an edge of a
neighbour that does not share it, which leaves a crack. *pcurve*: an edge's 2D curve in its surface's parameters.

## 1. Architecture in one page

A face goes from entity to triangles in eleven steps. The mesher reads IFC entities, but `IfcAdvancedFace` has the
same shape as STEP's `advanced_face`, so the steps are the ones a STEP mesher needs.

| # | Step | Where |
|---|---|---|
| 1 | **Entry.** `IfcMesher.Build` wraps `ModelAssembler.BuildModel`; `GeometryDispatcher.TryBuild` switches on the entity name; `Brep.BuildAdvancedBrep` passes all faces of one closed shell to `FaceSetBuilder.Build`. Lengths are multiplied by the unit scale while being read and are `float` (32-bit) from then on. | IfcMesher.cs:14; GeometryDispatcher.cs:44-75; Brep.cs:23,70; FaceSetBuilder.cs:22; MeshingContext.cs:56 |
| 2 | **Bounds to 3D rings.** A polyloop copies its points. An edge loop evaluates each oriented edge's curve to a polyline, reverses it for edge-curve `SameSense=.F.` and for oriented-edge `.F.`, appends it, and skips a first point within 5 % of a model unit of the previous last point. Edge start and end vertices are not read for edge curves. The only `IFCFACEOUTERBOUND` is the outer ring; every other bound is a hole. | FaceBounds.cs:15-31,80-123; CurveEvaluator.cs:16-20 |
| 3 | **Curve sampling.** Fixed counts, no deviation input: an arc gets `ceil(turns x 32 x 11/8)` chords (min 2, max 64); a B-spline gets the larger of a count from its control polygon's turning angle and 2 per degree per span (max 256); a line is two points. | ConicArc.cs:15-25; BSplineEvaluator.cs:57-63; Conics.cs:65-70 |
| 4 | **Surface choice.** `FaceSurfaceMaps.Resolve` builds a `SurfaceMap` for cylinder, surface of revolution and B-spline faces. A declared plane is used only if every ring point is within max(1 um, 1e-4 model units) of it. Otherwise, and for every other surface (cone, sphere, torus, extrusion), the face gets the Newell plane of its own ring. | FaceSurfaceMaps.cs:13-32,119-142 |
| 5 | **3D to 2D.** `ProjectRing` inverse-maps each sampled point; pcurves are never read. Plane: dot with U and V. Cylinder: `atan2`, unwrapped against the previous point; domain (radius x angle, height). Revolution: angle plus arc length of the nearest point on the *sampled* meridian polyline. B-spline: the (u,v) of the nearest of 33 x 33 precomputed surface points, returned as that grid node's own (u,v). | Kernel/SurfaceMaps/FacePlane.cs:53; CylinderMap.cs:25-48; RevolutionMap.cs:75-99,109-130; BSplineSurfaceMap.cs:43-57,81-100 |
| 6 | **2D clean-up.** Consecutive points within 1 um merge, a closing duplicate goes. A cylinder ring is densified: a segment longer than `radius x 2pi/48` in either parameter is split, up to 24 pieces. | FaceSetBuilder.cs:45-52,227-243; CylinderMap.cs:60-91 |
| 7 | **Triangulation.** In order: a one-triangle or convex-quad shortcut for hole-free rings of doubled area under 1e-4 m^2; a band of quads when there is one hole with the same vertex count as the outer ring; else `Earcut.Triangulate` (port of mapbox/earcut 3.0.1: bridges holes to the outer ring, adds no points, uses no absolute tolerance, accepts either ring orientation, returns counter-clockwise triangles). The face is dropped when triangle area differs from ring area by more than 1 %. | FaceSetBuilder.cs:136-191; sdk/MeshAlgorithms/Earcut.cs:21-28 |
| 8 | **Lift to 3D.** Every triangle corner goes through `Unproject`: plane `origin + U x + V y`; cylinder `(r cos u, r sin u, v)`; revolution: interpolate the meridian polyline at the arc length, rotate; B-spline: Cox-de Boor tensor product with weights, in `float`, parameters clamped to the domain. Boundary vertices are re-evaluated too, so they need not equal the sampled edge points. | FaceSetBuilder.cs:85-87; CylinderMap.cs:50-54; RevolutionMap.cs:101-106; BSplineSurfaceMap.cs:102-132 |
| 9 | **Winding.** Counter-clockwise in the 2D domain, so the 3D side follows the map's U x V: the ring's Newell normal for a fitted plane, the plane frame's Z for a declared plane, outward radial for a cylinder. The triangle is then reversed if any inner `IFCFACEBOUND` has orientation `.F.`. `IFCADVANCEDFACE.SameSense` is never read. | FaceBounds.cs:32-33; FaceSetBuilder.cs:88-91; FacePlane.cs:50-51 |
| 10 | **Vertex dedup.** A per-solid dictionary maps `round(x * 1e5)` per axis (an `int` triple) to a vertex index; a per-face dictionary caches it. Welding is by position in a 10 um cell, never by topology. (Whole meshes of repeated parts are shared by fingerprint plus exact comparison: IFC instancing, no STEP counterpart in the design.) | FaceSetBuilder.cs:26,65-81,245-246; Kernel/Meshes/MeshDedup.cs:10-35 |
| 11 | **Diagnostics.** `MeshingDiagnostics` counts entity names with status Supported, Approximate or Unsupported and keeps free-text messages. A dropped face is recorded against the current product: a count, a count per reason kind, the first three face ids. The only `catch` is per entity, so one unreadable curve in one face discards the whole solid. The result record carries `Success`, counts, bounds, signed volume and message strings. | Diagnostics.cs:10-95; GeometryDispatcher.cs:77-81; IfcMeshingResult.cs:6 |

**The surface abstraction.** `SurfaceMap` is an abstract class with two members, `ProjectRing(IReadOnlyList<Vector3>)
-> IReadOnlyList<Vector2>` and `Unproject(Vector2) -> Vector3` (Kernel/SurfaceMaps/SurfaceMap.cs:12-16). Four
implementations: `PlanarMap(FacePlane)`, `CylinderMap(frame, radius)`, `RevolutionMap` (axis frame plus meridian
polyline), `BSplineSurfaceMap` (control net, weights, expanded knots). The contract is informal: no domain, no
periodicity, no accuracy statement for `Unproject(ProjectRing(p))`. The cylinder and revolution maps are stateful:
the first ring projected fixes the angle reference for later rings (CylinderMap.cs:14-15,42-46; RevolutionMap.cs:
19-20,93-97), so holes projected before the outer ring unwrap differently. [R]

**Tolerances.** There is no tolerance object. `Tolerance.Eps` is one `const float` of 1e-6 (metres) with the comment
"the distance below which two curve or ring points count as one, and the doubled area below which a thin face
triangle is dropped" (Kernel/Tolerance.cs:3-8). Further absolute thresholds sit in the code [R]:

| Value | Where | Use |
|---|---|---|
| 1e-12 (squared metres) | FaceBounds.cs:154 | merge consecutive 3D ring points |
| 5 % of a model unit, at least 1 um | CurveEvaluator.cs:18 | join edges and composite segments: 5 cm in a metre file, 0.05 mm in a millimetre file |
| max(1 um, 1e-4 model units) | FaceSurfaceMaps.cs:141-142 | is the ring on the declared plane (0.1 mm in a metre file) |
| 1e-5 m | FaceSetBuilder.cs:246 | weld cell |
| 1e-4 and `Eps`, both on doubled area | FaceSetBuilder.cs:154,159,201-216 | thin-ring shortcut; a 3-vertex ring of doubled area <= 1e-6 m^2 (area <= 5e-7 m^2) is dropped |
| 1 % | FaceSetBuilder.cs:18 | area deviation that drops a face |
| 1e-3 relative | RingBandTriangulation.cs:39 | band cover check |
| pi + 1e-3 rad | TrimmedCurves.cs:230; ConicArc.cs:46 | a trim above this is read as degrees; a long arc |
| 1e-7 m, 1e-9, 1e-20 | FaceSurfaceMaps.cs:38; RevolutionMap.cs:49,69,118 | radius, meridian length, segment length squared |

The file's own precision or uncertainty is read nowhere; a search for `Precision` and `uncertain` finds nothing. [R]

## 2. What the tests assert

162 test cases in `Ara3D.Ifc.Mesher.Tests` (counted by attribute, not run), 30 in `Ara3D.MeshKernel.Tests`, and a
corpus harness over real files that skips itself without them. Bounds are asserted to 1 um (GoldenMeshTests.cs:1674).

| Test class | Properties asserted | Group |
|---|---|---|
| `GoldenMeshTests` (64) | One entity per micro-IFC snippet: exact vertex and triangle counts (cube from six advanced faces: 8 points, 12 triangles, :916); exact bounds; the support status recorded. Curved fixtures: more than 4 triangles and one vertex in a box around the arc midpoint (quarter cylinder :1043, revolution :1104); B-spline: peak y in (0.2, 0.8), x within 0.05 of 0 and 2 (:1163). | G2, weakly (bounds, one vertex); the counts are pins and belong to no group |
| `BrepTests` (7), `ThinFacetTests` (2) | A repeated or closing vertex still meshes (:11); a collinear face is dropped and reported against its product (:87); a bow-tie face is dropped with "area off by" (:116); 50 drops aggregate to one line (:141); 0.1 mm facets mesh as single triangles (ThinFacetTests.cs:12,30). | diagnostics; G3 (degenerate) |
| `AdvancedFaceTests` (1) | A four-corner quarter cylinder gets more than 2 triangles and 4 points (densification). | G2, weakly |
| `WindingTests` (6) | Signed volume positive and equal to the closed form (box 24 within 1 %; hollow tube 20 within 1e-3); at least 90 % of normals point away from the centroid (99 % for a tessellated set); every undirected edge used twice; mirror operators keep winding; a `.F.` face bound gives mutually consistent normals, direction unchecked (:59-105). | G1 (closed, oriented), G2 (volume) |
| `CutOracleTests` (6), `BooleanTests` (9) | IFC half-space and opening carving: kept bounds, a volume bracket (50 % to 99 % of the prism), a point-in-mesh ray cast (+X ray, odd crossings, absolute 1e-5 cut-off; void absent, wall present), clipped triangles keep their normal side. | G2; IFC-only |
| `CurveTests` (14), `BSplineCurveTests` (7) | Arc endpoints within 0.05; a rational quarter circle on the unit circle within 1e-4; Cox-de Boor against hand values within 1e-5; chord counts 11, 44, 64, 33, 2 for set sweeps; `.F.` sense keeps the short arc; three "profile is a simple polygon" asserts that rest on a crossing detector which missed every crossing tried (lesson 10). | G2 for curves |
| `CoverageGateTests` (3), `GoldenMeshTests` :14 | Every dispatcher arm is in the coverage table; every `Supported` entry has a test tagged with its entity; about 50 schema attribute indices are pinned. | process; schema |
| Kernel: `SurfaceMapTests` | Project then Unproject returns the point within 1e-4 on a cylinder ring crossing the seam (step of pi, not a 2pi jump, :29) and within 1e-5 on a revolution; a degree-1 net's centre; null for a wrong knot count. | G2 |
| Kernel: `ExtrusionTests`, `PolygonWithHolesTests` | A square tube is closed (every undirected edge twice) with volume 3 (:22); holes are clockwise; the band has 8 triangles; one test is ignored (lesson 10). | G1, G2 |
| Corpus harness (`Compare/`) | Parity score against web-ifc (the loader's build and 0.0.78 from npm): volume, area, sorted box extents, principal-axis ratios, open-boundary length, each ratio scoring 1 when equal and 0 at 3x apart; committed floors 0.958, 0.945, 0.915 on three files (`bench/ifc-mesher/ratchets.json`); `CorrectnessScorecard` gates: valid-and-non-degenerate rate 0.90, winding rate 0.45 (an open-edge budget of 32 per mesh is counted, not gated); Chamfer and Hausdorff distance to another mesh (explicit only); one DigitalHub advanced brep gives over 100 triangles. | G2 against another mesher; G1 through open-edge counts |

What no test asserts. **G1:** orientation consistency across adjacent faces (a directed edge used once per
direction); non-manifold edges (`TopologyOracle.HasNonManifoldEdges` exists and is never called); Euler
characteristic; that two faces on a shared edge hold the same vertices; closedness of any B-rep (the closed-edge
tests are extrusions; `TopologyOracle.CountOpenEdges` counts undirected uses, so a mesh with
one face flipped still passes, Tests/Support/GeometryOracles/TopologyOracle.cs:8-23). **G2:** distance from mesh to
the exact model, chordal deviation, angular deviation, maximum edge length; the nearest thing is Hausdorff distance
to another mesher. **G3:** only "no triangle with area below 1e-12" (MeshValidity.cs:8); no minimum angle, no
aspect ratio. **Group with no test at all: G3 beyond degenerate triangles, and the quads it names**; the code makes
none (every result is a `TriangleMesh3D`; the ring band is the only quad-like structure).

## 3. Lessons paid for

Each lesson names the design decisions it bears on. "Fix" says what the repository did; "Rule" is the standing
rule that would have prevented it.

**1. Single-precision coordinates and one absolute tolerance** (D4, D6; G2).
Went wrong: `MeshMeasure.SignedVolume` forms `float` triple products and sums them in `double`
(Kernel/Meshes/MeshMeasure.cs:12-22). Commit 7d90d74 ("Conic arcs: one ConicArc/ConicTrim value type and density
rule") traced a 0.75 shape score to it: "the harness volume term sums float32 products at world coordinates (-21,
104, 3.5) m, giving 0.0011 for ours and -0.00015 for web-ifc, while both measure 9.77e-4 m3". [P] A 1 m cube with a
corner at (10 000, 10 000, 10 000) m reports volume 10 000; at 100 000 m it reports 1.02e8; it is exact up to 1 000 m
only because those coordinates are exact in `float`. The weld key (`FaceSetBuilder.cs:245`) is an `int`, which
overflows beyond about 21 km, and is finer than float spacing beyond 128 m (1.5e-5 m there, 6e-5 m at 600 m); two
points 2e-9 apart on a rounding boundary get different keys. [P]
Fix: none; the commit left it to `MeshMeasure.SignedVolume`, unchanged at `fa4b801`.
Rule: 64-bit coordinates; area and volume sums taken relative to a local origin; a tolerance has a dimension (length,
area, angle) and comes from the file. `Eps` doubles as an area threshold (FaceSetBuilder.cs:159,201-216).

**2. An ear clipper with an absolute epsilon** (D6; G1).
Went wrong: the first triangulator tested convexity against 1e-6. [H] A bolt shank (radius 0.0095 m, 32 segments)
has corner cross products near 1e-7, so "no ear found on any vertex" and 196 bolt instances vanished; 0.1 mm helix
facets failed the same way. Commit 80eee24 reports 2,266 advanced-brep faces "a few centimetres across, which the
old ear clip threw on and Approach1 dropped without a word". Four fallbacks had piled up: a normalized retry, a
recovery clip, a collinear-vertex filter, a convex fan.
Fix: 80eee24 moved to earcut (no absolute tolerance, never throws) and deleted the fallbacks; `ThinFacetTests` keep
the 0.1 mm case. Residue: a legitimate triangle with legs under 1 mm (area under 5e-7 m^2) is dropped by FaceSetBuilder.cs:159. [R]
Rule: triangulation predicates are scale-free or exact; absolute thresholds appear only in coincidence tests.

**3. Faces dropped without a word, and a solid lost for one bad curve** (D8).
Went wrong: `Brep.cs` skipped a face when triangulation failed or its area missed by over 1 %, so "a mesh could be
silently incomplete" (a0db841, "Fix F5 (D5): record each face the mesher drops, per product"). Today a throwing edge
curve loses the whole solid, because `FaceSetBuilder.cs:28-93` has no `catch` and `TryBuild` has one per entity;
`TryBuildRevolution` and `TryBuildBSpline` swallow every exception and fall back to a flat face
(FaceSurfaceMaps.cs:77-80,110-113). [R]
Fix: `RecordDroppedFace`; on the corpus 256 faces in 8 products on duplex.ifc and 198 in 31 on schependomlaan.ifc.
Tested at BrepTests.cs:87-151, by matching substrings of message strings.
Rule: every omission is a diagnostic with provenance, at face granularity, as data; each stage conserves faces
(in = meshed + dropped with reason).

**4. Hole walls wound twice, and the tests agreed** (G1).
Went wrong: `BuildExtrusionWithHoles` reversed hole walls although `PolygonWithHoles` already stores holes clockwise
(Kernel/Polygons/PolygonWithHoles.cs:5,74-80); hole walls faced inward and "every IFCARBITRARYPROFILEDEFWITHVOIDS
volume was wrong" (212fdef). The winding test asserted the inverted walls. In 95c9b74 "four micro-IFC tests asserted
the inversion; they were wrong and now assert the spec" (a half-space flag; IFC-only).
Fix: the test asserts the exact volume, 20 for a 4 x 3 tube with a 2 x 1 hole (WindingTests.cs:30-55).
Rule: normalise orientation once, at construction, as a stated invariant; check winding through an independent closed
form (signed volume), not through the code's convention; cite the source of each expected value. The centroid test
`OutwardNormalFraction` suits only convex solids (WindingTests.cs:52-54).

**5. A band between two rings overlapped itself** (G1, G2).
Went wrong: an annulus whose rings have equal vertex counts is cut into quads joining ring points of equal index;
with the inner ring resampled and reversed the band folded: "17774 against 2133 area units" (390591c).
Fix: the profile path accepts the band only when its triangle areas sum to the ring area within 0.1 %, else earcut
(Kernel/Polygons/RingBandTriangulation.cs:8-40).
Rule: a specialised path needs an exact cover check and a general fallback. [P] The face path lacks it:
FaceSetBuilder.cs:173 calls `TryTriangulateCongruentRing` for any one-hole face with equal counts and returns. A 4 x 4
outer ring with a 2 x 2 hole given clockwise yields 8 triangles of total area 24 for a region of area 12, two of them
negative; given counter-clockwise, 12. A B-rep loop keeps the face on its left, so an inner loop runs opposite to the
outer one; the golden fixture (GoldenMeshTests.cs:1234) gives both the same sense, which is why it passes.

**6. Curved faces projected onto a plane** (D3).
Went wrong: cylinder, revolution and B-spline faces were flattened to the Newell plane of their boundary:
"wrapping patches self-overlap or flatten, losing geometry"; 615 of about 10,070 advanced faces in one model were
cylinders. [H]
Fix: `SurfaceMap` (39bc05f, 72dbcd7): project to surface parameters, triangulate there, evaluate back; angles are
unwrapped along each ring (SurfaceMapTests.cs:29-41). Merged triangles on that model went from 17 % to 75 % of the
reference mesher's (39bc05f).
Rule: faces live in the surface's natural parameters with periodic wrap in the type; a seam crossing is a test.
Still absent: poles (RevolutionMap.cs:75-99 takes `atan2` at radius 0 with no case) and a cylinder bounded by two
circular loops with no seam edge (the outer ring would have no area in the parameter plane). [R]

**7. Trims given as points, in degrees, with a false sense** (D1, D3).
Went wrong: rim arcs of cylinders are `IFCTRIMMEDCURVE`s whose master representation is `.CARTESIAN.`; the code read
only parameters (zero), so the arc collapsed to a point and the boundary vanished (39bc05f). Exporters write
parameters in degrees or radians, and a false sense with a long trim (0 to 3pi/2) must sweep the long way; inverting
the sense of composite segments with `SameSense=.F.` produced a self-intersecting ring. [H]
Fix: trim by points when the master says so (TrimmedCurves.cs:47-62); a value above pi + 1e-3 is taken as degrees
("Exporters disagree", :226-232); `ConicTrim.Resolve` (ConicArc.cs:38-49); CurveTests.cs:200-222.
Rule: an interval on a periodic curve is (start, signed sweep) computed once from the vertices or parameters the file
gives; units are explicit; a guessed unit is diagnosed.

**8. A unit scale of zero looked like an empty solid** (D4, D8).
Went wrong: for inch files `Units` returned 0 because the factor is `IFCMEASUREWITHUNIT(IFCLENGTHMEASURE(25.4),...)` and
typed measures were not unwrapped; every coordinate collapsed and every mapped faceted brep gave 0 triangles (146
products missing). [H]
Fix: Units.cs:105-144 unwraps typed measures; ModelBuildTests.cs:80,95.
Rule: a zero or non-finite scale is an error diagnostic; test one non-metre file.

**9. Agreement with another mesher read as correctness, and disagreement as a defect** (validation).
Went wrong: parity with web-ifc is the headline number. Two builds of web-ifc agree at 0.99 because they share an
engine; this mesher agrees at 0.92 to 0.96 (bench/ifc-mesher/RESULTS.md). The reference was wrong on about 30 duplex
slabs: "the candidate is correct; the duplex oracle BFAST mis-tags per-entity meshes". [H] The 0.75 score of lesson 1
was the harness's float volume. The floors in `Compare/Tests/Comparison/CorrectnessScorecardTests.cs:34-41` sit at
0.90 and 0.45 under targets of 1.0 and 0.95 ("Current corpus still has inverted mapped solids").
Fix: frame- and density-invariant shape descriptors (Compare/Harness/ModelComparer.cs:382-444), a mis-tag detector,
and a ratchet file: "Raise a floor in the same commit as the change that beats it; never lower one without a ticket".
Rule: first-principles oracles (closed-form area and volume) decide correctness; other meshers give parity only;
a metric gets tests of its own.

**10. A guard that never fires** (validation).
Went wrong: `PolygonWithHoles.HasSelfIntersection` guards the band path and is the assertion of three "profile is a
simple polygon" tests (CurveTests.cs:42,124,173). It wraps the SDK's `HasSelfIntersectionsSweep`, which "returns null
for every bow tie and figure eight tried" (PolygonWithHolesTests.cs:39-43, test ignored). [P] It returned false for a
bow tie, a figure eight and a five-point crossing polygon.
Fix: none; the area-deviation check of lesson 3 is the working backstop (BrepTests.cs:116-138). [P] For the symmetric
bow tie it reports an infinite deviation (net ring area 0); for an asymmetric one, 2.
Rule: every predicate gets a negative witness before it guards or asserts (here: every `Oracle_*` rejects one).

**11. Density chosen per face cracks shared edges** (D5; G1).
Went wrong: each face re-samples every edge curve (FaceBounds.cs:114-123), and a cylinder face then adds points to
its own boundary ("Density is local to the face radius; it does not change global curve sampling",
CylinderMap.cs:56-59). A neighbouring planar face keeps the original samples: a T-junction, and welding by position
cannot repair a vertex that exists in one face only. [R] A global density increase "regressed T1 quick (example parity
0.864 vs baseline 0.896) and broke golden `ReadsTrimmedCircleCurveAsSampledArc`" and was reverted [H]; the chord
rule was then tuned to imitate another mesher: "the other four meshers cut the 6.35 mm fillet arcs of example.ifc's
L-angle columns into 11 chords per quarter turn" (ConicArc.cs:11-14). No test checks that two faces on a shared edge
hold the same vertices.
Rule: one polyline per model edge, used by both faces; density from a deviation criterion, not from a mesher.

**12. Boundary vertices were not on the model's edges** (D3, D6; G2).
Went wrong: until 45be29b B-spline edge curves were sampled as their control polygons ("knots and weights are not
read"). [R: `git show 45be29b^`] [P] On a quadratic arch patch 2 units wide, the on-surface point (0.6, 0.42, 0.5)
(u = 0.3, v = 0.5) projects and unprojects to (0.625, 0.4297, 0.5): 0.027 away, because `ProjectRing` returns the
nearest grid node's parameters with no refinement; that is 27,000 times the 1 um tolerance. Revolved faces evaluate
the sampled meridian polyline, so a circular meridian becomes its chords. A face on an unsupported surface is
flattened to the ring's Newell plane and `Unproject` returns points of that plane (FacePlane.cs:59-60), moving a
non-planar ring off its edges. Inconsistent declared knots are still replaced by clamped uniform knots
without a diagnostic (BSplineCurves.cs:41-46). [R]
Fix: curve evaluation from knots (45be29b); the surface side is unchanged.
Rule: inverse evaluation returns (parameters, residual) and is refined; boundary vertices are the sampled edge points;
the residual is checked against the tolerance. The surface-map round-trip tests use grid nodes only.

**13. No vertices inside a curved face** (G2). Found by reading; no fixture contains a doubly curved face.
Earcut adds no points and `DensifyUvRing` touches boundaries only, so every vertex of every face is a boundary
vertex (PolygonWithHoles.cs:35-37; Earcut.cs:22-24). Cylinders are ruled, so densifying the arc direction is enough
(AdvancedFaceTests.cs:10 counts triangles); a sphere cap, torus or general B-spline face becomes a fan of its
boundary with unbounded sag. The 2D scale is arbitrary: `refRadius x angle` (RevolutionMap.cs:34-52,91) and one global
scale per B-spline direction (BSplineSurfaceMap.cs:38-41).
Rule: refinement belongs to face meshing: add points from the surface until a deviation criterion holds, in a metric
taken from the surface.

**14. Which flag decides the winding** (D7; G1). A latent defect found by reading, not paid for.
`IFCADVANCEDFACE.SameSense` is never read; a face is reversed when any inner `IFCFACEBOUND` has `.F.`
(FaceBounds.cs:32-33). ISO 10303-42 defines `face_bound.orientation` as the loop's sense within the bound and
`face_surface.same_sense` as the agreement of the face normal with the surface normal (from memory;
`STEP-BREP-MODEL.md` should confirm). `Winding_FaceBound_SameSenseFalse_FlipsWinding` asserts consistency, not
direction, and no fixture sets `SameSense` false on a declared surface. By reading, CAD files that write reversed
planes would come out inside-out on the declared-plane path (step 9).
Rule: winding = surface normal x sense, decided once; a law checks each triangle against the surface normal at its
centroid.

## 4. What transfers to STEP and what does not

| IFC4 entity | STEP (ISO 10303-42) | Notes for the mesher |
|---|---|---|
| `IfcAdvancedBrep` | `manifold_solid_brep` over `advanced_face`s | closed shell read, faces flat-listed. `IfcAdvancedBrepWithVoids` (`brep_with_voids`) is "Planned", not built (GeometryCoverage.cs:44) |
| `IfcAdvancedFace` | `advanced_face` (`bounds`, `face_geometry`, `same_sense`) | same attributes in the same order; see lesson 14 |
| `IfcFaceOuterBound`, `IfcFaceBound` | `face_outer_bound`, `face_bound` | a face with no `face_outer_bound` gets an empty outer ring and is dropped (FaceBounds.cs:27-31; FaceSetBuilder.cs:33-37). On a cylinder the two end circles are closed loops with no natural inside, so which one a file marks outer is arbitrary and the region must be found in the parameter plane |
| `IfcEdgeLoop`, `IfcOrientedEdge`, `IfcVertexPoint` | same names | composition of the two orientation flags is correct (FaceBounds.cs:109-121); no closure check; `vertex_loop` unsupported |
| `IfcEdgeCurve` | `edge_curve` | **does not transfer.** STEP's `edge_geometry` is normally an untrimmed `line` or `circle` whose extent the two vertices define. This code evaluates the curve alone: a bare circle is a full 32-gon, a bare line is `origin` to `origin + direction` (Conics.cs:28-36,65-70), and `EdgeStart`/`EdgeEnd` are unused (FaceBounds.cs:114-123). It works for IFC only because exporters wrap arcs in `IfcTrimmedCurve` |
| `IfcPlane`, `IfcCylindricalSurface` | `plane`, `cylindrical_surface` | direct |
| `IfcSurfaceOfRevolution` | `surface_of_revolution` | IFC wraps the generatrix in a profile and adds a `Position`; STEP gives a curve and an `axis1_placement` (FaceSurfaceMaps.cs:47-95 would shrink) |
| `IfcBSplineSurfaceWithKnots`, `IfcRationalBSplineSurfaceWithKnots` | `b_spline_surface_with_knots`; rational is a Part 21 complex instance | reader takes weights, knots, multiplicities directly (BSplineSurfaceReader.cs). Plain `IFCBSPLINESURFACE` has no knots, so `Build` returns null (BSplineSurfaceMap.cs:74) and the face goes flat; closed and periodic flags are ignored |
| `IfcLine`, `IfcCircle`, `IfcEllipse`, `IfcTrimmedCurve`, B-spline and composite curves | `line`, `circle`, `ellipse`, `trimmed_curve`, B-spline curves, `composite_curve` | evaluators in Conics, ConicArc, TrimmedCurves, BSplineEvaluator reusable as references |
| absent from the mesher | `conical_surface`, `spherical_surface`, `toroidal_surface`, `surface_of_linear_extrusion` as a face surface, `offset_surface`, `pcurve`, `surface_curve`, `seam_curve`, `intersection_curve`, `hyperbola`, `parabola`, `vertex_loop`, `oriented_closed_shell` | a search of `src/data/Ara3D.Ifc.Mesher` finds none as a face or edge case. Mechanical parts use cones, spheres and tori for chamfers, fillets and domes, so this is the main gap |

**Code paths that apply to the shared part** (faces, loops, edges, surface and curve evaluation): `FaceBounds`
(loop assembly and orientation composition), `FaceSurfaceMaps` (plane containment test), the three parametric maps
(unwrapping, Cox-de Boor, the meridian idea), `BSplineEvaluator` (`SplineDefinition.IsValid`: degree >= 1, more
control points than the degree, knots = points + degree + 1 and non-decreasing, positive domain, :15-21), `ConicTrim`,
`Earcut` as a baseline, `Diagnostics`, and the oracles (`AnalyticalOracle`, `TopologyOracle`, `WindingOracle`) once
corrected. **Out of scope** (IFC-specific): `ModelAssembler`, `GeometryPartCollector`, `Placements`, `MeshDedup`,
`StyleResolver`, `OpeningCarver`, `Booleans`, `Boolean*`, the profile and sweep files, `Revolutions` (a revolved
*solid*, not a surface), `Tessellated`, `Units` (IFC unit graph), and in the kernel `Extrusion`, `SweepRings`,
`CircleSamples`.

**Lessons that apply:** 1, 2, 3, 5, 6, 9, 10, 11, 12, 13, 14 in full; 7 for `trimmed_curve` and for the vertex
trimming that STEP adds; 8 for the units context (`SI_UNIT` complex entities) and the file's uncertainty; 4 only as
the principle of normalising loop orientation once. **Hazards the IFC code never met:** complex entity instances;
`edge_curve` on untrimmed curves; `same_sense` false on planar faces; faces on cones, spheres and tori with poles
and seams; pcurves; `brep_with_voids`; B-spline surfaces with derived knot vectors; files with far more NURBS than
the IFC corpus.

## 5. If we had to do it again

Each item names the design layer it is for (`../README.md`, "The layers") and the file, test or commit behind it.

1. **00-foundation.** Carry coordinates as 64-bit and make the tolerance a typed value read from the file's
   `uncertainty_measure_with_unit`, with separate length, area and angle types (lesson 1; Tolerance.cs:8;
   FaceSetBuilder.cs:159).
2. **00-foundation.** Make a diagnostic a record (code, severity, provenance: STEP instance number or kernel index) and
   give each stage a conservation law: inputs = outputs + dropped with reasons (Diagnostics.cs:67-95; BrepTests.cs:87-151).
3. **01-geometry.** Close the surface sum over the face surfaces of ISO 10303-42 (plane, cylinder, cone, sphere, torus,
   extrusion, revolution, B-spline, offset) so an unhandled surface is a compile error, not a flat fallback
   (FaceSurfaceMaps.cs:31; FaceSetBuilder.cs:124-125).
4. **01-geometry.** Specify inverse evaluation as `Project(surface, p) -> (parameters, distance)`, refined by Newton from
   a coarse start, with the law `Evaluate(Project(p)) = p` within tolerance, tested off the grid
   (BSplineSurfaceMap.cs:81-100; the 0.027 probe of lesson 12).
5. **01-geometry.** Represent a trimmed edge as (curve, start parameter, signed sweep) derived from its vertices, with
   periodic wrap and `same_sense` (FaceBounds.cs:114-123; ConicArc.cs:38-49; lesson 7).
6. **02-topology.** Check loop closure within the file tolerance (FaceBounds.cs:83-95 joins at 5 % of a unit and never
   complains), choose the outer loop in the parameter plane when the file marks none, and keep face `same_sense` and
   bound `orientation` as separate fields (lesson 14).
7. **03-step.** Pin the schema layout by test, as `HarnessUsesIfcTypeSchemaAttributeLayouts` does
   (GoldenMeshTests.cs:14-70), and read units and uncertainty from the file context; a scale of 0 is an error (lesson 8).
8. **04-discretization.** One polyline per model edge from deviation criteria, consumed by both faces, one of them
   reversed; test that the two faces hold identical vertex index sequences (lesson 11; CylinderMap.cs:56-91).
9. **05-face-meshing.** Project through pcurves when the file has them, else inverse-evaluate with refinement; unwrap
   periodic parameters per loop with explicit seam and pole rules; make the mapping stateless (CylinderMap.cs:14-15,42-46).
10. **05-face-meshing.** Triangulate in the parameter domain with a surface-derived metric; add interior points until the
    chordal deviation holds; guard every specialised path by an exact cover check with a general fallback
    (RingBandTriangulation.cs:35-40; FaceSetBuilder.cs:173; lesson 13).
11. **05-face-meshing.** Decide the winding once from surface normal and sense and check each triangle against it;
    `ShellMesher.Oriented` already tests each triangle against the loop's Newell normal (sdk/MeshAlgorithms/ShellMesher.cs:93-97).
12. **06-mesh.** Keep provenance in the mesh (source face per triangle, model edge or vertex per boundary vertex) and
    index vertices by origin, so welding by position is unnecessary; `TriangleMesh3D` carries none (FaceSetBuilder.cs:245).
13. **07-validation.** Test each constraint group by its definition, including what is untested today: directed-edge
    pairing, Euler characteristic, vertex-to-surface residual, chordal and angular deviation, minimum angle (Section 2;
    TopologyOracle.cs:8-23).
14. **07-validation.** Prefer closed-form oracles (volumes of box, cylinder, sphere, torus; areas of plane and cylinder
    faces) computed in double relative to a local origin over agreement with another mesher; `AnalyticalOracle` covers
    box, cylinder and hollow rectangle only (lesson 9).
15. **07-validation.** Give every oracle a rejecting witness before it guards anything, and make each expected value
    cite a closed form or a clause of the standard (lessons 4, 10).
16. **08-pipeline.** Isolate failure per face, return partial results with diagnostics, and keep floors as ratchets that
    name each floor below its target as an open item (GeometryDispatcher.cs:77-81; `bench/ifc-mesher/ratchets.json`).
17. **05-face-meshing and 06-mesh.** Quads have no precedent in this code. Plan them as a separate stage over the
    triangulation, or a structured grid on a rectangular parameter region, with planarity and convexity checks from the
    start (Section 2, G3).

## Unverified and not understood

- No repository test was run; test counts are from attributes. The probes of lessons 1, 5, 10, 12 are the only
  executions. Lessons 13 and 14 and the T-junction claim of lesson 11 rest on reading alone.
- `FaceSetBuilder.cs:65-81` keeps a per-face `indexMap` in front of the per-solid `pointMap`; I found no behavioural
  effect beyond caching.
- Why an inner `IFCFACEBOUND` with `.F.` should flip the entire face (FaceBounds.cs:32-33) is not explained by
  any comment or test; the test comment (WindingTests.cs:84-85) concerns planar shells only.
- Noticed outside the B-rep core, not run: `Conics.EvaluateEllipse3D` drops z (Conics.cs:55-56); trimmed curves on
  other basis curves read parameters as sample-index fractions (TrimmedCurves.cs:139-141,169-171).
- `ModelComparer`'s weights (`ModelComparerOptions.DefaultWeights`) were not read, so the parity numbers are quoted,
  not interpreted. The older progress notes ([H]) are theories until reproduced.
