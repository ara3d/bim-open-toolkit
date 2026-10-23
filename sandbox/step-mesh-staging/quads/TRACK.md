# quads: more faces on the structured quad grid, fewer on the refined triangulation

Ticket: TKT-409
Status: ready: Q1, Q1b, Q2, Q3 (Q3's grid density waits on TKT-502's QF4) | dropped: Q3b | not started: Q4 (midpoint subdivision)

The owner asked on 2026-10-22 why NIST CTC 01's base fillets were meshed as dense, irregular triangles, and for clean quads by the fastest method. The grid (Coons interpolation of four sides, one surface evaluation per node) is linear in its output, with no point location and no refinement loop, so every face moved onto it is faster and regular. Order: curved sides (Q1), answered quad counts (Q1b), pole sides (Q3), sides of several edges (Q2), then midpoint subdivision of many-sided regions (Q4).

## Done
- Q1, ready: `QuadSidesCurvedIn` keeps `QuadSidesIn`'s answer when it is four-sided, else finds four corners where the outer loop turns by 30 degrees or more in the chart (u and v scaled by the face's mean speeds). `FaceQuadGridCurvedIn` is `FaceQuadGridIn` with it. Laws: `Law_Quads_MitredFilletNotFourSidedByStraightSteps` and `Law_Quads_MitredFilletIsAGridWithin` pass on CTC 01 face 85 (a cylinder fillet with a 45 degree mitre, an ellipse edge). No type added: the corners are the existing `QuadSides`.
- Q1b, ready: `HostAnswers(reason)` and `HostAnsweredRequests(rs)`: the host's refinement loop also answers `QuadCountMismatch`, so a four-sided face whose opposite sides have different segment counts takes the grid in the next round instead of the triangulation. Without it Q1 reaches only the fillets whose sides already match (CTC 01 faces 93 to 98), not 85 to 92.

Measured with the corpus harness (`time --warmup --parallel`) on a scratch regeneration of HEAD 07019d14's layers plus this folder, never committed (`artifacts/quads/`):

| File | Build | Triangulated faces | Triangles | Quads | Closed, oriented, contract |
|---|---|---|---|---|---|
| NIST CTC 01 | base | 42 | 1,926 | 530 | as base (the file's 42 non-manifold and 60 misoriented edges are the library's, unchanged) |
| | Q1 | 30 | 1,830 | 578 | same |
| | Q1 + Q1b | 16 | 1,614 | 650 | same |
| EMMY-W1 | all three | 28 | 248 | 392 | closed, same mesh hash |
| NINA-B400 | base | 31 | 412 | 1,006 | closed |
| | Q1 + Q1b | 26 | 396 | 1,018 | closed; four torus faces become 3 quads each |
| ODIN-W160 | base | 434 | 6,856 | 4,715 | closed |
| | Q1 | 414 | 6,744 | 4,743 | closed |
| | Q1 + Q1b | 402 | 6,838 | 4,899 | closed |
| LILY-W131 | base | 154 | 1,806 | 1,369 | closed |
| | Q1 + Q1b | 74 | 1,448 | 2,206 | closed |

Q1 alone changes no mesh on EMMY-W1, NINA-B400 or LILY-W131 (same hash). Whole-file times were not comparable: other sessions shared the machine, and decode time, which nothing here touches, ranged 190 to 640 ms on LILY-W131. Q1b's refinement round cost 0 to 213 ms per file (LILY-W131), against a face stage that fell from 515 to 255 ms there.

- Q2, ready: `SideIsEdgeRun` accepts a side whose inner points are edge samples or vertices (two edges meeting at less than a corner), and `MatchingFloorsBySide` floors such a side's first edge at its current count plus the shortfall, since `MatchingFloors` would give one edge the whole opposite count. Regions whose sides are each one carrier or a pole still go to `QuadGridOnSides` unchanged. Law `Law_Quads_CornerColumnIsAGridWithin` passes on CTC 01 face 19 (a quarter cylinder whose foot is an arc then a B-spline).
- Q3, ready with a known cost: `SideIsPole` accepts a side of copies of one vertex, the expanded apex of a cone whose apex is a vertex loop. CTC 01 faces 73 and 75 take the grid, and the whole CTC 01 mesh becomes closed and oriented (0 boundary, 0 non-manifold, 0 misoriented edges, from 8, 42 and 60): the triangulated cones were the source. But each cone is 1,512 quads plus 24 apex triangles, 0.7 to 1.1 s against 0.6 s, because the synthetic seam cut is sampled at 24 points and every sample becomes a row. TKT-502's QF4 (synthetic cuts sampled at the formula's budget) is the fix; this track does not duplicate it. `Law_Quads_ApexConeIsAGridWithin` runs past the 60 s law budget in the interpreter for the same reason.
- Q3b, dropped: gridding first without the seam cut's inner points left both cones unchanged (same mesh hash), so the thinned grid is refused or not reached there for a reason not found; its only effect was six small ODIN-W160 spheres becoming 24-triangle fans. Not kept, since its effect on the target faces is unexplained.

