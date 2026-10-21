# STEP mesher speed ideas: evaluation plan and results

Status: plan written 2026-10-21; evaluation runs follow in the same document
Ticket: TKT-323 (epic)
Input: `docs/plans/step-mesher-brainstorm-2026-10-21.md` (18 ideas, 4 tensions, 5 approaches, 5 owner decisions)
Baseline to beat: `docs/plans/step-mesher-corpus-2026-10-19.md` (26 to 90 ms per edge, 3 to 14 ms per plane face, 86 s to over 8 minutes on faces with 80 to 212 boundary edges), measured on a library that predates the complexity sweep (`docs/plans/step-mesher-complexity.md`, 41 chunks merged)
Targets: 0.1 ms per edge, 0.4 ms per analytic face, no face over 1 s

## What this evaluation decides

For each idea: is the effort reasonable, is there a payoff, and how big is it against the targets. Nothing is wired into the library here. A yes becomes a ticket; a maybe names what would settle it; a no names the evidence. The five owner decisions stay questions, with the brainstorm's default marked.

Two facts shape every method:

1. The committed compiled library (`deps/bim-open-data/src/data/Ara3D.StepBrep`, header `Plato 128cf769 and bim-open-toolkit 91e6b055`) predates the sweep's 41 merges and still carries the lazy `MapRange` (`Intrinsics/Integer.cs` line 87, `new ReadOnlyList<T>(..., i => f(i))`; the Plato checkout fixed it in `dcbec43d`, TKT-350). Every measurement therefore starts from a regeneration (step 0), or it measures code that no longer exists.
2. 72 of the 88 corpus files throw in `PrepareModel` on their first B-spline edge (TKT-348, open), so measurements run on the 16 files that get past it (the 9 that meshed in October plus the 7 that hung), and B-spline ideas (12) can only be read, not measured, until TKT-327 or TKT-348 lands.

## Methods

| Code | Method | Cost |
|---|---|---|
| R | Read-only estimate from the Plato source, the generated C#, and the sweep's ledger | under 1 h |
| M | Measurement on the regenerated library through the corpus harness (step 0) | the harness run |
| S | Throwaway spike outside the library: a console project or script in the scratchpad or `X/` export, never committed | under 2 h |
| P | Proof of concept in a staging folder `sandbox/step-mesh-staging/eval-<idea>/`, new files only, with an agreement law against the general path; committed by path | under 4 h |
| D | A decision the owner must make; the evaluation supplies the number the decision needs | none |

Evidence standard, from `platonic:investigate`: every number says how it was obtained (ran, source, inferred). A yes needs a measured or source-counted payoff against the target and an effort estimate under the plan's budget; a no needs the measurement that rules the gain out or a law the idea would break; a maybe names the missing fact.

## Step 0: the denominator (dependency of every M item)

Method M, time box 3 h, one agent.

