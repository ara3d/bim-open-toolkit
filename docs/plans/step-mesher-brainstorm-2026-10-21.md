# STEP mesher speed: brainstorm, 2026-10-21

Status: ideas recorded; evaluation plan to follow in `docs/plans/step-mesher-ideas-evaluation.md`
Ticket: TKT-323 (epic)

Produced by a read-only brainstorm agent at the owner's request, after the complexity sweep (`docs/plans/step-mesher-complexity.md`) was planned. The owner's prompts were: signed distance fields; lookup tables or fast paths for common patterns; divide and conquer; speculative parallel work; SIMD; integer or fixed-point arithmetic; low precision first then refinement; a precomputed octree or BVH; lazy meshing of uncut primitives.

## Goal

Bring triangle meshing of parsed STEP B-reps from the measured 26 to 90 ms per edge and 3 to 14 ms per face (worst faces minutes) to 0.1 ms per edge, 0.4 ms per analytic face, and no face over 1 s, on a corpus that is 84% lines and 81% planes, without giving up the laws (one polyline per edge, certified sagitta, both engines agree). The quadratic scans the complexity sweep removed are taken as done.

## What the hot paths did when read (before the sweep)

- Per edge (`04-discretization/termination-discretize.library.plato`): `UsableImages` builds a 3-point probe and projects it onto every adjacent face; `RaisedForImagesBounded` runs a doubling search where each trial rebuilds the whole discretization, re-projects every point, and evaluates the surface at 3 interior fractions per segment per image. For a line on two planes, the dominant case, every one of those numbers is zero by theorem.
- Per face (`05-face-meshing/face-meshing.library.plato`, `uv-regions.library.plato`): `LoopToUv` projects every edge sample again, `IsSimpleRegion` is all pairs, `MeanSpeed` evaluates 126 partials, CDT is ear clipping, and `RefineToSurfaceByInsertion` runs its 40-pass angle loop on planes (`planar` only disables the surface pass).
- Host (`deps/bim-open-data/src/data/Ara3D.Step.Mesher/Plato/StepPlatoMesher.cs`): `Rows` is a sequential loop; the functions are pure. The on-disk `Ara3D.StepBrep/Intrinsics/Integer.cs` still had the lazy `MapRange` fixed in Plato by TKT-350 but not regenerated, so every `d.Points[i]` read re-evaluated the curve.
- Real requirements: laws, bitwise-shared edge points, every criterion widened by the file tolerance. Assumed, not required: that the general path must run on every edge and face.

## Ideas

| # | Idea | Source prompt |
|---|---|---|
| 1 | Kind-pair certificate table: (line, plane), (circle, plane), (line on a cylinder ruling), (circle, cylinder) have zero image deviation by theorem; skip `UsableImages` and the raise | fast paths |
| 2 | Rectangular plane face: four straight single-segment edges, no holes, lifts to two triangles; skip simplicity, chart, CDT, refinement | fast paths |
| 3 | Full cylinder and hole: a band between two circles with equal counts becomes a structured strip, no CDT (`QuadGrid` exists) | fast paths |
| 4 | Lazy meshing: keep the `UvRegion` and a needs-refinement flag; lift on demand; uncut primitives keep a closed-form grid until a viewer asks | lazy meshing |
| 5 | Memoize image points per (edge, face) once per model, shared by layer 4's tests and layer 5's `LoopToUv` | shared structures |
| 6 | Spatial hash over boundary segments for the simplicity test and point location, extending the stdlib's `SpatialHashGrid2D` and `Bvh2D` (`stdlib/geometry/spatial-structures.types.plato`) | BVH; existing abstraction |
| 7 | Host `Parallel.For` over `Rows`; the functions are pure | parallel |
| 8 | Speculative: start the general CDT on a thread while the fast-path predicate decides; take the first finisher | speculative |
| 9 | SIMD: the 63-sample `MeanSpeed` and the three-fractions-per-segment loops as `Number8` batches in the intrinsics | SIMD |
| 10 | Integer-snapped chart coordinates at 2^30 so orientation and in-circle are exact in `Int128` and coincident points hash equal | integer |
| 11 | Coarse-first count from the pcurve's curvature bound, then one confirming test instead of a doubling search | low precision first |
| 12 | Sampled grid or SDF seed per B-spline surface, Newton-polished projection (the old mesher's 33x33 grid with lesson 12's refinement) | SDF |
| 13 | Manufacturing, group technology: classify faces into families by (surface kind, loop signature) once; one process plan per family | outside software |
| 14 | Typesetting glyph cache: fingerprint repeated pads and fillets across files, reuse meshes with re-based provenance | outside software |
| 15 | Cartography generalization: mesh coarse, refine only tiles the viewer zooms into | outside software (same as 4) |
| 16 | Extreme, one millisecond per file: only 1, 2 and 7 survive. Extreme, a million faces: shared structures must be read-only after one build pass (5, 6) | extreme |
| 17 | Extreme, a day per file: exact predicates and Hausdorff validation everywhere; shows which checks are cheap enough to keep always (10) | extreme |
| 18 | Deliberately bad: uniform fine grid then decimate (always valid, 100x the triangles, destroys edge sharing). Inversion: start from the boundary polygon alone and add a point only when a criterion proves it necessary, which is what certificate fast paths do | bad idea and inversion |

