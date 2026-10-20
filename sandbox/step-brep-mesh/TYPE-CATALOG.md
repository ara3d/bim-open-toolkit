# Type catalog: the types and concepts that make the STEP work hard to get wrong

Written 2026-10-19 at the owner's request: an exhaustive, generous list of Plato types and
concepts (interfaces) that would make implementing STEP meshing, validation, editing, and repair
easy and not error prone. Types are cheap; a wrong `Number` in the wrong place is not. Wave 1 of
`docs/plans/step-mesher-v2.md` merged eight tracks and added no type: builders passed a `Number`
where a parameter, an angle, a length, a sign, or a reason belonged, and routed every new type
through a contract request. Since 2026-10-19 additions never wait. This catalog is the shopping
list.

How to read an entry: the name, its shape in Plato, and the mistake it removes. **exists** marks a
type the library already declares (see [VOCABULARY.md](VOCABULARY.md)); **extend** marks one to
grow; everything else is new. A layer in parentheses is where it belongs. The rules of Plato that
shaped every shape: closed sums with exhaustive `match`; no generic sums, so no `Option<T>`
(generic products are fine); no type containing itself except through `Array<T>`; every
approximate comparison names its tolerance; `&&` evaluates both sides.

Four habits run through the list, and each section applies them:

1. **One type per space and per unit.** A point in the model, a point in a surface's natural
   parameters, and a point in the oriented chart are three types, so a triangulation cannot be
   handed the wrong one. A length in model units and a length in metres are two types.
2. **A proof is a type, not a flag.** A value that was checked (a closed shell, a simple loop, a
   complete discretization, a checked mesh) is a distinct type that only the checker builds, so a
   function that needs the property asks for the type and nobody re-checks or forgets to.
3. **A decision is a sum, never a sentinel.** No `-1`, `NaN`, or empty array that means "could
   not"; a `Decided*` sum names the reason, and `match` forces every caller to handle it.
4. **Edits, defects, and repairs are data.** An edit, a defect, and a repair are values with laws
   over them (an inverse, an idempotence, a changed-only-what-it-named), not code paths.

Chunks Y1 to Y4 of the wave 2 plan start on sections 2, 3, 4 and 6. The rest is for builders to
take as the code needs it: a new file in the staging folder, a law per conversion, a row in the
ledger's "types added" column.

---

## 1. Numbers, units, and quantities (layer 0)

- `ModelLength { Value: Number }`: a length in the model's `LengthUnit`. **Removes:** adding a
  tolerance in metres to a coordinate in millimetres; the decoder's unit conversion applied twice
  or not at all. `Metres { Value: Number }` is its only other form; `ToMetres(l, unit)`,
  `ToModel(m, unit)` convert, and `Law_UnitRoundTrips`.
- `SquaredLength { Value: Number }`: what a dot product of a difference returns. **Removes:** a
  distance compared with a tolerance without the square root, or with the root taken twice.
  `Sqrt(sq): ModelLength`, `Squared(l): SquaredLength`.
- `AreaMeasure { Value: Number }`, `VolumeMeasure { Value: Number }`: in model units squared and
  cubed. **Removes:** an oracle's area compared with a mesh's volume; `ScaledBy(factor)` scaling
  an area by `k` instead of `k^2` (the law: `Law_AreaScalesBySquare`).
- `Sign = Positive | Zero | Negative`: the result of every orientation decision (chunk Y1).
  **Removes:** `> 0` tests on a number that is rounding noise. `SignWithin(x, tol): Sign` is the
  only constructor from a `Number`; `Law_SignIsAntisymmetric`, `Law_SignOfProductIsProduct`.
- `Sense = Same | Opposite`: a direction agreement (`SameSense` on an edge or a face, a coedge's
  orientation, a bound's orientation) as a value with an algebra: `Compose(a, b): Sense`,
  `Law_ComposeIsAssociative`, `Law_SameIsIdentity`. **Removes:** the composed sense of a face
  along an edge computed as an XOR of three Booleans with one of them read backwards. Layer 2's
  `CoedgeRunsForwardOnCurve` becomes `Compose(Compose(edge.Sense, coedge.Sense), bound.Sense)`.
  `EdgeOrientation` (**exists**) stays as the STEP-facing name; `ToSense` converts.
- `Parity = Even | Odd`: how many times a face was flipped at decode (`FoldRecord` count), or the
  orientation class of a shell. **Removes:** a fold applied an even number of times taken as a
  flip (`Law_FoldFlipsExactlyRecorded` becomes a parity equation).
- `Winding { Turns: Integer }`: the signed number of times a loop winds around a periodic
  direction. **Removes:** a loop that crosses the seam twice taken as closed in the plane.
- `Ratio { Value: Number }` (dimensionless, any real) and `Fraction { Value: Number }` (in
  `[0, 1]`, clamped by its one constructor `FractionOf(x)`). **Removes:** a relative chordal
  default of 1.5 meant as a percent; a lerp parameter outside its range.
- `Count { Value: Integer }` with `NonZeroCount`, and the named counts the layers pass around:
  `SegmentCount` (at least 1; at least 3 for a closed edge, `ClosedEdgeMinimum`), `SampleCount`
  (points, so segments + 1), `Round { Value: Integer }` (a refinement round), `Depth`. **Removes:**
  a segment count passed where a sample count is expected, the off-by-one at every polyline's
  end; a round counter compared with a segment floor.
- `PowerOfTwoFactor { Exponent: Integer }` (the library already has a function `PowerOfTwo`):
  the only scale factor the metamorphic scaling laws use.
  **Removes:** a scale test that fails on rounding because the factor was 3.
- `Resolution { Value: Number }`: `ResolutionAt(magnitude)` returns it, never a bare `Number`.
  **Removes:** a rounding floor compared with a tolerance in the wrong direction.
- `MeasureKind = LengthKind | AngleKind | ParameterKind | AreaKind | VolumeKind | CountKind | RatioKind`
  and `Measure { Value: Number; Kind: MeasureKind }`: what `Check.Worst` and `Check.Bound` hold
  (**extend** `Check`). **Removes:** an angle in radians graded against a length bound; a report
  that prints `0.017` with no unit.

## 2. Parameters and points, one type per space (layers 0, 1, 5)

The library has one `UvCoordinate` (the stdlib's, holding natural parameters by this design's
rule) and one `Number` for every curve parameter. Chunk Y1 splits them. The full set:

- `CurveParameter { Value: Number }`: a parameter on a 3D curve's own domain (`CurveIndex`).
- `Curve2DParameter { Value: Number }`: on a parameter-plane curve (`Curve2DIndex`). Not the same
  number as the 3D curve's parameter even for a matching pcurve; `PcurveRangeOver` maps between
  them. **Removes:** a pcurve evaluated at a 3D curve's parameter.
- `EdgeParameter { Value: Number }`: on an edge's canonical domain, increasing from `Start` to
  `End` (what `EdgeDiscretization.Parameters` holds). **Removes:** a reversed coedge's sample
  taken at the un-reversed parameter. `ToCurveParameter(m, e, t)` wraps `t` into the curve's
  domain; layer 2's `EdgeDomain` already runs in increasing curve parameter whatever `SameSense`
  is (corrected 2026-10-20 by the foundation track).
- `ArcLength { Value: ModelLength }` and `NormalizedParameter { Value: Fraction }`: a position
  along an edge by length or by fraction of its domain. **Removes:** a midpoint computed as the
  parameter midpoint on a curve whose speed varies.
- `KnotParameter { Value: Number }`: a value in a B-spline's knot domain, with `IsBreakKnot`.
  **Removes:** a knot span index used as a parameter.
- `WrappedAngle { Value: Angle }` (in `[0, 2 pi)`) and `UnwrappedAngle { Value: Angle }` (lifted,
  may exceed one turn, may be negative). **Removes:** the seam bug: a loop point at `2 pi - e`
  joined to one at `0 + e` across the whole domain. `Wrap` and `NearestUnwrapped` are the only
  conversions, and `Law_WrapThenUnwrapNearReferenceIsIdentity`.
- `UvPoint { U: Number; V: Number }`: a point in a surface's natural parameters (what `UvLoop`,
  `UvRegion`, `UvTriangulation`, `FaceMesh.UvPoints`, `ModelMesh.CornerUvs` hold). `UvDelta`
  for differences. `UvCoordinate` stays the stdlib's unit-square type and the conversion is
  `ToUnitSquare(domain, p)`. **Removes:** a unit-square point fed to `Eval` on a cylinder.
