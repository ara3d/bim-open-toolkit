# quad-formula: analytic curved faces as structured grids sized by the closed-form chordal count

Ticket: TKT-502
Status: ready: QF1, QF2, QF3, QF4 (QF4 after the quads track) | working: QF5 (corpus measurement)

The design and chunk table are in the ticket. The previous builder stopped on a usage limit before its
first law run; a second builder took over on 2026-10-23 from the staged, uncommitted files.

## Done
- QF1, `6027168d`: `grid-formula.{types,library,laws}.plato`. `AnalyticGridFormula` gives each surface kind
  its two directions and budget (cylinder and cone: one circular direction at the whole chordal bound; sphere
  and torus: two, at half the bound each), `DirectionCount` is layer 04's `ArcSegmentCount` of a circle of
  that radius, and `GridFloors` asks the larger of the matching floor and the formula's count. Change from
  the first draft: `FormulaSideEdge` floors a face's seam edge too (`SideEdge` leaves seams out because a
  seam cannot match two opposite counts; the formula asks the same count of both uses, so it can). Without
  it the torus witness, bounded by two seam circles, asked nothing. The torus law is stated by the keep
  gate alone (`IsKeptGrid`: the outcome is a grid, so T1's rule under `ElementWithinChordal` kept every
  element and both splits of every quad); the first draft's second measure (coverage gap plus vertex
  deviation) is gone, at the v1 supervisor's request.
  Laws (warm server, cpu64): `Law_QuadFormula_CountChordMeetsBudget`, `_CountIsLeast`,
  `_BoundaryReachesFormulaWhereCurvedOneWay`, `_KeptGridsUnchanged`, `_TorusGridKeptAtFormulaFloors` pass
  (also on the capped compiled CLI 60134758-cap before the seam fix: 4 pass, the torus law failed, which
  led to the fix).
- QF2 (wiring only, see merge instructions) and QF3, `cff7629d` and `6027168d`: `grid-positions.{types,
  library,laws}.plato`. `QuadGridPositioned` evaluates each grid node once and the cell rule and the keep
  gate read the positions (`GridElementKeptAt`, `DecideGridChordalAt`); `QuadGridOnSidesPositioned` is
  `QuadGridOnSidesFormula` on them. `Law_QuadFormula_PositionedGridIsQuadGrid` and
  `_PositionedGridAgrees` pass (bit for bit, every four-sided face of the eight grid cases). `Lift` still
  evaluates the nodes it lifts; that file is another track's.
  Wired check (library copy with the QF2 and QF3 lines below applied): 123 laws of the 14 libraries that
  read the grid (`FaceMeshingLaws`, `FaceMeshingGridChordalLaws`, `FaceMeshingGridKeepLaws`,
  `TriangulatedWitnessLaws`, `V1KeepLaws`, `PipelineHostOptionsLaws`, ...): the same verdicts as unwired,
  122 pass and 1 fail (`Law_V1Proof_WitnessOptionsMeshLikeTheHost`, failing on HEAD too).
- QF4, `20cb33bf` and `3429e65c`: `pole-formula.library.plato` (`PoleFormulaCriteria`: on a sphere or cone,
  the angular bound handed to `ExpandedPoles` is at most the step of the formula's u count over the loops'
  v range, so a pole segment has the count the opposite side needs) and `grid-formula-sphere.laws.plato`.
  The sphere witness is four-sided only with the quads track's pole sides (`QuadSidesCurvedIn`, TKT-409
  Q3): wired, with the quads folder as a second staging root, `Law_QuadFormula_SphereGridKeptAtFormulaFloors`
  passes (pole sides 32 segments, seam 12, the formula asks 16 of the seam, the grid at 16 is kept).
  Wired check of 285 laws over 33 libraries (the 14 above plus every law library naming spheres, poles or
  cones): same verdicts as unwired (276 pass, 2 fail and 1 budget error on HEAD too, 6 skipped).

