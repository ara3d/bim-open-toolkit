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

## Results

Each run pastes its section here: method, numbers, verdict (yes, no, maybe), effort estimate, payoff estimate, what would change the verdict.

### Step 0: baseline on the regenerated library

(pending)

### Run F: idea 14, geometry repeats (spike, 2 h box, throwaway program over the decoder)

Method (ran): a console program against the committed decoder (`StepModel`, `DecodeRaw`; `PrepareModel` not needed, so all 88 files decode; the corpus pass took 20 s). Fingerprint per face: surface kind, loop count, per loop the rotation-normalised sequence of (curve kind, edge length quantised to 1e-4 of the bounding-box diagonal, circle radius the same way); dihedral angles skipped. Cost proxy: edge count squared. Units: 18 files with diagonals over 1,000 taken as micrometres (`LengthFactor` is 1 in every file).

Numbers: within one file a cache would skip 84% of source faces by count but only 23% of the cost proxy (33% of the proxy sits in repeated faces); across the corpus 36 to 40% of the proxy is saved (45 to 51% in repeats), half of it from re-exports and variants of one product. 74% of the proxy sits in 111 faces with 80 or more edges, 76% of whose cost is unique. The faces that repeat most are four-line rectangles and two-arc cylinder strips. Instancing is separate from fingerprinting: 192,457 decoded faces against 118,182 source faces (idea 19).

Verdict: **maybe**, between the plan's lines (over 50% by cost is a yes, under 20% a no). Owner decision 4 stays at its default, no.

Effort: an in-memory within-file cache in the host, 3 to 5 days; a certified cache in Plato with a persistent store, 1.5 to 3 weeks (registration, provenance re-basing, edge agreement with neighbours that are not cached, a tolerance-equality law because placed copies are not bitwise equal).

Payoff: shrinks as the algorithmic ideas land: at the 0.4 ms per face target a cache saves about 35 s over the whole corpus.

Would change it: to yes if TKT-349's fix leaves face time superlinear in edge count, or the owner's workload re-meshes product families; to no if step 0's measured time share of repeated faces is under 20%.

## Final table

(pending: one row per idea and new idea with verdict, method used, effort, payoff, evidence in one line, ticket id for each yes)