- `ChartPoint { X: Number; Y: Number }`: a point after `FaceChart` (mirror and scales) is applied,
  the space in which triangle orientation is decided. `ToChart(chart, uv)`, `FromChart`.
  **Removes:** an orientation sign computed before the mirror and used after it.
- `ModelPoint { Point: Point3D }`: a position in model coordinates and units, as against a
  `LocalPoint` in an occurrence's own context before placement. **Removes:** a vertex compared
  with a surface evaluated in a different occurrence's frame.
- `UvBox { Min: UvPoint; Max: UvPoint }` and `ChartBox`: bounds in their own spaces, not the
  stdlib `Bounds2D` for both. **Removes:** a chart box intersected with a uv box.
- `SurfaceWindow` (**exists**): keep, and give it a `ToUvBox`.
- `ParameterRange { Start: Number; End: Number }` with `Start <= End` by construction
  (`RangeOf(a, b)` sorts) and `DirectedRange` (may decrease, for a coedge's traversal).
  **Removes:** `NumberInterval` values that are empty because the ends were swapped and nobody
  noticed. `CurveDomain` (**exists**) keeps a `ParameterRange`.
- `PeriodicRange { Start: Number; Length: Number; Period: Number }`: a range on a periodic
  direction, as a start and a non-negative length under one period (or exactly one period for a
  closed edge). **Removes:** a range given as `[5.9, 0.4]` meaning "across the seam".
- `DomainSide` (**exists**) and `DomainCorner = MinMin | MinMax | MaxMin | MaxMax`: the corners
  a rectangular region's four sides meet at. **Removes:** a quad grid built from sides in the
  wrong cyclic order.
- `Direction` kinds for the two parameters: `SurfaceParameter` (**exists**: `ParameterU | ParameterV`).
  Add `IsoLine { Direction: SurfaceParameter; At: Number }`: a line of constant u or v.
  **Removes:** "the v-line at u" and "the u-line at v" confused in pole and seam code.

## 3. Indices, slots, keys, and addresses (layers 0, 2, 5, 6)

Every existing typed index stays. These are the ones still passed as `Integer`:

- `BoundSlot { Value: Integer }`: the position of a `FaceBound` in `BrepFace.Bounds`.
  `CoedgeSlot { Value: Integer }`: the position of a coedge in a loop. `CoedgeSite` (**exists**)
  then holds a `BoundSlot` and a `CoedgeSlot`, not two `Integer`s. **Removes:** the two slots
  swapped at a call site.
- `EdgeSampleIndex { Value: Integer }`: the position of a sample in an `EdgeDiscretization`;
  `UvPointSource.FromEdge` holds one. `InteriorSlot { Value: Integer }`: the slot inside
  `MeshVertexSite.EdgeInterior` and `FaceInterior` (sample k + 1 is interior slot k; the law
  `Law_InteriorSlotIsSampleMinusOne` makes the off-by-one a checked fact).
- `UvPointIndex { Value: Integer }`: an index into a `UvTriangulation.Points` or
  `FaceMesh.UvPoints`, distinct from `VertexIndex` (a local or global 3D vertex). `FaceMesh`
  keeps two index spaces and today both are the stdlib's `VertexIndex`. **Removes:** a parameter
  point index used to read `Positions`, the exact confusion `LocalVertex` exists to prevent.
- `LocalVertexIndex { Value: Integer }` and `GlobalVertexIndex` (or keep `VertexIndex` for
  global only): a face mesh's own vertices against the assembled mesh's. **Removes:** a local
  index written into an assembled triangle.
- `CornerIndex` (the stdlib's, **exists** in use): give it the two constructors
  `TriangleCorner(t, slot)` and `QuadCorner(T, q, slot)` and nothing else builds one.
  **Removes:** the `3T + 4q + s` arithmetic written by hand in four places.
- `ElementSide { Element: ElementIndex; Side: Integer }`: one side of one element (a half-edge
  by address). `ElementSidePair`: the two sides on one mesh edge. **Removes:** an undirected edge
  index used where the traversal direction matters.
- `HalfEdgeKey { From: VertexIndex; To: VertexIndex }` (directed) and `EdgeKey` (undirected,
  `A < B` by construction through `EdgeKeyOf`). **Removes:** a lookup with the pair in the wrong
  order; the stdlib's `VertexPair` does not enforce the order.
- `SampleKey = AtVertex(BrepVertexIndex) | AtEdgeSample(BrepEdgeIndex, EdgeSampleIndex)`: the
  combinatorial identity of a boundary point before meshing, the key both faces of an edge share.
  `MeshVertexSite` (**exists**) is the post-numbering form; `ToSite` converts. **Removes:**
  welding by position, which the design forbids and which a builder reaches for when no key type
  exists.
- `OccurrenceKey`, `StepSource` (**exists**): keep. Add `KernelKey = <the ten tables> ` as the
  typed union `KernelElement` already is; give `ProvenanceMap` a `SourceOf(KernelElement)`.
- `TableName = VerticesTable | EdgesTable | LoopsTable | FacesTable | ShellsTable | BodiesTable | CurvesTable | Curves2DTable | PcurvesTable | SurfacesTable`:
  which kernel table a diff, a remap, or a repair names. **Removes:** the string `"Faces"`
  compared with `"faces"`.
- `IndexRemap<TIndex> { Old: Array<TIndex>; New: Array<TIndex> }` or per table
  `FaceRemap { NewOf: Array<BrepFaceIndex> }` (`-1` for removed): what a structural edit or
  repair returns, one per table, bundled as `KernelRemap`. **Removes:** stale indices held across
  a removal; every edit's law `Law_RemapIsInjectiveOnKept`.

## 4. Proof-carrying types: a checked value is a different type (layers 2 to 8)

Each is a record holding the original value (or its index) plus the facts the check produced,
built only by the one function named in its spec `constructor` clause. A function that needs the
property takes the proof type; a function that produces it returns a `Decided*` of it (section
5). Chunk Y4's `CheckedMesh` is the first.

- `InRangeModel { Model: BrepModel }`: every index in range (`Law_IndicesInRange` held). Every
  layer 2 traversal takes it, so no traversal guards indices again. **Removes:** the index guard
  forgotten in one of forty functions.
- `ChainedLoop { Loop: BrepLoopIndex }`: coedges chain end to start. `SimpleUvLoop { Loop: UvLoop }`:
  no self-intersection in the chart, decided once (`LoopSelfIntersects` is a blocking request
  today). `ClosedUvLoop`: closes in the plane after seams and poles were added. `OrientedUvRegion`:
  outer counter-clockwise, holes clockwise in the chart. **Removes:** a triangulation attempted on
  a loop that was never checked simple; the orientation re-decided inside the triangulator with a
  different tolerance.
- `ClosedShell { Shell: ShellIndex; Counts: ShellCounts }`: every edge used twice. `OrientedShell`:
  closed and coherently oriented (`OrientationFlips` empty). `ConnectedShell`. **Removes:**
  `DeclaredClosed` (a claim) read as closedness (a fact); the hollow-box laws re-checking
  closure three times (F-53).
- `PreparedModel { Model: BrepModel; Decoded: DecodedModel }`: `PrepareModel` ran: tolerances
  floored, folds applied, closures marked. Layers 4 to 8 take it, not `BrepModel`. **Removes:** a
  raw model meshed with the default tolerances.
- `ResolvableModel`: every length tolerance is above the rounding floor at the coordinate extent.
  **Removes:** a 32-bit model at coordinate 1e6 meshed with chordal 1e-4.
- `CompleteDiscretization { ByEdge: Array<EdgeDiscretization> }`: every edge of the model is
  discretized (no `Undiscretized` entry), the input `MeshFace` wants. `PartialDiscretization`
  is the type `DiscretizeAll` returns when some edge failed, with the failed edges listed.
  **Removes:** `IsDiscretized` checked per edge inside face meshing, or not.
- `CanonicalDiscretization`: parameters strictly increasing from the domain's start, end points
  the vertex points exactly. `Discretize`'s output is one; `Reversed(d)` returns a
  `DirectedDiscretization` which is not canonical and is what a reversed coedge consumes.
  **Removes:** a reversed polyline stored back into `EdgeDiscretizations`.
- `MeetsCriteriaProof { Edge; Criteria; Worst: Measure }`: the discretization met its criteria,
  with the worst measure. **Removes:** a refinement loop that cannot tell whether the last round
  changed anything.
- `MeshedFaceSet { Faces: Array<BrepFaceIndex>; Outcomes: Array<FaceMeshOutcome> }` and
  `FullyMeshedModel`: every face has a non-blocked outcome. `AssembleModelMesh` takes the second.
  **Removes:** assembly over a face whose mesh is empty.
- `WatertightMesh { Mesh: ModelMesh }`: boundary vertices are shared by site
  (`Law_InteriorSideIsShared`, `Law_BoundarySegmentIsElementSide` held). `CheckedMesh`
  (chunk Y4): manifold, closed where the shell is, oriented, with its `MeshComponentCounts`.
  `QualityGradedMesh`: with its `TriangleQuality` and `QuadQuality` arrays computed once.
  **Removes:** the layer 8 laws re-running the manifold check per law.
- `PlanarQuad { Quad: QuadFace; Deviation: ModelLength }`, `ConvexQuad`: a quad accepted by the
  grid builder. **Removes:** a non-planar quad reaching `ToQuadMesh3D`.
- `ValidatedReport { Report: Report; Level: ConformanceLevel }`: which level produced it.
  **Removes:** a `Structural` report presented as oracle-clean.
- `WellFormedBSpline { Data: BSplineCurveData }`: knots non-decreasing, counts consistent,
  weights positive, end multiplicities at most degree + 1. `ClampedBSpline`: a well-formed one
  whose ends are clamped (closure decided from end points and knots, chunk D1). **Removes:**
  `IsWellFormed` re-run at every `CanEvaluate` sample (F-53 item 1).
- `OrthonormalFrame { Frame: Frame3D; Handedness: Sign }`: a decoded placement checked within
  `AngleTolerance`. The stdlib documents orthonormality and never checks it. **Removes:** a
  mirrored placement whose determinant sign was never read.

## 5. Decided results and reasons: no sentinels (layers 0 to 8)

Plato has no `Option<T>`, so each payload type gets its own monomorphic sum, each with a `Reason`
payload in the failing case. Chunk Y1's `Decided` is the pattern; these are the instances the
code needs.

- `UndecidedReason = OutOfDomain | DegenerateAt(Side: DomainSide) | NoConvergence(Iterations: Integer) | Unbounded | NotApplicable(Kind: String) | BelowResolution | ToleranceExceeded(By: Measure)`:
  the vocabulary every `Decided*` shares. **Removes:** seven different sentinel conventions.
- `DecidedNumber = Number(Value: Number) | Undecided(Reason: UndecidedReason)`; `DecidedAngle`,
  `DecidedLength`, `DecidedParameter`, `DecidedUv`, `DecidedPoint`, `DecidedDirection`,
  `DecidedSign`, `DecidedIndex` (one per index type that needs it: `DecidedFaceIndex`,
  `DecidedEdgeIndex`), `DecidedRange`, `DecidedRound`.
- `NormalAt`: `DecidedDirection` in place of `NormalOr(fallback)`; `LimitNormal` at a pole returns
  `Limit(Direction3D)`, ordinary points `Regular(Direction3D)`, and a cone's apex
  `Apex(Direction3D)` in `SurfaceNormal = Regular(..) | Limit(..) | Apex(..) | NoNormal(Reason)`.
  **Removes:** the +z fallback that sent refinement toward the apex (F-57 item 2).
- `Projection = OnSurface(Uv: UvPoint, Distance: ModelLength) | OffDomain(Nearest: UvPoint, Distance) | Failed(Reason)`:
  what `Project` returns. **Removes:** a projection outside the domain used as if inside.
- `ClosestParameterResult = Found(T: CurveParameter, Distance: ModelLength) | Ambiguous(Candidates: Array<CurveParameter>) | Failed(Reason)`.
  **Removes:** the closest point on a circle taken at the antipode with no sign of trouble.
- `SplitDecision = Split(At: EdgeParameter) | KeepBecause(Reason: KeepReason)` with
  `KeepReason = MeetsCriteria | BelowMinLength | AtMinSegments | AtRoundLimit`: what one
  discretization or refinement step decided for one segment. **Removes:** the refinement that
  "tried nothing else" when the midpoint was too close (F-57 item 2): the caller `match`es
  `BelowMinLength` and chooses another site.
- `InsertionAttempt = Inserted(Point: UvPointIndex, Flips: Integer) | Rejected(Reason: InsertionRejection)`
  with `InsertionRejection = TooCloseTo(UvPointIndex, Distance) | OnConstraint(ElementSide) | OutsideRegion | WouldCollapse(ElementIndex)`.
  **Removes:** a silent skip inside `SplitPass`.
- `FlipAttempt = Flipped(Before: ElementSidePair, After: ElementSidePair) | NotFlippable(Reason: FlipRejection)`,
  `FlipRejection = Constrained | NotConvex | AlreadyDelaunay | Boundary`.
- `FaceMeshOutcome` (**extend**): make it a sum,
  `Meshed(Mesh: FaceMesh, Advisory: Array<EdgeRefinementRequest>) | Blocked(Requests: Array<EdgeRefinementRequest>, Diagnostics: Array<Diagnostic>)`.
  **Removes:** the empty-mesh sentinel `IsBlocking` reads today.
- `QuadGridOutcome` (**exists**, already this shape). `MeshOutcome` (**extend**):
  `Succeeded(Mesh: CheckedMesh, Report, Rounds) | Incomplete(Mesh: ModelMesh, Pending: Array<EdgeRefinementRequest>, Report) | Failed(Report)`.
- `DecodeOutcome`: `DecodedModel` (**exists**) with `Diagnostics`; add
  `Decoded(Model: DecodedModel) | NoShape(Reason) | Unreadable(Diagnostics)`.
- `ClosureDecision = ClosedByEnds(Gap: ModelLength) | OpenByEnds(Gap) | ClosedByPeriod | UndecidableWithoutEvaluation`:
  what chunk D1's end-point rule returns. **Removes:** closure decided by sampling a curve.
- `TerminationCertificate { Work: WorkBudget; Decreased: Boolean }`: what each refinement round
  returns, with `Law_WorkStrictlyDecreasesOrTerminal`. **Removes:** a refinement loop whose
  termination is a `MaxRefinementRounds` guard and nothing else.

## 6. Geometry concepts and kind classifications (layer 1)

- `INaturalCurve3D`, `INaturalCurve2D`, `INaturalSurface` (**exist**): keep. Add the finer
  concepts so a function states the least it needs:
  - `IHasCurveDomain { Domain(x: Self): CurveDomain }`, `IHasSurfaceDomain`.
  - `IEvaluableCurve3D { Eval(x: Self, t: CurveParameter): Point3D }` and the 2D and surface
    forms over `UvPoint`.
  - `IDifferentiable1 { Derivative(..) }`, `IDifferentiable2 { SecondDerivative(..) }`: separate,
    because a polyline has the first and not the second.
  - `IProjectable3D { Project(x: Self, p: Point3D): Projection }`.
  - `IHasClosedFormArea { Area(x: Self, window: UvBox): AreaMeasure }`: the analytic surfaces
    only; the oracles are its implementations. **Removes:** an oracle written for a B-spline.
  - `IPeriodicInU`, `IPeriodicInV` as marker concepts a `match` arm can rely on, or the
    classification below.
- `CurveKind = LineKind | ConicKind | PolylineKind | SplineKind | DerivedKind` and
  `SurfaceKind = PlaneKind | QuadricKind | ToroidalKind | SweptKind | SplineKind | DerivedKind`:
  the coarse class a `match` on the full sum collapses to, so a pass that treats all conics alike
  writes one arm. **Removes:** eleven arms with ten copies of one body.
- `Degeneracy = NoDegeneracy | CollapsedSide(Side: DomainSide) | CollapsedTwoSides(A, B: DomainSide) | Apex(At: UvPoint)`:
  what `DegenerateSides` returns, as one value per surface. **Removes:** a sphere's two poles
  handled by two separate code paths with two separate bugs.
- `Seam = NoSeam | SeamAt(Direction: SurfaceParameter, At: Number)` and `Seams { U; V: Seam }`.
  **Removes:** "has a seam" as a Boolean with the position recomputed elsewhere.
- `Pole { Side: DomainSide; Point: Point3D; Normal: SurfaceNormal }`: the pole with its limit
  normal, computed once (`ExpandedPoles` fills it). `PoleSegment { Pole; Points: Array<UvPoint> }`:
  the synthetic boundary run along the collapsed side.
- `CurvatureAt { Normal: Number; Gaussian: Number; Mean: Number; Principal: PrincipalCurvatures }`
  (the stdlib has `PrincipalCurvatures`, `SurfaceCurvature`; reuse). `CurvatureBound { Max: Number }`
  per face: what the chordal criterion needs to size elements. **Removes:** sagitta estimated from
  samples where a bound is in closed form.
- `SurfaceJet { Point; Du; Dv; Duu; Duv; Dvv }` (the stdlib's `SurfaceJet3D`; reuse) and
  `CurveJet { Point; D1; D2 }`: one evaluation that returns everything a step needs.
  **Removes:** five evaluations of one B-spline at one point in one law (the shared expensive
  values rule of 2026-10-19).
- `Speed { Value: Number }`: `|dC/dt|` or `|dS/du|`, what the per-point parameter tolerance
  divides by. **Removes:** a parameter tolerance computed from a length tolerance without the
  speed.
- `Sagitta { Value: ModelLength; Attained: Boolean }`: the chord-to-arc deviation and whether
  the bound was reached or only estimated (chunk S3's `Law_SagittaIsAttained`).
- `BSplineSpan { Index: Integer; Range: ParameterRange }`: one non-empty knot span, the unit of
  B-spline evaluation and of the sagitta bound by hull. **Removes:** a span index that lands on a
  repeated knot.
- `ControlPolygon`, `ConvexHullBound`: the hull bound a sagitta estimate reads.
- `Placement { Frame: OrthonormalFrame; Handedness: Sign }` for every placement-based surface,
  replacing a bare `Frame3D`.

## 7. Discretization (layer 4)

- `Chord { From: EdgeSampleIndex; To: EdgeSampleIndex }` and `Arc { Range: ParameterRange }`: a
  segment of the polyline and the piece of curve it replaces. `ChordMeasures { Sagitta; Length: ModelLength; Turn: Angle; TangentDeviation: Angle }`:
  the four criteria measured once per chord. **Removes:** four passes over the polyline, each
  re-evaluating the curve.
- `CriterionName = ChordalCriterion | AngularCriterion | MaxLengthCriterion | MinSegmentsCriterion | ParameterSpaceCriterion`
  and `CriterionVerdict { Criterion: CriterionName; Worst: Measure; Bound: Measure; Holds: Boolean }`:
  which criterion a segment fails. **Removes:** "does not meet criteria" with no name.
- `Seed { At: EdgeParameter; Why: SeedReason }`, `SeedReason = Breakpoint | KnotSpanEnd | PoleCrossing | VertexEnd`:
  the parameters a discretization must contain. `Law_SeedsAreSampled` takes `Discretize`'s inputs
  (F-54). **Removes:** a knot span boundary skipped because the sampler did not know it was one.
- `Density { SegmentsPerUnitLength: Number }` and `DensityField`: a per-edge target when a
  neighbour face asks for more. **Removes:** the global density increase that regressed every
  file (EXISTING-MESHER-LESSONS).
- `EdgeRefinementRequest` (**exists**) with `RefinementReason` (**extend**): add
  `NoInteriorPointMeetsChordal(Segment)` (chunk S1), `PoleAdjacency`, `NeighbourDensity`.
- `RequestSet { ByEdge: Array<EdgeRefinementRequest> }` merged per edge with the strongest
  request kept, built by `MergeRequests`. **Removes:** two faces' requests on one edge applied
  in sequence, the second undoing the first.
- `DiscretizationDelta { Changed: Array<BrepEdgeIndex> }`: what `Refine` changed, so face meshing
  re-runs only faces touching those edges. `Law_RefineChangesOnlyRequested` already exists in
  spirit; the delta makes it the return value.

## 8. Face meshing and triangulation (layer 5)

- `Constraint { From: UvPointIndex; To: UvPointIndex; Source: ConstraintSource }` with
  `ConstraintSource = LoopSegment(Loop, Slot) | SeamCut | PoleRun`: a segment the triangulation
  must contain. `ConstrainedTriangulation { Points; Triangles; Constraints }`: a triangulation
  with its constraints listed, so `Law_ConstraintsAreElementSides` has something to read.
  **Removes:** a flip across a boundary segment.
- `Cavity { Boundary: Array<UvPointIndex>; Removed: Array<ElementIndex> }`: the hole an insertion
  opens, the data Bowyer-Watson re-triangulates. **Removes:** the neighbour table rebuilt whole
  per insertion (F-57 item 7).
- `NeighbourTable { Across: Array<ElementSide> }`: the side-to-opposite-side map maintained
  incrementally; `Law_NeighbourTableIsInvolution`. **Removes:** adjacency recomputed by sorting
  at every flip.
- `DelaunayCertificate { Checked: Integer; Violations: Integer }`: the result of the empty-circle
  test over all interior sides, kept with the triangulation it certifies.
- `EarCandidate { Tip: UvPointIndex; IsEar: Sign }` and `Bridge { From: UvPointIndex; To: UvPointIndex }`
  for the ear-clipping fallback: the hole bridge made explicit so `Law_BridgeIsVisible` can test
  it.
- `ElementInChart { Corners: 3 ChartPoints; Orientation: Sign; Area: Number }`: the triangle as
  the orientation decisions see it. **Removes:** `TwiceSignedArea` called on uv points in one
  place and chart points in another (chunk Y3 makes the sign a `Sign`; this makes the input a
  `ChartPoint`).
- `ElementDeviation { Chordal: ModelLength; NormalTurn: Angle; NormalMismatch: Angle; SamplePoint: UvPoint }`:
  the geometric measures of one element against its surface, computed once. `RefinementTarget = SplitSide(ElementSide) | InsertAt(UvPoint) | SplitAtCentroid(ElementIndex)`:
  what the refinement chose, so the fallback chain of F-57 item 2 is a `match` over a sum.
- `SeamCopy = NearMin | NearMax`: which copy of a seam point a parameter-space point is. `SeamPair { Min: UvPointIndex; Max: UvPointIndex }`:
  the two copies that lift to one vertex. **Removes:** `Lift`'s all-pairs identification
  (12 million comparisons, F-57 item 5): the pairs are known at cut time.
- `PoleRun { Pole; Points: Array<UvPointIndex> }`: the points of one pole segment that lift to
  one vertex. Same removal.
- `LiftTable { LocalVertexOf: Array<LocalVertexIndex> }`: the parameter-point to local-vertex map
  built from `SeamPair`s and `PoleRun`s, never from distances.
- `QuadGridSides { Bottom; Right; Top; Left: Array<UvPointIndex> }` and `GridCounts { Across; Along: SegmentCount }`:
  the four-sided region's sides in cyclic order with their counts.
- `FaceChart` (**exists**): add `Mirrored: Parity` instead of `Boolean`.
- `MeshFaceTrace`: the events of one face's meshing (section 11), for the probes that cost
  eight hours when they were reconstructed from logs.

## 9. Mesh assembly and the assembled mesh (layer 6)

- `CornerAttribute<T> { PerCorner: Array<T> }` (generic product) with `CornerNormals = CornerAttribute<Direction3D>`,
  `CornerUvs = CornerAttribute<UvPoint>`: a per-corner array that knows it is per corner, with
  `Law_CornerCountIsThreeTPlusFourQ`. The stdlib's `MeshAttribute<T>` with `AttributeDomain`
  is the generalization; reuse it if its `PerCorner` fits.
- `Crease { Edge: UndirectedEdgeIndex; Angle: Angle }`: an edge whose two corner normals differ
  by more than a threshold; `CreaseSet`. **Removes:** crease detection by position in the glTF
  writer (chunk T5).
- `ElementKind = TriangleKind | QuadKind` and `ElementRef = TriangleRef(Index) | QuadRef(Index)`:
  what an `ElementIndex` resolves to, through `ResolveElement(mesh, e)`. **Removes:** `e - T`
  computed at every quad access.
- `ElementCorners = TriangleCorners(A, B, C: VertexIndex) | QuadCorners(A, B, C, D)`: the
  corners of any element by one `match`.
- `MeshEdgeTable` (**exists**), `MeshComponents` (**exists**): keep. Add `BoundaryCycle { Edges: Array<UndirectedEdgeIndex> }`
  and `BoundaryCycles` so `BoundaryCycles` is a list, not a count, and a repair can name the
  cycle it closes.
- `NonManifoldEdge { Edge; Sides: Array<ElementSide> }`, `PinchedVertex { Vertex; Links: Integer }`,
  `MisorientedEdge { Edge; Sides: ElementSidePair }`: the defects by address, not by count.
  **Removes:** "3 non-manifold edges" with no way to find them.
- `MeshSlice { Faces: Array<BrepFaceIndex>; Elements: Array<ElementIndex> }`: the restriction of
  a mesh to some faces as a view with its element list, the input of per-face oracles.
  `RestrictedToFaces` returns it.
- `ProvenanceIndex { ByVertex: Array<MeshVertexProvenance>; ByFace: JaggedArray<VertexIndex> }`:
  the reverse map from model face to its mesh vertices. **Removes:** a scan of every vertex to
  find a face's.
- `ElementProvenance { Face: BrepFaceIndex; UvCentroid: UvPoint; Round: Round }`: per element,
  which face, where on it, and which refinement round made it. **Removes:** a glTF with per-face
  colour but no way to say which round produced the sliver.

## 10. Validation: claims, evidence, allowances (layers 0 and 7)

- `LawName { Value: String }`: a typed name, built only by the law table in layer 9 (`LawId`),
  so a `Check.Law` cannot be a typo. **Removes:** a check that names a law no runner knows.
- `Claim { Law: LawName; Subject: Provenance; Tolerance: Measure }`: what is asserted, about
  what, within what. `Evidence = ExactEvidence(Holds: Boolean) | SampledEvidence(Worst: Measure, At: Provenance, Samples: SampleCount) | OracleEvidence(Expected: Measure, Actual: Measure, Allowance: Allowance)`.
  `Check` (**extend**) = `Claim` + `Evidence` + `Holds`. **Removes:** `Worst = 0, Bound = 0`
  meaning "exact and held" by convention.
- `Allowance { Value: Measure; Derivation: AllowanceSource }` with
  `AllowanceSource = FromModelTolerance | FromRounding(Operations: Integer, Resolution: Resolution) | FromCriteria(Criterion: CriterionName) | FromOracleBound(Law: LawName) | Stated(Why: String)`:
  every allowance says where its number came from. **Removes:** the angle-defect allowance that
  ignored the number of additions (F-57 item 1): `FromRounding(count)` is the fix as data.
- `CompensatedSum { Value: Number; Terms: Integer; Error: Number }`: Kahan sum with its error
  bound, what `AngleDefectSum` and `SignedVolume` return. **Removes:** a plain sum of thousands
  of corner angles under 32 bits.
- `OracleAgreement { Oracle: LawName; MeshValue: Measure; OracleValue: Measure; Allowance; Agree: Boolean }`:
  one oracle comparison as a record a report can list.
- `CheckScope = PerElement | PerPair | WholeModel` with `PairBudget { MaxElements: Integer }`:
  an all-pairs check declares itself and is skipped above the budget with a diagnostic, never
  run for 100 minutes on a torus (F-57 lesson). **Removes:** a quadratic check hidden inside a
  linear-looking validator.
- `TimeBudget { Milliseconds: Integer }`, `Elapsed { Milliseconds: Integer }`, `LawRun`
  (**exists**, add `Elapsed`): the 2 s rule as a value the runner and the report both hold.
- `WorkBudget { Evaluations; Insertions; Flips; Projections: Integer }`: counted work, the
  measure the termination laws decrease. **Removes:** "slower than the old code" with no number.
- `SampleGrid { Plan: SamplePlan; Domain: SurfaceDomain; Checked: Boolean }`: chunk H2's
  once-per-arena grid.
- `WitnessFamily` (**exists**), `FixedWitness` (**exists**): keep. Add `WitnessSpec { Family; Seed: Integer; Parameters: Array<Number> }`
  so a failing generated witness can be rebuilt from its spec in the report (chunk T1).
- `Perturbation` (**exists**): make it a sum `RigidMotion(Pose3D) | PowerOfTwoScale(PowerOfTwo) | VertexJitter(Within: ModelLength, Seed)`
  (chunk T2), each with its invariance law named in `InvarianceOf(p): LawName`.
- `Expectation = ShouldPass | ShouldFail(Law: LawName) | ShouldWarn(Code: String)`: what a
  witness is for; `Witness_BoxWithFlippedFace` carries `ShouldFail(Law_ShellIsOrientable)`.
  **Removes:** a negative witness that quietly started passing.
- `Verdict = Pass | Fail(Evidence) | Error(Message) | Obligation | Skipped(Why) | OverBudget(Elapsed)`
  (**extend** `LawVerdict` to carry the payload). `VerdictDelta { Law; Before; After }`: one
  changed verdict between two sweeps, what the merge procedure traces to a chunk.
- `ConformanceLevel` (**exists**): keep. Add `LevelProof` so a `ValidatedReport` cannot claim
  a level its checks did not run.

## 11. Pipeline, runs, and traces (layer 8)

- `Stage = Parsing | Decoding | Preparing | Discretizing | FaceMeshing | Assembling | Validating`
  (`RunStage` **exists**; align). `StageOutcome<T>`: a generic product
  `{ Stage; Value: T; Report; Elapsed }` so every stage returns the same shape.
- `MeshingEvent = EdgeDiscretized(Edge, Segments: SegmentCount) | EdgeRefined(Edge, From, To: SegmentCount, Why: RefinementReason) | FaceMeshed(Face, Triangles: Count, Quads: Count, Round) | FaceBlocked(Face, Requests) | RoundEnded(Round, Pending: Count) | Assembled(Vertices: Count) | Validated(Level, Clean: Boolean)`
  and `Trace { Events: Array<MeshingEvent> }`: the run as data. **Removes:** probes
  reconstructed from printouts; `Law_TraceRoundsAreMonotone`.
- `RunKey { ModelHash: String; Options: MeshingOptions; LibraryCommit: String; Profile: String }`:
  what makes a run reproducible, written into every report and corpus row. **Removes:** a corpus
  report whose library state nobody can name.
- `PipelineState` (**exists**): add `Trace` and `Work: WorkBudget`.
- `Pending { Requests: RequestSet; Faces: Array<BrepFaceIndex> }`: what the next round must
  redo, derived from `DiscretizationDelta`, not from "all faces".
- `Incremental { Reused: Array<BrepFaceIndex>; Redone: Array<BrepFaceIndex> }`: what a round
  reused. `Law_ReusedFacesTouchNoChangedEdge`.

## 12. Editing: edits as data with inverses (a new layer, 10-editing)

Editing is out of the current design's scope by the owner's decision; the design "keeps the door
open by never baking read-only into a type". These types are the door.

- `Selection = Vertices(Array<BrepVertexIndex>) | Edges(..) | Faces(..) | Shells(..) | Bodies(..) | Everything`:
  what an edit applies to. `SelectionClosure { Vertices; Edges; Faces }`: the selection with
  everything it touches (the faces of a selected edge, the edges of a selected face).
- `Anchor = BySource(StepSource) | ByProvenance(Provenance) | ByIndexAt(Commit: String, Index: KernelElement)`:
  a reference to a kernel element that survives renumbering. **Removes:** an edit script that
  breaks after a repair removes one vertex.
- `GeometricEdit = MoveVertex(Vertex, To: ModelPoint) | ReplaceCurve(Curve, With: BrepCurve) | ReplaceSurface(Surface, With: BrepSurface) | Transform(Selection, By: Pose3D) | Scale(Selection, PowerOfTwo)`:
  edits that change no table size. `TopologicalEdit = SplitEdge(Edge, At: EdgeParameter) | MergeEdges(A, B) | SplitFace(Face, Along: Array<EdgeParameter>) | RemoveFace(Face) | AddFace(BrepFace) | ReverseFace(Face) | ReverseLoop(Loop) | RetrimFace(Face, Bounds: Array<FaceBound>)`:
  edits that change table sizes and return a `KernelRemap`. `ToleranceEdit = SetTolerances(Tolerances) | ScaleTolerances(Number)`.
  `ModelEdit = Geometric(GeometricEdit) | Topological(TopologicalEdit) | Tolerance(ToleranceEdit)`.
- `EulerOperator = MakeVertexEdge(..) | MakeEdgeFace(..) | KillEdgeMakeRing(..) | MakeEdgeKillRing(..) | KillEdgeVertex(..) | KillFaceMakeRingHole(..)`:
  the Euler operators as a sum, each with `Law_EulerOperatorKeepsCharacteristic`. The
  topological edits above compose from these. **Removes:** a split that forgets the vertex.
- `EditPrecondition = EdgeInRange | ParameterInDomain | FaceHasBound | LoopIsChained | ...` and
  `EditOutcome = Applied(Model: BrepModel, Remap: KernelRemap, Inverse: ModelEdit) | Refused(Precondition: EditPrecondition, Where: Provenance)`:
  every edit returns its inverse. `Law_InverseUndoes`, `Law_RefusedLeavesModelUnchanged`.
- `EditScript { Edits: Array<ModelEdit> }` with `Apply(m, script): EditOutcome` and
  `Inverse(script)`. `Transaction { Before: BrepModel; Script; After: BrepModel; Remap }`.
- `Invalidation { Edges: Array<BrepEdgeIndex>; Faces: Array<BrepFaceIndex>; WholeModel: Boolean }`:
  what an edit invalidates downstream, computed from the edit, not from a diff.
  `Law_InvalidationCoversChangedFaces`. **Removes:** a stale face mesh after a vertex move.
- `MeshPatch { RemovedElements: Array<ElementIndex>; AddedFaceMeshes: Array<FaceMesh>; Renumbering: MeshVertexNumbering }`:
  the incremental result of re-meshing invalidated faces.
- `EditPreview { Model: BrepModel; Report: Report }`: an edit evaluated for display, never
  written (the toolkit's "nothing writes until Run" principle).
- `Dirty { Since: Transaction; Invalidation }`: what has not been re-meshed.

## 13. Repair: defects as data, repairs as data (layers 3, 7, and a new 11-repair)

- `Defect` as a closed sum, one case per law family that a repair can address, each with its
  address and measure:
  `FreeEdge(Edge) | EdgeUsedThrice(Edge, Uses: Count) | GapAtVertex(Edge, End: EdgeEnd, Gap: ModelLength) | VertexOffCurve(Vertex, Edge, Distance) | EdgeOffSurface(Edge, Face, Distance) | MissingPcurve(Edge, Face) | PcurveOffCurve(Pcurve, Gap) | LoopNotChained(Loop, AtSlot: CoedgeSlot) | LoopOpenInUv(Face, Bound: BoundSlot, Gap: UvDelta) | LoopSelfIntersects(Face, Bound, I, J: CoedgeSlot) | SeamRunsSameWay(Face, Edge) | MisorientedFace(Face) | NotOrientable(Shell) | DegenerateEdge(Edge) | DuplicateVertex(A, B: BrepVertexIndex, Distance) | RedundantVertexLoop(Face, Bound) | NoOuterBound(Face) | TwoOuterBounds(Face) | TrimOutsideDomain(Surface, Excess: Number) | KnotMultiplicityTooHigh(Curve, At: Integer) | KnotsNotNonDecreasing(Curve, At) | ZeroLengthDirection(Instance) | NonOrthonormalPlacement(Surface, Deviation) | ToleranceBelowResolution(Tolerance, Resolution) | DeclaredClosedButOpen(Shell, FreeEdges: Count) | ShellDisconnected(Shell, Components: Count)`.
  `DefectOf(check: Check): DecidedDefect`: the map from a failed check to a defect.
  **Removes:** repairs keyed on diagnostic code strings.
- `DefectClass = Structural | Geometric | Tolerance | Quality` (aligns with `ConstraintGroup`),
  and `Locality = Local | NeedsNeighbours(Faces) | WholeShell | WholeModel`: how far a repair
  reaches.
- `RepairAction`, one case per defect family:
  `MergeVertices(Keep, Drop) | SnapVertexToCurve(Vertex, Edge) | ExtendEdgeToVertex(Edge, End) | AddPcurveByProjection(Edge, Face) | ReplacePcurve(Pcurve, With: BrepCurve2D) | CloseLoopByBridge(Face, Bound, Gap) | ReverseFace(Face) | ReverseLoop(Loop) | FlipShell(Shell) | DropEdge(Edge) | DropBound(Face, Bound) | PromoteToOuter(Face, Bound) | ClampTrim(Surface) | CutKnotMultiplicity(Curve, At) | SortKnots(Curve) | RaiseTolerance(To: Tolerances) | SplitSeamEdge(Face, Edge) | InsertSeam(Face, Direction) | InsertPoleLoop(Face, Side) | DeclareOpen(Shell)`.
  **Removes:** the decoder's three ad hoc repairs (`StepRepair` **exists**: `MergedInto`,
  `DroppedZeroLengthEdge`, `Skipped`) growing into thirty with no common shape. `StepRepair`
  becomes a projection of `RepairAction`.
- `Fixability = Fixable(Action: RepairAction, Cost: RepairCost) | FixableWithChoice(Options: Array<RepairAction>) | Unfixable(Why: String)`:
  what `Diagnose(defect)` returns. `RepairCost { TouchedFaces: Count; ToleranceGrowth: Ratio; Locality }`.
- `RepairStep { Defect; Action; Expect: LawName }` and `RepairPlan { Steps: Array<RepairStep> }`:
  ordered, with a dependency rule (`Law_PlanFixesStructureBeforeGeometry`). `RepairPolicy { MaxToleranceGrowth: Ratio; AllowTopologyChange: Boolean; AllowShellFlip: Boolean; Budget: WorkBudget }`:
  what a repair may do, like OpenCascade's healing flags but typed.
- `RepairOutcome = Repaired(Model, Remap: KernelRemap, Before: Check, After: Check, Inverse: ModelEdit) | Worsened(Before, After, Reverted: Boolean) | NotApplied(Why)`:
  every repair carries its own before-and-after evidence and its inverse (a repair is an edit).
  `Law_RepairMakesExpectedLawHold`, `Law_RepairChangesOnlyNamedElements`,
  `Law_RepairIsIdempotent`, `Law_RepairStaysWithinPolicy`.
- `RepairLedger { Records: Array<RepairRecord> }` (**extend** `RepairRecord` to hold a
  `RepairAction` and a `RepairOutcome`): the audit trail `ProvenanceMap.Repairs` already starts.
- `HealedModel { Model: PreparedModel; Ledger: RepairLedger; Remaining: Array<Defect> }`: a
  model after a repair pass, with what is left. The mesher takes a `PreparedModel`; a
  `HealedModel` converts to one and records that it did.
- `GapClosure = SnapToExisting(Vertex) | InsertVertexAt(ModelPoint) | ExtendCurve(By: ModelLength) | Bridge(Segment)`:
  the choice a gap repair makes, as data.
- `SeamRepair = AddSeamEdge(Face, Direction, At: Number) | SplitAtSeam(Face)`: the one case the
  research names as unfixable locally on closed surfaces, so it gets its own type and its own
  `Unfixable` reason when the shell is closed.
- `DefectReport { Defects: Array<Defect>; ByClass: Array<Count>; ByFace: JaggedArray<Integer> }`:
  the validator's output in a form a repair planner reads. `ValidateBrep` returns a `Report`
  today; `DefectsOf(report)` derives this.

## 14. STEP file and decoding (layer 3)

- `EntityName { Value: String }` and `AttributeName { Value: String }`: typed, built from the
  schema table only (`EntityDefinition` **exists**). **Removes:** `"ADVANCED_FACE"` spelled
  `"ADVANCEDFACE"` in one decoder arm.
- `TypedInstance = <one case per supported entity, payload the typed attribute record>`: the
  typed STEP entity sum TKT-300 holds open. If the owner reopens it, every decoder `match` is
  exhaustive over the schema; until then `StepInstanceBody` (**exists**) stays.
- `UnitFactor { MetresPerUnit: Number; Named: LengthUnit; Snapped: Boolean }` and
  `AngleFactor { RadiansPerUnit: Number; Snapped: Boolean }`: a conversion with its recognition
  recorded (`ContextUnits` **exists**; extend).
- `PlacementChain { Steps: Array<StepInstanceId>; Composed: Pose3D; Handedness: Sign }`: the
  assembly path an occurrence's placement came from, for the diagnostic that names the mirroring
  instance. **Removes:** a mirror attributed to the wrong level.
- `ReferenceResolution = Resolved(StepInstanceId) | Dangling(StepInstanceId) | WrongKind(StepInstanceId, Expected: EntityName)`:
  the result of following one reference. **Removes:** a dangling reference decoded as instance 0.
- `DecodeStep = ReadVertex | ReadEdge | ReadLoop | ReadFace | ReadShell | ReadBody | ReadCurve | ReadSurface | ReadPlacement | ReadUnits`
  with `DecodeTrace`: where decoding was when a diagnostic was issued.
- `FoldRecord` (**exists**) with `Parity` (section 1).

## 15. Concepts (interfaces) that cut across layers

Plato interfaces are type classes; a function constrained by one states what it needs and
nothing more. The library has `INaturalCurve3D`, `INaturalCurve2D`, `INaturalSurface`, and
implements the stdlib's `IValue`, `IIndex`, `IEquatable`, `IOrderable`, `IProcedural`.

- `IScaled { ScaledBy(x: Self, factor: PowerOfTwo): Self }` and `IMoved { Moved(x: Self, motion: Pose3D): Self }`:
  everything the metamorphic laws transform (`ScaledBy` exists as ten overloads; one concept
  states the law once: `Law_ScaledThenUnscaledIsIdentity`).
- `IToleranced { Tolerance(x: Self): Tolerances }`: a value that carries the tolerance it was
  made under (a `PreparedModel`, an `EdgeDiscretization`, a `FaceMesh`). **Removes:** a mesh
  validated under a different tolerance from the one it was built with.
- `IHasProvenance { Where(x: Self): Provenance }`: anything a diagnostic can point at.
- `IDiffable { Diff(a: Self, b: Self, tol: Tolerances): DecidedDifference }`: one concept for the
  layer 9 diffs, so `Law_SameIffNoDiff` is stated once over every type.
- `ICheckable { Check(x: Self, level: ConformanceLevel): Report }` and
  `IRepairable { Defects(x: Self): DefectReport; Repair(x: Self, plan: RepairPlan, policy: RepairPolicy): RepairOutcome }`.
- `IEditable { Apply(x: Self, edit: ModelEdit): EditOutcome }` with the inverse law.
- `IIndexedTable<TIndex, TRow> { Count(x: Self): Integer; At(x: Self, i: TIndex): TRow; IsInRange(x: Self, i: TIndex): Boolean }`:
  every kernel table through one concept, so `Law_IndicesInRange` is one law over ten tables.
- `IReversible { Reversed(x: Self): Self }` for discretizations, loops, faces, meshes, with
  `Law_ReversedTwiceIsIdentity`.
- `IHasDomain<TDomain>` (`CurveDomain` or `SurfaceDomain`), `IHasSeams`, `IHasPoles`
  (`Degeneracy`), `IHasClosedFormArea` (section 6).
- `ITraced { Trace(x: Self): Trace }` for every stage outcome.
- `IBudgeted { Work(x: Self): WorkBudget }` for every refinement result, so the termination laws
  are one law.
- `IWitnessed { Witnesses(_: Self): Array<WitnessSpec> }`: a type names its own witness
  families, so the runner draws constrained types from witnesses (F-54's rejected `Invariant_`
  form, done as a concept instead of a runner change).

## 16. Tooling and reports (layer 9)

- `LawId` (**exists** in `tooling-law-runner.types.plato`): keep, make `LawName` its public form.
- `Dump` types (**exist**): keep. Add `RowDump { Table: TableName; Row: Integer; Cells: Array<CellValue> }`
  so a diff's "the developer dumps the row" is a function.
- `DiffSummary { First: LocatedDifference; Count: Integer; ByTable: Array<Count> }`: the first
  difference and how many, since "first only" hides a renumbering that moved everything.
- `CorpusRow { File: String; Key: RunKey; Outcome: MeshOutcome; Defects: DefectReport; Elapsed: Elapsed; Cause: LawName }`:
  one row of the corpus report with its failing law typed. **Removes:** the "cause" column as
  free text.
- `Benchmark { Law: LawName; Recorded: Measure; At: RunKey }`: a recorded number a law compares
  against (F-56 item 2's 4.99 degrees), with the commit it was recorded at.

---

## How to use this catalog

- A builder whose chunk passes a `Number`, an `Integer`, a `Boolean`, or an empty array that
  means something looks here first; if the type is listed, declare it in a new file in the
  staging folder and say so in the ledger's "types added" column; if it is not, add it to this
  file in the same commit.
- Every new type comes with: one constructor function where the type has an invariant, the
  conversion functions to and from the type it replaces, and one law that the conversions round
  trip or that the invariant holds for every value the constructor returns.
- A type that replaces a field of an existing type is a contract change and merges alone
  (plan v2, design item 3). A type that is only added is not.
- The order to adopt them in, by what wave 2 hurts from most: section 5 (decided results, the
  fallback bugs), section 2 (points by space, the seam and chart bugs), section 4 (proof types,
  the re-checking cost), section 10 (allowances with derivations, the 32-bit oracle failures),
  then 13 (repair), 12 (editing), and the rest as reached.