Second comparison, Q1b against Q2 (the five files, same harness flags):

| File | Triangulated faces Q1b to Q2 | Quads | Closed, oriented, contract |
|---|---|---|---|
| NIST CTC 01 (Q3 included) | 16 to 12 | 650 to 3,745 (cones 3,024 of the gain) | closed, oriented, contract holds |
| NINA-B400 | 26 to 26 (one face gains quads) | 1,018 to 1,034 | closed |
| ODIN-W160 | 402 to 328 | 4,899 to 5,433 | closed |
| LILY-W131 | 74 to 24 | 2,206 to 2,572 | closed |
| EMMY-W1 | unchanged | unchanged | same hash |

No face lost quads or began to fail between Q1b and Q2 on any of the five files.

## Merge instructions
- Copy `quads-curved-sides.library.plato` into `05-face-meshing/`.
- `MeshedOutcomeIn` (`05-face-meshing/face-meshing-domain-once.library.plato`): `var grid = m.FaceQuadGridIn(f, d, r, tol, c);` => `var grid = m.FaceQuadGridCurvedIn(f, d, r, chart, tol, c);`
- `BlockingRequests` (`08-pipeline/pipeline-host-options.library.plato`): body => `HostAnsweredRequests(rs)`, and its comment to "the requests the host's loop answers (HostAnswers)". Rename to `HostAnsweredRequests` everywhere if the supervisor prefers; the C# host calls `BlockingOnly` and `BlockingStateOf`, not `BlockingRequests`.
- `Law_V1Proof_StepAnsweringBlockingLeavesOnlyBlocking` (`08-pipeline/pipeline-host-options.laws.plato`): `q.Reason.IsBlocking` => `q.Reason.HostAnswers`, both places; the law's name and comment to "only the requests the host answers".
- The two corpus witnesses go to `08-pipeline/` beside the other `pipeline-corpus-witness-*` files, and the laws file beside them.

## Contract requests
- none

## Requests to other tracks
- TKT-502 (quad-formula, open): its fence takes `face-meshing-domain-once.library.plato` and QF2 changes `QuadGridOnSides`, which every path here calls. Merge one after the other, not together. QF4 is the fix for Q3's cone density.
- TKT-490 (trim-band) and TKT-500 (ruled B-spline grids): their faces are the ones still triangulated after this track (trimmed curved faces; ruled B-splines). No file overlap.
- TKT-415 and TKT-430 (both claimed, fence `05-face-meshing/**`) touch the four-sided test's neighbours (`GridUnlessFoldedOrCoarse`, `SideIsOneCarrierV1`); this folder calls both and changes neither.

## Findings
- The host leaves `QuadCountMismatch` unanswered (advisory), so since TKT-405 every four-sided face whose opposite sides differ in segment count has been triangulated by the host, though layer 8's own loop would have gridded it.
- The library at HEAD did not compile on 2026-10-23 00:30 (another session's `08-pipeline/pipeline-prepare-speed.laws.plato` cites `OnceCitedEdgesByShell` and others not yet defined); the laws here were run with `--library` on a `git archive` of acfb2bb7.
- The gallery screenshot of CTC 01 (22,302 triangles, "same mesh as Oct 21") predates today's library, which meshes the file to 1,926 triangles and 530 quads before this track.

## Durations
| Step | Wall time | Runs |
|---|---|---|
| Diagnosis (harness time, extract, probes) | 40 min | 6 harness runs, 2 probe law runs |
| Q1 laws | 10 min | 3 law runs (42 to 71 s each) |
| Scratch regenerations | 6 min | 3 (105 to 115 s each) |
| Five-file comparison | 4 min | 15 harness runs |

## Lessons
- The harness's `time` mode and `extract` answered "why this branch" faster than reading the code: extract the face, then probe the region with throwaway laws.