1. Regenerate: `deps/bim-open-data/tools/regen-step-brep.ps1 -PlatoCli C:/Users/cdigg/.plato-cli/e37c032f/Plato.CLI.dll` (the pinned CLI; the runtime copied from the Plato checkout's `src/Plato.Intrinsics` brings the materialised `MapRange`). Record the header line's commits. Do not commit the regeneration itself (the C# wiring track owns that under TKT-313); the harness only.
2. Build `Ara3D.Step.Mesher` Release with the regenerated library, through the `X/` export recipe of the corpus document's "How to rerun" so `deps/bim-open-data`'s working tree is left alone.
3. Harness: a console project under `deps/bim-open-data/tools/step-corpus-harness/`, the corpus document's throwaway harness made permanent, with a timing mode that records per edge (index, curve kind, adjacent surface kinds, segment count, milliseconds) and per face (index, surface kind, loop count, edge count, whether every edge is a line, triangle count, milliseconds, stage split where the generated functions allow: region, chart, triangulation, refinement, lift) to CSV, and a `--parallel` flag that runs `Rows` through `Parallel.For` (feeds idea 7). Commit it in `deps/bim-open-data` by path with the trailers.
4. Baseline on three files: `SHO/EMMY-W1` (399 faces, fully meshed), `SHO/NINA-B400` (913 faces), `POS/ODIN-W160` or `LILY-W131` (a TKT-349 file), with a 600 s limit per file. Report per-edge and per-face medians and 95th percentiles by kind, the slowest ten faces, and the file totals, against the October numbers.

Evidence it produces: the new baseline table below, and the kind-by-time breakdown that items 1 to 3, 9 and 11 divide into.

## Plan, one row per idea

| # | Idea | Question | Method | Yes if | No if | Time box | Depends on |
|---|---|---|---|---|---|---|---|
| 1 | Kind-pair certificate table (line on plane, circle on plane, line on cylinder ruling, circle on cylinder): skip `UsableImages` and the raise | What share of edge time is on edges of those pairs after the sweep, and how much of that time is the image test and raise rather than the sample evaluation itself? Does the theorem hold (image deviation is identically zero) in the library's own terms, including tolerance widening? | M (share by kind from step 0) + R (`termination-discretize.library.plato`, `discretization.library.plato`: the per-edge call tree on a line-on-plane edge, counted) + P (a staged `DiscretizeCertified` that returns the general result on the four pairs with `Law_Eval_CertifiedEqualsGeneral` on every witness edge; only if M shows the share is over 50% of edge time) | the four pairs hold over half of edge time and the certified path removes over 80% of a line-on-plane edge's cost, with the law passing bit-for-bit | the sweep already brought line-on-plane edges under 0.2 ms, or the certified path differs from the general path on a witness | 4 h (1 h M+R, 3 h P) | step 0 |
| 2 | Rectangular plane face lifts to two triangles; skip simplicity, chart, CDT, refinement | What share of face time is on single-loop plane faces whose edges are all single-segment lines, and how many of those have four edges? What does `MeshFace` cost on one, stage by stage? | M (step 0's face table: count and time of `plane, 1 loop, all lines, 4 edges`, and of `plane, 1 loop, all lines, n edges` as the next ring) + R (which of the five stages a rectangle pays for; whether `RefineToSurfaceByInsertion` runs its angle pass on planes, owner decision 3) | rectangles plus straight-edged plane faces are over 30% of face time and the general path costs them over 0.4 ms | they are under 0.1 ms already or under 10% of face time | 2 h | step 0 |
| 3 | Full cylinder and hole: band between two circles with equal counts as a structured strip (`QuadGrid`) | How many cylinder faces are bands (two circular loops, or one loop of two circles and two seam lines), and what do they cost now? | M (step 0: cylinder faces by loop signature and time) + R (`QuadGrid`'s signature in layer 05, whether a band's two circles get equal counts under the current raise, which the strip needs) | bands are over 20% of cylinder face time and the strip removes the CDT and refinement | counts differ between the two circles on most bands (then the strip needs a stitch, and the idea becomes idea 11's business) | 2 h | step 0 |
| 4 | Lazy meshing: keep the `UvRegion` and a needs-refinement flag, lift on demand | Which caller could defer, given the corpus criterion and closed-shell validation need every face? | R (layer 08's `MeshModel` contract and the host's `MeshFile`; which validation checks read the lifted mesh) + D | a caller exists that reads only some faces (a viewer frustum) and refinement is over half of face time | every current caller needs every face, so the only saving is refinement time, which idea 2 and owner decision 3 take anyway | 1 h | none (shares the R with 15) |
| 5 | Memoize image points per (edge, face) once per model, shared by layer 4's tests and layer 5's `LoopToUv` | Done by the sweep? E1 (TKT-364) built `EdgeFaceTable` and `UsableImagesIn`; R5 (TKT-387) carries end points and images down the bisection; what remains is `LoopToUv` re-projecting every edge sample in layer 5 | R (count `Project` calls per edge sample across layers 4 and 5 after the sweep: `discretization.library.plato` `ImagePoints`, `uv-regions.library.plato` `LoopToUv`) | layer 5 still projects every sample a second time and projection is over 20% of face time on curved faces | the chart reads the discretization's stored images | 1 h | step 0 for the share; the count is read-only |
| 6 | Spatial hash over boundary segments for simplicity and point location | Done: F2 (TKT-361) `CollidingSegments` on a uniform grid, shared by `IsSimpleRegion` and `SelfIntersectionRequests`; R4 (TKT-386) visibility by segment grid in the CDT; R1 left `IsStrictlyInside` as a whole-boundary scan per candidate (debt noted in the ledger) | R: confirm from the ledger and the merged source; name the remaining scan and its share | the remaining `IsStrictlyInside` scan shows in step 0's refinement stage time on big faces | it does not | 0.5 h | none |
| 7 | Host `Parallel.For` over `Rows` | Is the generated code free of shared mutable state (static caches, `List` builders shared across calls), and what speed-up does the harness's `--parallel` give on the three files? | M (step 0's `--parallel` flag, both files timed both ways) + R (grep the generated C# and the intrinsics for `static` fields and `ThreadStatic`) + D (owner decision 2, default yes) | the three files run over 4x faster on the owner's machine with identical meshes (vertex and triangle counts, and the mesh hash, equal) and no shared state is found | a static cache or a nondeterministic result appears | 1 h beyond step 0 | step 0 |
| 8 | Speculative general CDT on a thread while the fast-path predicate decides | Is any fast-path predicate slow enough that racing it pays? | R: the predicates of ideas 1 to 3 are kind tests and counts, O(1) or O(edges of the face) | a predicate costs a measurable fraction of the general path | the predicates are microseconds (expected) | 0.25 h | 1, 2, 3 |
| 9 | SIMD: `MeanSpeed`'s 63 samples and the three-fractions-per-segment loops as `Number8` batches in the intrinsics | After R7 (`MeanSpeedBoth` from one sample set) and R5, what share of time is in those loops? | S: a sampling profile of one file (`dotnet-counters` is not enough; use `dotnet-trace collect` if installable, else a Stopwatch split in the harness around the generated `MeanSpeedBoth` and the segment-criteria loop) | the two loops are over 25% of the file's time and a `Number8` batch exists in the intrinsics or costs under 2 h to add | they are under 10%, or the profile shows time in allocation and `Take` copies rather than arithmetic | 2 h | step 0 |
| 10 | Integer-snapped chart coordinates at 2^30: exact orientation and in-circle in `Int128`; coincident points hash equal | Is there a robustness defect that names floating predicates, and what share of time is in `InCircleOfSorted` and the orientation tests? | R (tickets and `reviews/FINDINGS.md` for sliver, flip-loop or in-circle failures; the profile from item 9) + D (owner decision 5, default defer) | a robustness defect exists and the snap keeps both engines bit-identical (the interpreter must snap the same way) | no defect and the predicates are under 5% of time | 1 h | 9 |
| 11 | Coarse-first count from the pcurve's curvature bound, then one confirming test instead of a doubling search | How many raise iterations does an edge take now (after TKT-346's bounded raise, R6's heap), by kind? Is the closed-form count (`ConicSegmentCount` exists for conics) already the first trial? | M (step 0: segment count and, if the harness can read it, trial count per edge) + R (`RaisedForImagesBounded`'s first trial and the closed forms in `discretization-edge-domain.library.plato`) | edges average over two trials and a curvature bound gives the final count on the first trial for over 80% of edges | lines take one trial (expected: the count is 1) and circles start from the closed form already | 1.5 h | step 0 |
| 12 | Sampled grid or SDF seed per B-spline surface, Newton-polished projection | I3 (TKT-380) seeded the projection along an edge (`ProjectAlong`) and I4 cached the jet; what is left is the first point's global search per edge, O(Pu Pv) evaluations. How many edges per B-spline face pay it, and is a per-surface grid built once cheaper than the per-edge global search? | R only (no corpus file with a B-spline surface gets past `PrepareModel`, TKT-348): count the global searches per face from `ProjectAlong`'s callers and estimate with the knot counts of a corpus B-spline surface read from the raw decoded model (the harness's decode step reaches it) | the per-edge global search dominates a B-spline face by the count and a 33x33 grid built once per surface costs less than the edges' searches summed | edges per face times Pu Pv is under the grid's cost, or TKT-327 changes the projection anyway | 1.5 h | none |
| 13 | Group technology: classify faces into families by (surface kind, loop signature) once; one process plan per family | This is the dispatch that ideas 1 to 3 need: a signature computed once per face. What is the family histogram of the corpus files that decode? | M (step 0's face table gives the signature; a histogram over the 16 decodable files, with the time share of the top ten families) | the top five families hold over 80% of face time (then one fast path per family is the right unit of work) | the histogram is flat | 1 h beyond step 0 | step 0 |
| 14 | Glyph cache: fingerprint repeated pads and fillets across files, reuse meshes with re-based provenance | How much geometry repeats, within a file and across the corpus, by a fingerprint of (surface kind, loop signature, sorted edge lengths and angles quantised to tolerance)? | S: a throwaway program over the raw decoded models of all 88 files (decode reaches every file; `PrepareModel` is not needed for a fingerprint) counting distinct fingerprints against faces, and the time share of repeated faces from step 0's table on the three files + D (owner decision 4, default no) | over 50% of faces by time are repeats and the owner accepts a cache | repeats are under 20% of face time | 2 h | step 0 for the time share; the count needs only the decoder |
| 15 | Cartography generalisation: mesh coarse, refine only tiles the viewer zooms into | Same question as 4, for the viewer | R, shared with 4 + D | as 4 | as 4 | 0 (in 4) | 4 |
| 16 | Extreme, one millisecond per file: only 1, 2, 7 survive; a million faces: shared structures read-only after one build | A framing, not a change: does the sweep's set of once-per-model tables (G1, E1, V1 to V5) satisfy "read-only after one build pass" for idea 7? | R, folded into 7's static-state check | n/a | n/a | 0 (in 7) | 7 |
| 17 | Extreme, a day per file: exact predicates and Hausdorff validation everywhere | A framing for 10: which checks are cheap enough to keep always? | R, folded into 10 | n/a | n/a | 0 (in 10) | 10 |
| 18 | Deliberately bad (uniform fine grid then decimate) and its inversion (boundary polygon alone, points added only when a criterion proves it necessary) | The inversion is what ideas 1 and 2 do; nothing to evaluate alone | none; recorded as the rationale of approach 1 | n/a | n/a | 0 | none |

The five approaches are covered by their ideas: approach 1 by items 1, 2, 3, 11, 13; approach 2 by 5, 6, 12, 14; approach 3 by 7, 8, 9; approach 4 by 10, 11; approach 5 by 4, 15. No approach needs an experiment its ideas do not.

## Grouping into agent runs

| Run | Items | Agent | Time box |
|---|---|---|---|
| A | step 0 | one opus agent | 3 h |
| B | 1, 11, 13 (edge and face kind breakdown; the certified-edge proof of concept if the share justifies it) | one opus agent, after A | 4 h |
| C | 2, 3, 8 (face fast paths from step 0's face table and the layer 05 source) | one opus agent, after A | 2 h |
| D | 7 and 16 (parallel run through the harness, static-state grep) | one opus agent, after A | 1 h |
| E | 9 and 10, 17 (profile of one file; predicate share; robustness defects) | one opus agent, after A | 2 h |
| F | 14 (fingerprint spike over the decoder) | one opus agent, can start with A (needs only the built decoder, which A also builds; it builds its own copy from the `X/` export) | 2 h |
| G | 4, 15, 5, 6, 12, 18 (read-only) | one opus agent, can start before A | 2 h |

Runs B to F wait for A's regenerated build and harness; G and F's decoder part do not.

## Owner decisions (unchanged from the brainstorm; the evaluation supplies numbers)

| Decision | Default | Number this evaluation supplies |
|---|---|---|
| Fast paths in Plato as certified branches, or in the C# host before the library call? | Plato, each with a law | item 1's proof of concept shows the law shape and cost |
| May the host run edges and faces on all cores now? | yes | item 7's speed-up and static-state check |
| Should the angle-quality pass run on planar faces in version 1? | off for planes | item 2's stage split on a plane face |
| Is a cross-file mesh cache keyed by geometry fingerprint acceptable? | no, until repeats dominate | item 14's repeat share |
| Should integer-snapped predicates replace floating ones? | defer until a defect names them | item 10's defect search and predicate share |

## New ideas

Numbered from 19, recorded as they come up during the evaluation.

| # | Idea | Came from | Status |
|---|---|---|---|
| 19 | Instance-aware meshing: mesh each source face once and place each occurrence by its `StepSource.Occurrence`, no fingerprint needed. Run F found 192,457 decoded faces but 118,182 source faces over the corpus: the 74,275 copies are 38.6% of faces and 16.8% of the cost proxy. Needs a spike that decode-time folding of mirrored occurrences and the whole-model tolerance do not make copies differ | run F (idea 14) | recorded; evaluated under 14's verdict |
| 20 | Hybrid: the faces that repeat most are four-line rectangles and two-arc cylinder strips, which approach 1's fast paths (ideas 2, 3) mesh in microseconds, so the fast paths cover most count-based repeats with no cache | run F | recorded; folds into 2 and 3 |
| 21 | Corpus hygiene: six files are exact duplicate exports of another (AP203/AP214 pairs of LEA-M8F, MAX, SAM, ZOE_S-LGA51; SARA-G3xx-02 against SARA-N2; two M2-JODY-W377), so per-file averages double-count them; name them in the corpus runner | run F | recorded; one line in the corpus runner's README when it lands (TKT-313) |
| 22 | Rewire the host to the sweep's once-per-model forms: `StepPlatoMesher.MeshFile` calls `CanDiscretize` (runs `Law_IndicesInRange` over every table per edge; G1 hoisted it), `Discretize` -> `DiscretizeBounded` -> `UsableImages` -> `EdgeImages` -> `FacesOfEdge` (a scan of every face per edge, `EdgeDomain` recomputed; E1 and E2 replaced both), and `IsDiscretizedFace` -> `IsEveryIndexInRange` per face (G2 replaced it). Build `EdgeFaceTable`, `TwoEdgeLoopEdges`, the in-range and arena-ok flags once, then the ranged per-row entries, keeping per-row exception isolation. About 1 h | run G | **yes**; the harness's hoisted path (run A) measures the gain; ticket below |
| 23 | Bit-identical memo of the global-search grid per B-spline surface: on a finite domain `SearchWindow` returns the domain, and `WindowCuts` and `PieceSamples` depend only on the window and the knots, so `ProjectBySearchBody`'s Gu x Gv grid is the same for every query and can be built once per surface; a query then costs Gu·Gv distance tests plus the polish. About 3 to 4 h | run G (idea 12) | the form idea 12 should take |
| 24 | Seed `SurfaceDistance` from the known uv in the refinement test (`CentroidPointTest`, `SideSampleOf` in `refinement-test-cached.library.plato` already hold the triangle's uv centroid or the side's uv midpoint): `ProjectNear` from there replaces the global search, still an upper bound on the distance so refinement stays conservative; bits change, verdicts to re-establish. About 1.5 h | run G (idea 12) | the larger half of idea 12's gain (refinement is about 85% of a B-spline face's global searches) |
| 25 | Defer CDT, refinement and lift to the end of `MeshModel`'s refinement loop: requests depend only on the region (`CollidingSegments`, `CoarseSegmentRequests(region)`, `QuadCountRequests(grid)`), so every CDT, refinement and lift of a face meshed again in a later round is discarded; deferring is bit-identical because `MeshFace` is pure. About 2 h. Gains nothing in the host until it runs the loop | run G (idea 4) | maybe; needs step 0's count of rounds and re-meshed faces |
| 26 | Closed-form chart speeds for planes and cylinders: skip the 126 partial evaluations of `KeptSamplesCounted` (2 x 63), the largest fixed cost of a plane face (about 85% of a square's surface evaluations by count); bit-identical on planes only when the axis vectors have length exactly 1.0 | run G (idea 4's operation count) | folds into idea 2 |
| 27 | Small evaluation savings: `BelowAngleCounted` re-evaluates 3 corners per tested triangle although R1's `PositionedTriangulation` carries them; `EdgeFindingsGiven` repeats the per-image probe `UsableImagesGiven` just ran (6 projections where 3 suffice) | run G | debt, under 1 h each |

## Results

Each run pastes its section here: method, numbers, verdict (yes, no, maybe), effort estimate, payoff estimate, what would change the verdict.

### Step 0: baseline on the regenerated library (run A, 50 min of a 3 h box after a restart)

Regeneration: header `Plato 2847ef71 and bim-open-toolkit 7678b40b`, 1,407 generated files, 13 runtime files, 128 s; `Intrinsics/Integer.cs` now materialises `MapRange`; one function the compiler could not translate is a throwing stub, `BisectionCached.SagittaByHullBoundGiven`, not reached by any file below. The regenerated folders are left uncommitted in `deps/bim-open-data` (the C# wiring track, TKT-313, owns that commit). A first attempt failed because a layer 08 law called layer 09's `ReasonName`; fixed by moving it to layer 04 (toolkit `7678b40b`) and making `regen-step-brep.ps1` print the compiler log under PowerShell 5.1 (bim-open-data `69df899`).

Harness: `deps/bim-open-data/tools/step-corpus-harness/` (bim-open-data `0f5090f`, `109f78c`; not in `BimOpenData.sln`, which another session has open). Modes `one`, `all`, `time`; flags `--path hoisted|host|meshfile`, `--parallel`, `--warmup`. `hoisted` builds the sweep's once-per-model tables then meshes each row; `host` is `StepPlatoMesher.MeshFile` as committed. Host, hoisted, parallel and `MeshFile` give identical meshes (vertex count, triangle count, position hash) on every file. Two problems met: the generated `Any` and `All` collide with LINQ's in a consumer with implicit usings (CS0121; the harness names `Enumerable.Any`), and small files are JIT-dominated cold (EMMY-W1 1.5 to 2.7 s cold, 0.58 s warm), so baselines use `--warmup`.

**Baseline, hoisted path, sequential, warm, 600 s limit; every file finished, no edge or face threw, every face meshed:**

| File | Edges | Faces | Total ms | Edges ms | Faces ms | Parse, decode, prepare ms | October |
|---|---|---|---|---|---|---|---|
| SHO/EMMY-W1 | 873 | 399 | 577 | 29 | 454 | 84 | 10,578 |
| SHO/NINA-B400 | 1,864 | 913 | 690 | 38 | 529 | 129 | 7,432 |
| ODIN-W160 | 7,767 | 3,552 | 2,751 | 197 | 1,939 | 570 | not finished at 120 s; 358,318 at 600 s |
| LILY-W131 | 2,090 | 960 | 1,344 | 156 | 1,035 | 118 | not finished |

Per edge (median / p95, ms): line 0.016 to 0.024 / 0.030 to 0.054; circle 0.034 to 0.047 / 0.05 to 0.18; ellipse (ODIN, 4 edges) 0.12 / 0.25. **The 0.1 ms edge target is met at the p95.** Per face (median / p95, ms): plane 0.14 to 0.23 / 0.43 to 0.78; cylinder 0.9 to 6.2 / 9 to 84; sphere (ODIN) 5.6 / 6.5; torus 0.36 to 0.96 / 0.5 to 1.4; cone (ODIN, 1 face) 4.8. **The 0.4 ms analytic face target is met at the plane median, not at the p95 and not on cylinders; no face is over 1 s** (the slowest is 113 ms). The ten slowest faces per file are four-edge single-loop cylinder faces at 31 to 113 ms, then the 80-edge planes of ODIN (2068, 2109) at 76 to 80 ms, down from 86 s each in October, and LILY's 13-loop 102-edge plane at 60 ms.

**Host path against hoisted (warm):** EMMY-W1 818 against 577 ms, NINA-B400 2,333 against 690, LILY-W131 3,133 against 1,344, ODIN-W160 30,499 against 2,751 (11x; the host's median edge is 2.9 ms against 0.017). `CanDiscretize` is 69 to 73% of the host's edge time and `IsDiscretizedFace` 11 to 62% of its face time. This is TKT-402 (idea 22): `DiscretizeAllRanged`'s tables, `DiscretizeEdgeRangedCounted` per edge, `IsDiscretizedFaceIn` per face; `MeshPath.Hoisted` in the harness shows the calls.

**Stage split (share of face time):**

| File | Region | Chart | Simple | Triangulate | Refine | Lift | Advisory |
|---|---|---|---|---|---|---|---|
| EMMY-W1 | 5% | 2% | 2% | 4% | 81% | 2% | 3% |
| NINA-B400 | 8% | 4% | 5% | 7% | 68% | 3% | 4% |
| ODIN-W160 | 7% | 4% | 3% | 6% | 73% | 3% | 5% |
| LILY-W131 | 4% | 2% | 2% | 4% | 82% | 2% | 3% |

Every face takes the triangulate-and-refine branch: the host's criteria set `PreferQuads` false, so the quad-grid branch never runs. Every family's largest stage is refine, except torus (region).

**Face families over the four files (5,824 faces, 3,952 ms, 21 families; the top five hold 82% of face time):**

| Surface | Loops | All lines | Edges | Faces | ms | Share | Median ms |
|---|---|---|---|---|---|---|---|
| cylinder | 1 | no | 4 | 239 | 1,821 | 46.1% | 3.9 |
| plane | 1 | yes | 4 | 4,771 | 854 | 21.6% | 0.153 |
| cylinder | 1 | no | 9 to 16 | 36 | 247 | 6.3% | 6.4 |
| cylinder | 2 | no | 2 | 42 | 179 | 4.5% | 3.3 |
| plane | 1 | no | 65 and over | 2 | 156 | 4.0% | 80.2 |
| plane | 1 | no | 5 to 8 | 140 | 131 | 3.3% | 0.71 |
| plane | 1 | no | 1 | 70 | 95 | 2.4% | 1.2 |
| plane | 1 | no | 4 | 230 | 89 | 2.2% | 0.16 |
| plane | 2 | no | 9 to 16 | 9 | 74 | 1.9% | 3.4 |
| plane | 13 | no | 65 and over | 1 | 60 | 1.5% | 60.3 |

The four-line rectangle (idea 2) averages 0.179 ms: refine 0.055, region 0.033, triangulate 0.021, chart 0.020; 4,729 of 4,771 come out as exactly two triangles. The four-edge cylinder face (idea 3) averages 7.6 ms, 7.24 of it refine.

**Edge families (414 ms over 11,700 edges; edges are about 10% of meshing time):** line on plane+plane 11,112 edges, 85.1% of edge time, median 0.018 ms, 1 segment; circle on cylinder+plane 744, 9.7%, 0.042 ms, 7 segments; line on cylinder+plane 694, 3.8%, 0.019 ms; circle on cylinder+torus 24, 0.8%, 0.170 ms; six other kinds, 20 edges, 0.5%. Idea 1's four kind pairs hold about 99% of edge time.

**Parallel against sequential (warm, 22 logical processors, identical meshes):**

| File | Seq total ms | Par total ms | Seq faces ms | Par faces ms | Face speed-up |
|---|---|---|---|---|---|
| EMMY-W1 | 577 | 347 | 454 | 218 | 2.1x |
| NINA-B400 | 690 | 416 | 529 | 242 | 2.2x |
| ODIN-W160 | 2,751 | 1,197 | 1,939 | 362 | 5.4x |
| LILY-W131 | 1,344 | 492 | 1,035 | 306 | 3.4x |

Whole-file speed-up stays under 4x because parse, decode and prepare run in series (84 to 570 ms) and on the small files one 50 to 110 ms cylinder face is a floor.

Outputs: `scratchpad/baseline/<file>.{seq,par,host}.{edges,faces}.csv`, the summaries, `seq.md`, and `scratchpad/analyse.py`.

### Runs B and D, decided from run A's tables (ideas 1, 11, 13, 7, 16; no further agent)

**Idea 1, kind-pair certificate table.** Method M (step 0's edge families). The four pairs hold about 99% of edge time, as the brainstorm expected, but the sweep (G1, E1, E2, R5, R6) took the cost out from under them: a line on two planes is 0.018 ms median with one segment, a circle on cylinder and plane 0.042 ms with seven, and all 11,700 edges of the four files take 414 ms, about 10% of meshing time. The edge target of 0.1 ms is met at the p95 (0.03 to 0.07 ms). A certified path could remove most of the 0.018 ms, which is about 8% of meshing time on these files. Verdict: **no** for now. Effort would be 3 to 4 h (the staged `DiscretizeCertified` and its agreement law). Payoff under 10% of file time. Would change it: a profile after the face work lands that puts edges back over 25% of time, or a file whose edges are mostly circles and ellipses.

**Idea 11, coarse-first count from the curvature bound.** Method M and R. The harness records segments, not trials; lines end at one segment, so they pass their first trial, and circles end at a count the raise reaches from `ConicSegmentCount`'s closed form (source: `discretization-edge-domain.library.plato`). The ceiling on the gain is the circle share of edge time, 9.7% of 10%: about 1% of meshing time. Verdict: **no**. Would change it: nothing on this corpus.

**Idea 13, group technology.** Method M. The face-family histogram is in the step 0 section: 21 families over the four files, the top five holding 82% of face time, the top one (cylinder, one loop, four edges) 46% alone. The histogram is the dispatch table the fast paths need, so the idea is less a change than a measurement to keep: the harness's family CSV is it. Verdict: **yes as a measurement, no code**: the family signature is what idea 3's predicate computes. No ticket; the harness already produces the histogram.

**Idea 7, host `Parallel.For`.** Method M (the harness's `--parallel`): face stage 2.1x to 5.4x, whole file under 4x (serial parse, decode and prepare; one 50 to 110 ms cylinder face as a floor on small files), identical meshes on every file; no static mutable state found on the path. The plan's bar of "over 4x on the three files" is met only on ODIN-W160's face stage, so the verdict is **yes** on the evidence that it is cheap (a loop in the host), safe (identical meshes) and compounds with everything else, not on the 4x. Owner decision 2 stays a question with default yes; the ticket carries it as a criterion. Ticket: **TKT-403**, after TKT-402 (the host rewiring, idea 22, which the same measurement showed is 11x on ODIN-W160). Would change it: a shared mutable cache appearing in the generated code (none today).

**Idea 16, read-only shared structures.** Folded into 7: the once-per-model tables (`EdgeFaceTable`, `TwoEdgeLoopEdges`, the in-range and arena-ok flags) are built once and read by every row; the harness's parallel run shares them with identical results. Confirmed.

### Run F: idea 14, geometry repeats (spike, 2 h box, throwaway program over the decoder)

Method (ran): a console program against the committed decoder (`StepModel`, `DecodeRaw`; `PrepareModel` not needed, so all 88 files decode; the corpus pass took 20 s). Fingerprint per face: surface kind, loop count, per loop the rotation-normalised sequence of (curve kind, edge length quantised to 1e-4 of the bounding-box diagonal, circle radius the same way); dihedral angles skipped. Cost proxy: edge count squared. Units: 18 files with diagonals over 1,000 taken as micrometres (`LengthFactor` is 1 in every file).

Numbers: within one file a cache would skip 84% of source faces by count but only 23% of the cost proxy (33% of the proxy sits in repeated faces); across the corpus 36 to 40% of the proxy is saved (45 to 51% in repeats), half of it from re-exports and variants of one product. 74% of the proxy sits in 111 faces with 80 or more edges, 76% of whose cost is unique. The faces that repeat most are four-line rectangles and two-arc cylinder strips. Instancing is separate from fingerprinting: 192,457 decoded faces against 118,182 source faces (idea 19).

Verdict: **maybe**, between the plan's lines (over 50% by cost is a yes, under 20% a no). Owner decision 4 stays at its default, no.

Effort: an in-memory within-file cache in the host, 3 to 5 days; a certified cache in Plato with a persistent store, 1.5 to 3 weeks (registration, provenance re-basing, edge agreement with neighbours that are not cached, a tolerance-equality law because placed copies are not bitwise equal).

Payoff: shrinks as the algorithmic ideas land: at the 0.4 ms per face target a cache saves about 35 s over the whole corpus.

Would change it: to yes if TKT-349's fix leaves face time superlinear in edge count, or the owner's workload re-meshes product families; to no if step 0's measured time share of repeated faces is under 20%.

### Run G: ideas 4, 5, 6, 12, 15, 18 (read-only, 1.3 h of a 2 h box)

Method: the merged `.plato` source of `sandbox/step-brep-mesh` and the host C#; the generated C# was not used (it predates the sweep). One read-only script counted B-spline knots across the corpus.

**Idea 5, memoize image points.** Layer 5 does not read stored images: `EdgeDiscretization` holds only `Edge`, `Parameters`, `Points` (source: `discretization.types.plato`), and `LoopToUv` -> `SamplesOfLoop` -> `CoedgeSamples` -> `ImagePoints` -> `CanonicalImagePoints` -> `ProjectAlong` projects every sample again (`uv-regions.library.plato` 168 to 220, `discretization.library.plato` 500 to 515). Count per sample per adjacent face: 1 in layer 4 (a line on a plane passes its first trial; a raise of k trials costs 2 to 4; the bisection path's anchors are a global `Project` per kept point and are thrown away), 1 in layer 5 per coedge use, plus 3 probe projections per edge (`UsableImagesGiven`) and 6 more in `MeshModel`'s findings; so **2 per sample per face plus 3 to 9 per edge**. Sharing would not be bit-identical: bisection anchors come from the global `Project`, layer 5 from the seeded `ProjectAlong`; on a seam layer 5 uses `ImageInFace`, layer 4 the pcurve images. On analytic surfaces a projection is a closed form (a plane's is two `LocalCoordinates` calls), while the chart alone costs 126 partial evaluations. Verdict: **no** on analytic faces, **maybe** on B-spline faces where idea 12 dwarfs it. Effort 4 to 6 h (image table in layer 04 written by the passing trial and the bisection, the refine path, the `CoedgeSamples` reader, a law that stored equals recomputed). Payoff under 5% of an analytic face (inferred from counts), nothing toward the edge target. Would change it: a profile with `ProjectAlong` over 20% on curved analytic faces.

**Idea 6, spatial hash.** Verdict: **done**. F2's `CollidingSegments` -> `CollidingSegmentsOnGrid` computed once in `MeshRegionOnce` serves both the verdict and `SelfIntersectionRequestsFrom` (`face-meshing-domain-once.library.plato` 162); R4's `TriangulateRegionCdtIndexedCounted` uses `SegmentGridOf`, `BridgeIsClearOnGrid`, `PointGridOf` with a linked ring; R3 replaced R1's `IsStrictlyInside` on the live path with `IsStrictlyInsideOnGrid` (`uv-boundary-index.library.plato`); the old form survives only in reference functions and laws. Remaining scans on the face path: `IsStrictlyInsideOnGrid` scans one grid row from the point's column on (about sqrt(B)) plus the whole `Everywhere` list of wide segments per query (R3's debt); O(B) and O(n^2) fallbacks when a tolerance is zero or a box is not finite; wide segments paired with every segment, O(W n); R4's ear order visits about B^1.5 points (earcut's resume-where-cut order fixes it but changes output); `OuterByContainment` -> `ContainsOtherLoops` O(L B) with `LoopContains` remapping the loop per call; and per pass (up to 40) `SurfacePassIndexedCounted` and `AnglePassIndexedCounted` each copy points and triangles and rebuild `NeighbourSlots` by sorting, O(T log T) twice per pass. Effort for the neighbour table carried across passes 2 to 3 h; payoff only on large faces, step 0's refinement stage time decides.

**Idea 12, B-spline projection grid.** Corpus census (ran, 14,184 of 14,564 `B_SPLINE_SURFACE_WITH_KNOTS` parsed): 96% are degree (3, 1), a cubic profile swept linearly; knot pieces Pu·Pv median 4, p90 16, p99 24, max 68; the plan's 8 x 8 bicubic assumption overstates the corpus about 10x. One global search (`ProjectBySearchBody`) costs about Gu·Gv + 2 + m(2i + h + 3) evaluations with Gu = Pu·clamp(64/Pu, 2, 8) + 1: about 330 on the median surface (33 x 9), 615 at p90, 4,255 on an 8 x 8. Global searches per B-spline face per round: G = sum over bisected edges (S_e + 1) + sum over conic edges (1 + trials) + E coedges + R, where **R is about 2.5 per tested triangle** (`SurfaceDistance` -> `Geometry.Project` from `CentroidPointTest` and `SideSampleOf` in `refinement-test-cached.library.plato`): I3's "one global search per edge" holds only for `ProjectAlong` callers, and refinement dominates. Worked median face (E = 4, S = 16 on two profile edges, T = 100): 292 searches, 85% from refinement, about 96k evaluations today against about 8.4k with a 33 x 33 grid and Newton polish (plus 318k grid distance tests), 8 to 10x fewer; on the 8 x 8 assumption over 100x. TKT-327's code merged in 09b8650f; its open criteria do not change the projection, so the idea is not moot. Verdict: **yes, but not as a 33 x 33 grid** (it changes every projection's bits and its 1,089-evaluation build exceeds three median searches): as ideas 23 and 24. Effort: idea 23 3 to 4 h, idea 24 1.5 h plus re-established verdicts, seeding the bisection anchors (R5's debt) 2 h. Payoff: bears on "no face over 1 s", inferred 5 to 10x on median B-spline faces. Would change it: a profile once TKT-348 lets B-spline faces mesh; pcurves present (curve searches instead of surface searches).

**Ideas 4 and 15, lazy meshing.** Every caller needs every face lifted: the host's `MeshFile` (every `FaceOutcome`, then `AssembleModelMesh` and `NumberMeshVertices`), layer 06's assembly, layer 07's `ValidateModelMesh` at the default `Geometric` level (structure and geometry checks read every element), the corpus criterion, and the viewer (no per-face request path). The one exception is inside `MeshModel`'s refinement loop (idea 25). Operation count of a rectangle plane face (B = 4, from source, not timed): region 8 closed-form projections and 4 `ImageInFace`; chart **126 partial evaluations** (`KeptSamplesCounted` 2 x 63); simplicity a 4-box grid; CDT one ear clip and about 6 flip tests; refinement `Positioned` (4 evaluations) and one pass with 2 list copies, 2 `NeighbourSlots` sorts and `BelowAngleCounted` (6 evaluations) that adds no point; lift about 4 evaluations and 8 partials. On a square, refinement is about 7% of about 150 surface evaluations and the chart about 85%; on a rectangle with aspect over sqrt(3) the 30 degree `RefinementMinAngle` fires the angle pass, up to 40 passes with 4 `TryInsertionIndexed` candidates per bad triangle, and refinement becomes most of the face. Owner decision 3 (angle pass off on planes, the default) removes the only case that meets the idea's threshold. Verdict: idea 4 **no**, idea 15 **no** until a viewer streams faces, idea 25 (in-loop deferral) **maybe**, effort about 2 h, payoff zero in the host today.

**Idea 18.** Agreed: the rationale of approach 1, nothing to evaluate alone.

## Final table

(pending: one row per idea and new idea with verdict, method used, effort, payoff, evidence in one line, ticket id for each yes)