## Tensions

- Certified exactness versus skipped work: a fast path is admissible only as a theorem with a law that it equals the general path on witnesses, never as a heuristic.
- Pure Plato compiled to C# versus hand-tuned kernels: threads, SIMD and exact integer predicates live in the host or in `Intrinsics`, not in `.plato`, and both engines must still agree.
- Per-face independence versus shared structures: memoized image points and spatial hashes must be built once and read concurrently.
- Design-time versus run-time decisions: closed-form counts and kind tables decide before evaluation; the current code decides by measuring.

## Approaches

1. **Certificate fast paths** (ideas 1, 2, 3, 11, 13, 18): good for the corpus shape, where lines on planes and straight-edged plane faces are over 80% of the work; fails when the kind table has a gap (B-splines, revolution surfaces) and for faces with holes. Expected gain: line-on-plane edges from 26 to 90 ms to microseconds, rectangular plane faces to tens of microseconds, the general path left for under 20% of items. Touches `termination-discretize.library.plato` (`UsableImages`, `RaisedForImagesBounded`), `geometry-surfaces.library.plato` (kind predicates), `face-meshing.library.plato` (`MeshRegion` dispatch), plus one law per path.
2. **Shared read-only structures** (5, 6, 12, 14): good for the TKT-349 tail and B-spline projection; fails when rebuilt per face or mutated. Expected gain: simplicity from quadratic to linear, image points once instead of three times, B-spline faces from minutes to seconds. Touches `uv-regions.library.plato`, `discretization.library.plato` (`ImagePoints`), `triangulation-fast.library.plato`, the stdlib spatial types. (The complexity sweep has since done much of 5 and 6.)
3. **Host-side execution** (7, 8, 9): needs no Plato change and compounds with every other approach; fails to reach the targets alone (16 cores give 16x, not 500x). Expected gain 8 to 16x on an idle machine plus the intrinsics refresh. Touches `StepPlatoMesher.cs` and `Ara3D.StepBrep/Intrinsics`.
4. **Precision ladder** (10, 11, 17): robustness and fewer trials; fails the engines-agree law unless the interpreter snaps the same way. Small gain on this corpus, large on sliver-prone faces. Touches `triangulation-cdt.library.plato` predicates.
5. **Lazy and level-of-detail meshing** (4, 15): viewer latency, not throughput; fails the corpus criterion and closed-shell validation, which need every face. Touches layer 8 and the host contract.

## Recommendation

Approach 1, with approach 3's `Parallel.For` and the intrinsics refresh done first as the cheap baseline, since they change no Plato and give the next measurement its denominator. Order: refresh the intrinsics and regenerate; parallelize `Rows`; the (curve kind, surface kind) certificate table in layer 4 with the law "fast path equals general path on every witness edge"; the straight-edged plane face path in layer 5 with the same law shape. Approach 2 follows for the TKT-349 tail. Approaches 4 and 5 wait for a measurement that names them.

## Decisions for the owner

- Do fast paths live in Plato as certified branches, or in the C# host as a switch before the library call? Default: Plato, each with a law against the general path, so both engines agree. **Owner, 2026-10-21: Plato, with laws.**
- May the host run edges and faces on all cores now, before Plato has any parallel construct? Default: yes, failures still isolated per row. **Owner, 2026-10-21: no.** `Rows` stays single-threaded, so the recommendation's first step drops `Parallel.For` and keeps the intrinsics refresh.
- Should the angle-quality pass run on planar faces at all in version 1? Default: off for planes (the boundary is locked, so no angle guarantee exists anyway, MESHING-REQUIREMENTS finding 8). **Owner, 2026-10-21: off for planes.**
- Is a cross-file mesh cache keyed by geometry fingerprint acceptable given per-face provenance? Default: no, until a measurement shows repeated geometry dominates. (Not asked; the default stands.)
- Should integer-snapped predicates replace floating ones, changing bitwise results on both engines? Default: defer until a robustness defect names them. (Not asked; the default stands.)