## Merge instructions
Merge after the quads track (TKT-409); its QuadGridOnSidesCurved calls QuadGridOnSides, so it gets the
formula through QF2 with no change of its own.
- Copy `grid-formula.{types,library,laws}.plato`, `grid-formula-sphere.laws.plato`,
  `grid-positions.{types,library,laws}.plato` and `pole-formula.library.plato` into `05-face-meshing/`;
  rename `Law_QuadFormula_*` to `Law_V1Faces_*`.
- QF2 and QF3, `face-meshing.library.plato`: `QuadGridOnSides(m, f, d, r, c, sides)` body =>
  `m.QuadGridOnSidesPositioned(f, d, r, c, sides)`; `QuadGrid(m, f, r, corners, c)` body =>
  `m.QuadGridPositioned(f, r, corners, c).Grid` (one grid builder, no copy).
  After this, `Law_QuadFormula_KeptGridsUnchanged`, `_PositionedGridIsQuadGrid` and `_PositionedGridAgrees`
  compare a function with itself; keep them as regression pins or drop them.
- QF4, `pole-segments.library.plato`: rename the body of `ExpandedPoles` to `ExpandedPolesSampled` (same
  parameters), give `ExpandedPoles(m, f, loops, c)` the body `=> m.ExpandedPolesFormula(f, loops, c)`, and in
  `pole-formula.library.plato` make `ExpandedPolesFormula` call `m.ExpandedPolesSampled(...)` instead of
  `m.ExpandedPoles(...)` (otherwise it recurses).
- `grid-formula-sphere.laws.plato` calls `QuadSidesCurvedIn` and `QuadGridOnSidesCurved`, so it compiles
  only once `quads-curved-sides.library.plato` is in the library.

## Contract requests
- none. `SegmentFloors` stays dense; finding 9's sparse floors would change `QuadGridOutcome.CountsDiffer`
  and wait for a wave. `GridFloors` builds the table once per refused face, not per outcome.

## Requests to other tracks
- quads (TKT-409): Q1b (the host answering `QuadCountMismatch`) is what turns the formula's floors into
  meshes on the corpus; Q3 (pole sides) is what makes the sphere four-sided. Both are ready there.
- owner of `uv-regions.library.plato`: synthetic seam cuts (`CutSegmentCount`, used by `JoinedByCut`) are
  not sized by the formula. Quads Q3 reports a cone whose cut is sampled at 24 points, every one a grid
  row; along a cone or cylinder ruling the formula asks one cell. Not done here: outside the fence.

## Findings
- A full torus or sphere face's seam sides are seam uses of a model edge, which `SideEdge` (and so
  `MatchingFloors`) never floors; the formula's floors must reach them or the doubly curved witnesses ask
  nothing.
- The sphere witness is not four-sided under `QuadSidesOf` (88 points, pole runs of 32): only the quads
  track's turning corners and `SideIsPole` see its four sides.

## Durations
| Step | Wall time | Runs |
|---|---|---|
| first builder: reading, baseline export, writing QF1 | 85 min | 2 builds |
| takeover: reading the ticket, TRACK, sources, library | 10 min | |
| QF1 first compiled run (capped CLI) | 2 min | 1 run, 1:44 of it the C# compile |
| torus probe and the seam fix | 5 min | 1 server run, 1 `--call` probe (32 s) |
| QF1 and QF3 laws, warm server | 2 min | 3 runs |
| QF2/QF3 wired check, base and wired | 4 min | 2 runs (74 s and 155 s) |
| QF4 writing, wired check of 285 laws | 15 min | 2 runs (6:19 and 6:52) |
| sphere probes and law | 5 min | 2 `--call` probes, 1 server run (48 s) |
| regenerations and harness builds | 20 min | 5 regenerations (2 to 3 min each), 5 builds |

## Lessons
- The scratchpad folder is shared by every agent of one parent session; name a private subfolder.
- A regenerated `Ara3D.StepBrep` folder holds only `Generated` and `Intrinsics`; copying it over the export
  drops the csproj, and the harness build fails with 90 errors. Copy the two folders into the export.
- A `--call` probe returning an `Array<Integer>` of counts found the torus's missing seam floors in one run.
