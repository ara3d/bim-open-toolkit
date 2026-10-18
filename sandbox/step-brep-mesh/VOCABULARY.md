# Vocabulary: the contract between layers

Every author of a layer reads this before writing, and writes against it. It fixes the layer order,
the names each layer exports and the names it may use from below, the stdlib names reused as they
are, and the naming rules. A name listed here as **fixed** is not renamed by a layer author; a name
listed as **proposed** may be renamed or split inside its layer, and the author records the change in
the layer README under "Changes to the contract". The supervising session merges those into the
"Changes to this contract" section at the end of this file. Since revision 3 every listed name is
fixed.

Plato has one global namespace and nominal types. Two functions of one name with the same parameter
types are an error in one library (LINT004), and in two libraries they compile but leave each call
to the compiler's choice (the name review of revision 3 found three such pairs). So each name and
signature is declared once, by the lowest layer that needs it. That is why this file exists.

Stdlib reference: `C:\Users\cdigg\git\plato`, commit `f6e02cf0` (2026-10-17). The index of every
stdlib type and interface is `stdlib/types-and-concepts.txt` in that repository; a name not in it
does not exist. [PLATO-PRIMER.md](PLATO-PRIMER.md) section C quotes the declarations this design
reuses, and section G lists the collisions this revision resolves.

Revision 3, 2026-10-17: after Phase 1, the fix wave, and the name review. Revision 2 is in git
history (commit 2eb922c5), revision 1 too (commit 02c2aacf).

## Layer order and dependency rule

A layer may reference names from itself and from lower-numbered layers only. One pattern looks like
an exception and is not: layer 0's floor functions (`LengthParameterFloor`, `AngleParameterFloor`)
take the coordinate extent and the model size as plain `Number`s, which layer 3 computes through
layer 2's `CoordinateExtent` and `ModelSize`. Data passes down; no name points up. A law that needs a
higher layer's function lives in that higher layer: the laws that mesh layer 7's witnesses are layer
8's (`pipeline-witnesses.laws.plato`).

| # | Folder | Library block name |
|---|---|---|
| 0 | `00-foundation` | `BrepFoundation` |
| 1 | `01-geometry` | `BrepGeometry` |
| 2 | `02-topology` | `BrepTopology` |
| 3 | `03-step` | `StepReading` |
| 4 | `04-discretization` | `EdgeDiscretizing` |
| 5 | `05-face-meshing` | `FaceMeshing` |
| 6 | `06-mesh` | `ModelMeshes` |
| 7 | `07-validation` | `BrepChecking` |
| 8 | `08-pipeline` | `StepToMesh` |

Laws live in `<stem>.laws.plato` in a block named `<LibraryBlock>Laws`.

## The compilation the gate runs

Phase 3 type-checks the sandbox together with the stdlib's `foundation`, `geometry`, and `graphics`
tiers, **excluding** the three stdlib files `brep.concepts.plato`, `brep.types.plato`, and
`brep.library.plato` (the faceted B-rep v1 this design replaces). Consequences for authors:

- The v1 names `BrepCurve`, `BrepSurface`, `BrepEdge`, `BrepFace`, `BrepLoop`, `BrepValidation`
  are **free** for the sandbox to declare with their v2 meanings.
- `EdgeOrientation` and `BrepEdgeUse` from the v1 file are **not available**. Layer 2 declares
  `EdgeOrientation` itself, identically to v1, and declares `Coedge` in place of `BrepEdgeUse`.
- Everything else in the three shipping tiers is available and must not be redeclared.

The driver and command are in [PLATO-PRIMER.md](PLATO-PRIMER.md) section E.3; its source is kept
under `tools/PlatoGate/` in this sandbox. The gate runs over every `NN-*/*.plato` file of the nine
layers merged into one folder (`*.spec.plato` files are skipped); since the name review the
`adapter/` folder holds no Plato. Result at revision 3: `PASS: 0 error(s) in scope; 6710 functions
type-checked`.

## Stdlib names reused as they are

Use these; do not redeclare them or declare a near-synonym.

| Stdlib name | File | Used for |
|---|---|---|
| `Number`, `Integer`, `Boolean`, `String` | `foundation/primitives.plato` | scalars. `Number` is a 32-bit float in the C# backend today (PLATO-PRIMER.md D); the design is written for a real and the width is an open question for the owner |
| `Array<T>`, `Array2D<T>`, `JaggedArray<T>`, `List<T>`, `Buffer<T>` | `foundation/primitives.plato`, `collections-jagged.types.plato` | collections; builders only inside function bodies |
| `Point3D`, `Vector3D`, `Direction3D`, `Point2D`, `Vector2D` | `foundation/points.types.plato`, `vectors.types.plato` | positions and displacements |
| `Frame3D` | `foundation/transforms.types.plato` | a placement: origin and three orthonormal axes (STEP `axis2_placement_3d`) |
| `InfiniteLine3D` | `geometry/lines.types.plato` | an axis: origin and direction (STEP `axis1_placement`) |
| `Angle`, `AngleInterval` | `foundation/quantities.types.plato`, `intervals.types.plato` | angular quantities; radians stored |
| `NumberInterval` | `foundation/intervals.types.plato` | a closed parameter range; empty when `Start > End` |
| `Bounds2D`, `Bounds3D` | `foundation/intervals.types.plato` | axis-aligned boxes |
| `UvCoordinate` | `foundation/points.types.plato` | a point in a surface's parameter space. The stdlib comment says "normalized"; **this design stores natural parameters in it** (an angle in radians, a length), and says so in every declaration that holds one |
| `ComparisonTolerance` | `foundation/numbers.types.plato` | absolute-plus-relative scalar near-equality |
| `KnotVector` | `geometry/splines.types.plato` | an expanded, non-decreasing knot sequence |
| `VertexIndex`, `FaceIndex`, `UndirectedEdgeIndex` | `geometry/topology.types.plato` | **mesh** vertex, element, and edge indices; also the indices of a face mesh's parameter-space points |
| `TriangleFace`, `QuadFace` | `geometry/topology.types.plato` | mesh elements over `VertexIndex` |
| `TriangleMesh3D`, `QuadMesh3D`, `PolygonMesh3D`, `HalfEdgeMesh` | `geometry/meshes.types.plato`, `topology.types.plato` | the stdlib mesh types this library converts **to**, explicitly |
| `Polyline2D`, `Polyline3D`, `Polygon2D`, `PolygonWithHoles2D` | `geometry/polygons.types.plato` | discretized curves and planar regions where the stdlib meaning fits |
| `IIndex`, `IValue`, `IEquatable`, `IOrderable`, `IProcedural<TDomain,TRange>` | `foundation/*.concepts.plato` | the interfaces new types implement |

Names in the stdlib that this design **does not** reuse, and why: `Plane` (normal-and-distance, no
in-plane axes, so no parameterization); `Cylinder`, `Cone`, `Sphere`, `Torus` (finite or
unit-square parameterized; STEP surfaces are placement-based and infinite in the unbounded
direction); `ICurve3D`, `IParametricSurface` (unit-square canonical domain; STEP uses natural
parameters); `VertexLayout` (`graphics/render.types.plato`, a GPU attribute layout; layer 6 uses
`MeshVertexNumbering`). Conversions to the stdlib geometry are explicit `To*` functions in
`06-mesh` and `01-geometry`.

## Exported names per layer

What the tree declares after the fix wave and the name review of 2026-10-17. Every name below is
**fixed**: a layer author does not rename it, and a change goes through "Changes to this contract".
Signatures are written with their parameter types where an overload exists. Each layer README's
"Names" or file table lists the rest of what the layer declares; a name not listed here is the
layer's own and may change inside the layer.

### 0. `00-foundation`

- `LengthTolerance { Value: Number }`, `AngleTolerance { Value: Angle }`,
  `ParameterTolerance { Value: Number }`, `UvTolerance { U: ParameterTolerance; V: ParameterTolerance }`.
- `Tolerances { Length: LengthTolerance; Angle: AngleTolerance; LengthParameter: ParameterTolerance; AngleParameter: ParameterTolerance }`:
  the model's tolerances. The two parameter fields are model-wide **floors**, one per kind of
  parameter (a length along a unit axis, an angle or knot), set by layer 3 with
  `LengthParameterFloor(length, extent)` and `AngleParameterFloor(length, modelSize, extent)`.
  `ScaledTolerances(t, factor)` scales the length and the length floor and keeps the others.
- Rounding: `ResolutionAt(magnitude)`, `ResolvableLength(length, extent)`, `IsResolvable`. A
  rounding floor is taken at the coordinate extent (the largest absolute coordinate), never at the
  model size.
- The tolerance at a point: `ParameterToleranceAt(t: Tolerances, floor: ParameterTolerance, speed, cap)`,
  `UvToleranceAt(t: Tolerances, floor: UvTolerance, speedU, speedV, d: SurfaceDomain)`.
- `Periodicity = Aperiodic | Periodic(Period: Number) | Closed(Period: Number)`. `Closed` is a
  direction whose formula does not wrap but whose ends coincide (a clamped closed B-spline); it is
  a period for every seam function (`HasSeam(p)`, `HasSeam(d: CurveDomain)`) and not for
  `IsPeriodic`.
- `CurveDomain { Range: NumberInterval; Periodicity: Periodicity }`,
  `SurfaceDomain { U: CurveDomain; V: CurveDomain }`, `DomainSide = UMin | UMax | VMin | VMax`,
  `SamplePlan { Count: Integer }` (both ends counted), `UnboundedDomain(_: CurveDomain)`,
  `IsPeriodicDomain(d)`.
- Typed indices, each `{ Value: Integer }` implementing `IIndex`, `-1` meaning none: `CurveIndex`,
  `Curve2DIndex`, `PcurveIndex`, `SurfaceIndex`, `BrepVertexIndex`, `BrepEdgeIndex`,
  `BrepLoopIndex`, `BrepFaceIndex`, `ShellIndex`, `BodyIndex`, `StepInstanceId`,
  `StepAttributeIndex`, `StepOccurrenceIndex`, `ElementIndex` (triangles first, then quads).
  `CornerIndex` is the stdlib's; a corner slot is an `Integer`.
- `MeshVertexProvenance = OnVertex(Vertex: BrepVertexIndex) | OnEdge(Edge: BrepEdgeIndex, Parameter: Number) | OnFace(Face: BrepFaceIndex, Uv: UvCoordinate)`,
  with `IsOnFace(p, f)`.
- `Provenance = Nowhere | WholeInput | AtInstance(Id: StepInstanceId) | KernelCurve(Index: CurveIndex) | KernelSurface(Index: SurfaceIndex) | KernelVertex(Index: BrepVertexIndex) | KernelEdge(Index: BrepEdgeIndex) | KernelLoop(Index: BrepLoopIndex) | KernelFace(Index: BrepFaceIndex) | KernelShell(Index: ShellIndex) | KernelBody(Index: BodyIndex) | MeshVertex(Index: VertexIndex) | MeshElement(Index: ElementIndex)`.
- `Severity = Error | Warning | Info`, `ConstraintGroup = Topological | Geometric | Quality`.
- `Check { Law: String; Holds: Boolean; Worst: Number; Bound: Number; Where: Provenance }`, built
  only by `CheckWithin(law, worst, bound, where)`, `CheckExact(law, holds, where)` and `WorseOf`;
  it holds exactly when `Worst <= Bound`. `Exceedance(c)`.
- `Diagnostic { Severity: Severity; Code: String; Message: String; Where: Provenance; Measure: Number }`.
- `Report { Checks: Array<Check>; Diagnostics: Array<Diagnostic> }`, built only by `Empty`,
  `Merge`, `ReportOf(c, g, message)`, `ReportOf(diagnostics)` and `Located(r, where)`; `IsClean`,
  `DiagnosticOf(c, g, message)`, `Located(d, where)`.
- Approximate equality: `Coincident` (`Point3D` with `LengthTolerance` or `Tolerances`, `Point2D`
  with `LengthTolerance`), `SameDirection` (`AngleTolerance` or `Tolerances`), `SameParameter`
  (numbers, domains and `UvCoordinate`s, with a `ParameterTolerance` or `UvTolerance`; no
  `Tolerances` form, the parameter tolerance is per point).
- Periodic arithmetic: `Wrap(t, period)` into `[0, period)` and its domain forms,
  `ShortestDifference(from, to, period)` in `[-period/2, period/2)`,
  `NearestUnwrapped(t, reference, period)` and its domain forms, `PeriodicRepresentativeAbove`.
- `Samples(range, count)`, `Samples(CurveDomain, SamplePlan)`, `Samples(SurfaceDomain, SamplePlan)`;
  `IntegerTotal(values)`; `Identical`, `Corresponds`.

### 1. `01-geometry`

- `BrepCurve` (3D, sum): `Line(Origin, Velocity: Vector3D)`, `Circle(Placement: Frame3D, Radius)`,
  `Ellipse`, `Hyperbola`, `Parabola`, `Polyline(Points)`, `BSpline(Data: BSplineCurveData)`,
  `Trimmed(Basis: CurveIndex, Range, SameSense)`, `Composite(Segments: Array<CompositeSegment>)`,
  `Offset(Basis: CurveIndex, Distance, Reference: Direction3D)`,
  `OnSurface(Curve: CurveIndex, Supports: Array<CurveSupport>, Master: PreferredRepresentation)`.
  A case is a distinct evaluation formula; basis curves are referenced by index, never nested.
- `BrepCurve2D` (sum): the same families in the parameter plane, without `OnSurface`.
- `BrepSurface` (sum): `Plane`, `Cylinder`, `Cone(Placement, Radius, SemiAngle: Angle)`, `Sphere`,
  `Torus(Placement, MajorRadius, MinorRadius, Part: TorusPart)`,
  `Revolution(Profile: CurveIndex, Axis: InfiniteLine3D)`,
  `LinearExtrusion(Profile: CurveIndex, Extrusion: Vector3D)`, `BSpline(Data: BSplineSurfaceData)`,
  `RectangularTrimmed(Basis, URange, VRange, USense, VSense)`, `Offset(Basis, Distance)`.
- `TorusPart = Full | Apple | Lemon`, `SurfaceParameter = ParameterU | ParameterV`,
  `CompositeSegment`, `CompositeSegment2D`, `CurveSupport = Parametric(Pcurve) | SurfaceOnly(Surface)`,
  `PreferredRepresentation = SpaceCurve | FirstPcurve | SecondPcurve`,
  `Pcurve { Surface: SurfaceIndex; Curve: Curve2DIndex }`.
- `SplineBasis { Degree: Integer; Knots: KnotVector }`; `BSplineCurveData`, `BSplineCurve2DData`
  (`Basis`, `ControlPoints`, `Weights`), `BSplineSurfaceData { U; V: SplineBasis; ControlPoints: Array2D<Point3D>; Weights: Array2D<Number> }`.
- `GeometrySet { Curves; Curves2D; Pcurves; Surfaces; Closures: Array<ClosureMark> }`: the arena.
  `ClosureMark = ClosedCurve(Curve) | ClosedCurve2D(Curve) | ClosedSurface(Surface, Direction: SurfaceParameter)`
  records the `Closed` decisions layer 3 makes at decode; `Domain` applies them.
- Views `ArenaCurve`, `ArenaCurve2D`, `ArenaSurface` and the concepts `INaturalCurve3D`,
  `INaturalCurve2D`, `INaturalSurface` they implement.
- Evaluation over the arena, on `CurveIndex`, `Curve2DIndex`, `PcurveIndex` and `SurfaceIndex`:
  `Domain`, `Eval`, `Derivative`, `SecondDerivative`, `ClosestParameter` (a pcurve's in a bounded
  representative range), `Breakpoints`, `Breaks(g, c, order)`, `PartialU`, `PartialV`,
  `NormalOr(g, s, uv, fallback)`, `Project(g, s, p)`, `DegenerateSides(g, s, tol: Tolerances)`,
  `AreaElement(g, s, uv)`, `IsClosed(g, c, tol)`, `PcurvesOf(g, c)`,
  `NormalAgreesWithParameterization(g, s)`.
- Per-point tolerances by direction kind: `ParameterToleranceAt(g, c | p, t, tol)`,
  `UvToleranceAt(g, s, uv, tol)`, `UvFloorOf(g, s, tol)`.
- Placements: `Handedness(f: Frame3D)`, `PlacementHandedness(g, s)` (the determinant sign layers 2
  and 3 fold), `OrthonormalityDeviation`, `IsOrthonormalWithin`.
- File-geometry measures layer 7 grades: `PlacementDeviation`, `TrimExcess`, `TrimBoxExcess`,
  `SegmentGap`, `SupportGap`, `PcurveToCurveGap`, `CurveToPcurveGap`, `PcurveDomainExcess`,
  `CollapsedLineSpread`, `OffsetReferenceAngle`, `ExtrusionProfileAngle`.
- `PcurveRangeOver(g, p, c, r)`, `TrimmedToBasis(g, basis, uRange, vRange, uSense, vSense, uv)`,
  `IsBreakKnot(b, i, order)`.
- Scaling about the origin (`BrepGeometryScaling`): `ScaledCurve(curve, k)`,
  `ScaledSurface(surface, g, k)`, `ScaledPcurve(curve2D, g, s, k)`, `ScaledGeometry(g, k)`,
  `ScaledFrame`, `ParameterScaleFactor`.
- Rigid motion (`BrepGeometryMotion`): `MovedVector`, `MovedDirection`, `MovedFrame`,
  `Moved(curve, motion)`, `Moved(surface, motion)`, `MovedGeometry(g, motion)`.
- `DefiningPoints(curve)`, `DefiningPoints(surface)`: the points a record stores.

### 2. `02-topology`

- `EdgeOrientation = Forward | Reversed` (identical to the stdlib v1 declaration the gate
  excludes).
- `Coedge { Edge: BrepEdgeIndex; Orientation: EdgeOrientation }`: one oriented citation of an edge
  in a loop (STEP `oriented_edge`), in place of v1's `BrepEdgeUse`.
- `BrepVertex { Point: Point3D }`,
  `BrepEdge { Start: BrepVertexIndex; End: BrepVertexIndex; Curve: CurveIndex; SameSense: Boolean }`.
- `BrepLoop = EdgeLoop(Coedges: Array<Coedge>) | VertexLoop(Vertex: BrepVertexIndex) | PolyLoop(Points: Array<Point3D>)`.
- `FaceBound { Loop: BrepLoopIndex; Orientation: Boolean; IsOuter: Boolean }`,
  `BrepFace { Surface: SurfaceIndex; SameSense: Boolean; Bounds: Array<FaceBound> }`.
- `BrepShell { Faces: Array<BrepFaceIndex>; DeclaredClosed: Boolean }`: no orientation flag; layer
  3 folds STEP's `oriented_face`, `oriented_closed_shell`, void orientation and mirrored
  placements into `BrepFace.SameSense` and `FaceBound.Orientation`.
- `BrepBody = ManifoldSolid(Outer: ShellIndex) | SolidWithVoids(Outer: ShellIndex, Voids: Array<ShellIndex>) | ShellSet(Shells: Array<ShellIndex>)`.
- `LengthUnit = Metre | Millimetre | Centimetre | Inch | Foot | Scaled(MetresPerUnit: Number)`.
- `BrepModel { Geometry: GeometrySet; Vertices: Array<BrepVertex>; Edges: Array<BrepEdge>; Loops: Array<BrepLoop>; Faces: Array<BrepFace>; Shells: Array<BrepShell>; Bodies: Array<BrepBody>; Tolerances: Tolerances; Unit: LengthUnit }`.
- `CoedgeSite { Face: BrepFaceIndex; Bound: Integer; Slot: Integer }`,
  `EdgeEnd { Edge: BrepEdgeIndex; IsStart: Boolean }`.
- Range predicates `IsVertexInRange`, `IsEdgeInRange`, `IsLoopInRange`, `IsFaceInRange`,
  `IsShellInRange`, `IsBodyInRange`, `IsEveryIndexInRange(m)`; traversal `StartVertex(m, c)`,
  `EndVertex(m, c)`, `LoopCoedges`, `ShellFaces`, `EdgesOfShell`, `FacesOfEdge(m, e)`,
  `FacesOfEdge(m, s, e)`, `CoedgeSitesOfEdgeInFace`, `Opposite`.
- `EdgeDomain(m, e): CurveDomain` (range always increasing; a closed edge spans one period on a
  `Periodic` or `Closed` curve), `PcurveEdgeDomain(m, e, p)` (through layer 1's
  `PcurveRangeOver`), `IsClosedEdge`, `IsDegenerateEdge`, `SharesCurveParameter`.
- `CoedgeRunsForwardOnCurve(m, bound: FaceBound, coedge: Coedge)` and `(m, site: CoedgeSite)`: the
  composed sense; `FaceNormalSign(m, f): Integer`, `sigma(SameSense) * epsilon` against
  `PartialU x PartialV`.
- `ShellCounts { Vertices; Edges; Faces; Loops: Integer }`, `RawCounts(m, s)`,
  `ReducedCounts(m, s)` (degenerate edges contracted, redundant vertex loops dropped, poly-loop
  points identified), `IsRedundantVertexLoop(m, f, b)`, `KeptBounds(m, f)`, `EulerPoincare(c)`,
  `ShellEulerPoincare`, `ShellGenus`, `OrientationFlips(m, s)`.
- Size and extent: `ModelSize(m)` (the bounding diagonal of the model's defining points),
  `CoordinateExtent(m)` (their largest absolute coordinate), `BoundingDiagonal(points)`.
- Model transforms: `ScaledPoint(p, factor)`, `ScaledBy(m, factor)`, `RigidlyMoved(m, motion)`,
  `Reversed(face)`, `WithFacesReversed(m, faces)`, `WithEveryFaceReversed(m)`,
  `WithEdgeReversed(m, e)`.
- Laws, among them: `Law_IndicesInRange`, `Law_LoopsChainEndToStart`,
  `Law_EveryEdgeUsedTwiceInClosedShell`, `Law_EdgeUsesHaveOppositeOrientation`,
  `Law_SeamUsesRunOpposite` (a seam's two uses in one face run opposite), `Law_AtMostOneOuterBound`,
  `Law_AtLeastOneBound`, `Law_EulerPoincareEvenAndBounded`, `Law_OpenShellEulerEvenAndBounded`,
  `Law_VertexCoincidesWithCurveEnd`, `Law_EdgeLiesOnAdjacentSurfaces`, `Law_PcurveAgreesWithCurve`,
  `Law_VertexLinkIsOneCycle`, `Law_DeclaredClosedIsClosed`,
  `Law_DegenerateEdgeHasCoincidentVertices`, `Law_ShellIsConnected`, `Law_ShellIsOrientable`,
  `Law_PolyLoopEdgesPairUp`, `Law_PolyLoopHasThreePoints`, `Law_NoRedundantVertexLoop` (Warning),
  `Law_ParameterizationSignIsConstantOnFace`.

### 3. `03-step`

- `Part21File { Header: StepHeader; Instances: Array<StepInstance>; Attributes: Array<StepAttribute> }`:
  instances in ascending `Id`; attributes in one flat arena, children before parents.
- `StepHeader { Description; ImplementationLevel; Name; TimeStamp; Author; Organization; PreprocessorVersion; OriginatingSystem; Authorization; Schema }`.
- `StepInstance { Id: StepInstanceId; Body: StepInstanceBody }`;
  `StepInstanceBody = Simple(TypeName: String, Attributes: Array<StepAttributeIndex>) | Complex(Parts: Array<StepSimpleRecord>)`;
  `StepSimpleRecord { TypeName: String; Attributes: Array<StepAttributeIndex> }`.
- `StepAttribute = IntegerValue(Value: Integer) | RealValue(Value: Number) | StringValue(Value: String) | EnumValue(Name: String) | BinaryValue(Bits: String) | Reference(Id: StepInstanceId) | Typed(TypeName: String, Inner: StepAttributeIndex) | ListValue(Items: Array<StepAttributeIndex>) | Unset | Derived`.
- `ParsedFile { Ok: Boolean; File: Part21File; Diagnostics: Array<Diagnostic> }`.
  `ParseStep(text): ParsedFile` and `PrintStep(file): String` are host obligations: bodiless, bound
  to the host's parser through the foreign function interface. `IsSameFile`, `InstancePosition`,
  `SatisfiesFileInvariants`.
- The schema model of the supported subset: `EntityDefinition`, `AttributeDefinition`,
  `AttributeKind`, `AggregateForm`, `AggregateBound`, `ValueRule`, `EntityTreatment`, `RecordSlot`,
  `StepKnotSpec`, `SupportedSchema(_: Part21File)`. No typed `StepEntity` sum: decoding goes from
  `Part21File` to kernel types, and the WHERE rules are laws over `Part21File`.
- `ProvenanceMap { Occurrences; Sources: KernelSources; ByInstance; Folds: Array<FoldRecord>; Repairs: Array<RepairRecord> }`,
  keyed by `StepSource { Occurrence: StepOccurrenceIndex; Instance: StepInstanceId }`, with
  `StepOccurrence`, `KernelElement`, `FoldCause = OrientedFace | OrientedShell | MirroredPlacement`,
  `StepRepair`, and `KernelOf(map, source)`.
- `DecodePolicy` (with `StandardPolicy`), `ContextUnits`, `ContextUncertainty`, `ResolveContexts`;
  `ModelLengthTolerance(used, unit, modelSize, extent, policy)`,
  `ModelTolerances(used, unit, modelSize, extent, policy)`.
- `DecodedModel { Model: BrepModel; Map: ProvenanceMap; Diagnostics: Array<Diagnostic>; ModelSize: Number; CoordinateExtent: Number }`,
  `DecodeBrep(file)` (`DecodeBrepWith(file, DecodePolicy.StandardPolicy)`),
  `DecodeBrepWith(file, policy)`.
- Closure at decode: `DecidesClosed` (curve, surface direction), `ClosureMarks(g, tol)`,
  `WithClosures(g, marks)`, `Law_ClosureMarksAreTheDecisions`; the mirror fold, `IsMirroredSource`.
- Findings: `StepDiagnosticCode` (every code the layer writes), `Diagnose(code, where, measure)`,
  `StepFindingSubject = AboutInput | AboutInstance | AboutGeometry`, `SubjectOf`, `FitsSubject`,
  `PointsAtSubject`.
- WHERE rules of ISO 10303-42 for every decoded entity, as `Law_` functions over `Part21File`.
- `Part21File` witnesses (`step-witnesses.laws.plato`, generated with the adapter fixtures):
  `Witness_Part21UnitBox`, `Witness_Part21UnitBoxNoShape`, `Witness_Part21UnitBoxDangling`,
  `Witness_Part21UnitBoxTruncatedPrefix`, `Witness_Part21TwoCubes`.

### 4. `04-discretization`

- `Limit = Unlimited | AtMost(Value: Number)`, with `ScaledBy(l, factor)`.
- `DiscretizationCriteria { Chordal: Number; Angular: Angle; MaxLength: Limit; MinLength: Number; MinSegments: Integer }`,
  with `DefaultCriteria(chordal)`, `WithChordal`, `ScaledBy(c, factor)`. `Angular` is the turning
  angle at non-seed joints and twice the tangent deviation per segment.
- `SegmentFloors { ByEdge: Array<Integer> }`, `NoFloors`.
- `EdgeDiscretization { Edge: BrepEdgeIndex; Parameters: Array<Number>; Points: Array<Point3D> }`:
  canonical values strictly increasing from the edge domain's start to its end, end points the
  vertex points exactly; `Undiscretized(e)` (empty) for an edge that cannot be discretized,
  `IsDiscretized(d)`.
- `EdgeDiscretizations { ByEdge: Array<EdgeDiscretization> }` indexed by `BrepEdgeIndex`.
- `EdgeImage { Face: BrepFaceIndex; Pcurve: PcurveIndex }`, `ImagePoints(m, d, image)`: the one
  parameter-space image function face meshing uses.
- `RefinementReason = LoopSelfIntersects | TooCoarseInParameterSpace | QuadCountMismatch`.
- `EdgeRefinementRequest { Edge: BrepEdgeIndex; Reason: RefinementReason; Chordal: Number; Segments: Integer }`.
- `Discretize(m, e, c, floors)`, `DiscretizeAll(m, c, floors)` (total: `Undiscretized` for a
  rejected edge), `Refine(m, d, requests, c)` (only the requested edges change),
  `IsRefinable(m, d, requests, c)`, `Reversed(d)`, `SameDiscretization(a, b)`,
  `IsClosedRegularEdge(m, e)`, `MeetsCriteria(m, d, c)`.
- Measures: `Sagitta(m, e, t0, t1)` (exact, deferred), `SampledSagitta(m, d, plan, i)`,
  `TurningAngle(d, i): Angle`, `TangentDeviation(m, d, plan, i): Angle`.

### 5. `05-face-meshing`

- `UvPointSource = FromVertex(Vertex: BrepVertexIndex) | FromEdge(Edge: BrepEdgeIndex, Index: Integer) | SeamCut(Side: DomainSide, Index: Integer) | Pole(Side: DomainSide, Index: Integer) | Interior`:
  `SeamCut` and `Pole` are synthetic boundary points; `FromEdge` indices run 1 to count - 2, end
  samples are `FromVertex`.
- `UvLoop { Points; Sources }`, `UvRegion { Outer: UvLoop; Holes: Array<UvLoop> }`, `UvSample`,
  `FaceChart { Mirrored; ScaleU; ScaleV }`, `QuadSides`.
- `FaceMeshingCriteria { Discretization: DiscretizationCriteria; SurfaceChordal: Number; SurfaceAngular: Angle; PreferQuads: Boolean }`,
  with `ScaledBy(c, factor)`. `SurfaceAngular` is the normal turn along a surface edge.
- `UvTriangulation { Points; Sources; Triangles: Array<TriangleFace>; Quads: Array<QuadFace> }`,
  `QuadGridOutcome = NoGrid | CountsDiffer(Floors: SegmentFloors) | Grid(Mesh: UvTriangulation)`.
- `FaceMesh { Face; UvPoints; Sources; LocalVertex: Array<VertexIndex>; Positions; Normals; Triangles; Quads; Provenance: Array<MeshVertexProvenance> }`:
  parameter-space points distinct from local 3D vertices; normals per parameter-space point.
- `FaceMeshOutcome { Mesh: FaceMesh; Requests: Array<EdgeRefinementRequest>; Diagnostics: Array<Diagnostic> }`:
  only a blocking request (`IsBlocking`) comes with an empty mesh.
- `LoopToUv(m, f, b: FaceBound, d)`, `Unwrap(m, f, l)` (seams by the left rule),
  `MeshedBounds(m, f)` (layer 2's `KeptBounds`), `AddMissingSeamsAndPoles(m, f, loops, c)`,
  `RegionOf(m, f, d, c)`, `OrientRegion(m, f, r)`, `ChartOf(m, f, r)`,
  `TriangulateRegion(r, chart)`, `RefineToSurface(m, f, r, chart, t, c)`,
  `QuadGridIfRectangular(m, f, d, r, c)`, `Lift(m, f, d, t)`, `MeshFace(m, f, d, c)`,
  `ImageInFace(m, f, e)`, `IsDiscretizedFace(m, f, d)`, `IsCollapsedElement(t, k)`,
  `SameFaceMesh`, `SameFaceMeshOutcome`; region queries `LoopOffset`, `LoopOfBoundaryPoint`,
  `NextBoundaryPoint`.
- Laws `MeshFace` ensures and layer 8 relies on: `Law_RequestsNameFaceEdges`,
  `Law_MeshFaceReadsOnlyFaceEdges`; and `Law_SeamUsesOnOppositeCopies`,
  `Law_BoundarySegmentIsElementSide`, `Law_InteriorSideIsShared`,
  `Law_ElementLiftsFacingFaceNormal`.

### 6. `06-mesh`

- `MeshVertexSite = ModelVertex(Vertex) | EdgeInterior(Edge, Slot) | FaceInterior(Face, Slot)`;
  `MeshVertexNumbering { ModelVertexCount: Integer; EdgeInteriorStart: Array<Integer>; FaceInteriorStart: Array<Integer> }`
  (CSR offsets, E + 1 and F + 1 entries); `NumberMeshVertices(m, d, faceMeshes)`,
  `GlobalIndex(n, p, slot)`, `IsSameNumbering`.
- `ModelMesh { Positions: Array<Point3D>; Triangles: Array<TriangleFace>; Quads: Array<QuadFace>; CornerNormals: Array<Direction3D>; CornerUvs: Array<UvCoordinate>; ElementFace: Array<BrepFaceIndex>; VertexProvenance: Array<MeshVertexProvenance>; Numbering: MeshVertexNumbering }`:
  normals and parameter values per element corner, positions and provenance per vertex.
- `AssembleModelMesh(m, faceMeshes, numbering)`: boundary vertices map to shared global indices
  through their provenance; no welding by distance. `SameConnectivity(a, b)` compares triangles,
  quads, element faces, vertex count and numbering.
- `MeshEdgeTable { Edges: UndirectedEdgeList; ElementCounts; DirectionSums }`; `IsManifold`,
  `IsClosed`, `IsConsistentlyOriented`, `EulerCharacteristic`, `ReferencedEulerCharacteristic`.
- Components: `MeshComponentIndex`, `MeshComponents { ElementComponent; VertexComponent; ComponentCount; ElementParent; ElementDepth }`,
  `MeshComponentCounts` (nine counts, `BoundaryCycles` among them), `ComponentsOf`,
  `ComponentCountsOf`, `CountsOf`, `Genus(c, fallback)` (2 - chi - B).
- Measures: `Area`, `FaceMeshArea`, `SignedVolume(mesh)` and per component,
  `AngleDefectSum(mesh, comps, c): Angle`, `CompensatedSum(values)`, `TotalsAgree(a, b)`,
  `RestrictedToFaces(mesh, faces)`, `Reversed(mesh)`.
- Quality: `TriangleQuality`, `QuadQuality`, `MeshQualityThresholds` (with `CubitAcceptable`),
  `TriangleQualityOf(Triangle3D)`, `QuadQualityOf(Quad3D)`.
- Conversions: `ToTriangleMesh3D(mesh)`, `ToQuadMesh3D(mesh): QuadMeshOutcome`,
  `ToPolygonMesh3D(mesh)`, `ToSplitTriangleMesh3D(mesh): SplitTriangleMesh3D`.
- Laws, among them: `Law_CornerProvenanceIsOnItsElementFace`, `Law_VectorAreaVanishes`.

### 7. `07-validation`

- `ConformanceLevel = Structural | Geometric | Oracle`,
  `CheckFamily = StructureChecks | GeometryChecks | QualityChecks | OracleChecks | SelfTestChecks`.
- Validators, each with a structural default and a form that takes the level:
  `ValidateStep(file)`, `ValidateStep(file, level)`, `ValidateBrep(m)`, `ValidateBrep(m, level)`,
  `ValidateDiscretizations(m, d)`, `ValidateDiscretizations(m, d, c, floors, level)`,
  `ValidateFaceMesh(m, fm)`, `ValidateFaceMesh(m, d, fm, c, level)`,
  `ValidateFaceMeshOutcome(o)`, `ValidateModelMesh(mesh)`,
  `ValidateModelMesh(mesh, t: Tolerances, th: MeshQualityThresholds, level)`,
  `ValidateAssembly(m, d, faceMeshes, mesh, level)`, `CrossCheck(m, mesh, level)`,
  `CrossCheck(m, mesh, level, c: FaceMeshingCriteria)`.
- Report builders over layer 0's `Check.Bound`: `ExactReport(c, msg)`, `MeasuredReport(c, msg)`,
  `QualityReport(c, msg)`, `WarningReport(c, msg)`; `TopologyReport(m, plan, family)`.
- The oracles: `Oracle_FaceAreaByGreen`, `Oracle_PlanarFaceArea`, `Oracle_CylinderPatchArea`,
  `Oracle_SphereArea`, `Oracle_TorusArea`, `Oracle_ConePatchArea`, `Oracle_SphereZoneArea`,
  `Oracle_TorusPatchArea`, `Oracle_AngleDefectSum`, `Oracle_DivergenceVolume`, `Oracle_BodyVolume`,
  `Oracle_EulerCharacteristic`, with their allowances `GreenAllowance`, `DivergenceAllowance`,
  `FaceAreaTolerance`.
- The witnesses, each with its counts stated: `Witness_UnitBox`, `Witness_Box(w, d, h)`,
  `Witness_Cylinder` (one seam), `Witness_Sphere` (two poles), `Witness_SphereByPoleLoops`,
  `Witness_Torus` (two seams), `Witness_Cone` (an apex), `Witness_BlockWithThroughHole` (genus
  one), `Witness_HollowBox` (a void shell), `Witness_BSplinePatchSolid`; negative witnesses
  `Witness_SphereWithRedundantPoleLoops`, `Witness_BoxWithFlippedFace`,
  `Witness_TwoBoxesSharingCorner`; the planted bad face `Witness_BoxWithPolyLoopSheet`.
  `WitnessFacts`, `WitnessAt`, `FactsAt`, `SameModel`; the corpus `CorpusEntry`, `Corpus`.
- Laws, among them: `Law_OuterShellExactVolumePositive`, `Law_VoidShellExactVolumeNegative`,
  `Law_MeshEulerEqualsBrepEuler` (per shell, on reduced counts),
  `Law_VertexReevaluatesFromProvenance`, `Law_FaceAreaMatchesOracle`,
  `Law_DivergenceEqualsTorusVolume`, `Law_EveryFaceIsMeshed`.

### 8. `08-pipeline`

- `MeshingOptions { Face: FaceMeshingCriteria; Level: ConformanceLevel; MaxRefinementRounds: Integer; Decode: DecodePolicy; Quality: MeshQualityThresholds }`,
  `DefaultMeshingOptions(chordal)`, `RelativeMeshingOptions(m, fraction)`,
  `Witness_UnitScaleOptions`, `ScaledBy(o, factor)`.
- `PipelineState { Round; Discretizations; Floors; Outcomes: Array<FaceMeshOutcome>; Pending }`,
  `InitialState`, `Step`, `StateAfter`, `FinalState`, `IsTerminal`, `IsRunnable`, `AllFaces`.
- `MeshOutcome { Ok: Boolean; Mesh: ModelMesh; Report: Report; Rounds: Integer }`, `Ok` set only by
  `MeshOutcomeOf` as `Report.IsClean`; `StepMeshOutcome { Decoded: DecodedModel; Meshed: MeshOutcome }`.
  Layer 3's `ParsedFile` and `DecodedModel` serve where revision 2 proposed `ParseOutcome` and
  `DecodeOutcome`.
- `MeshModel(m, o)` (`MeshChosenFaces(m, o, AllFaces(m))`): the bounded loop (discretize all edges,
  mesh every face, refine the requested edges and mesh their faces again, stop when nothing is
  pending or at the round limit).
- `Validated(m, mesh, o)`: `ValidateBrep(o.Level)`, `ValidateModelMesh(m.Tolerances, o.Quality, o.Level)`,
  `CrossCheck(mesh, o.Level, o.Face)`.
- `MeshStepTextTraced(text, o): StepMeshOutcome`, `MeshStepText(text, o): MeshOutcome`.
- Laws over layer 7's witnesses that mesh them (`pipeline-witnesses.laws.plato`,
  `StepToMeshWitnessesLaws`): `WitnessOptions`, `WitnessOutcome`, `WitnessMesh`, the meshed-witness,
  planted-face and metamorphic laws.
- Laws, among them: `Law_FailedFaceLeavesOthersUnchanged`, `Law_ValidationIsIdempotent`,
  `Law_PendingRequestsAreRefinable`, `Law_PowerOfTwoScalingKeepsConnectivity`,
  `Law_RigidMotionMovesPositions`.

## Naming rules

- Kernel topology types carry the `Brep` prefix (`BrepFace`), their indices `Brep<Thing>Index`,
  except `ShellIndex`, `BodyIndex`, and `Coedge` where no stdlib collision exists.
- STEP-layer types carry the `Step` prefix. A decoded entity type, if the author introduces them,
  is the EXPRESS name in PascalCase with the prefix: `advanced_face` becomes `StepAdvancedFace`.
- Sum case names are nouns without prefix (`Cylinder`, not `CylindricalSurface`), because the sum
  type qualifies them (`BrepSurface.Cylinder(...)`); always write the qualified form.
- Mesh-side indices are the stdlib's (`VertexIndex`, `FaceIndex`); `ElementIndex` is ours because
  the mesh holds triangles and quads in two arrays.
- Functions: `Is*` for predicates, `To*` for lossy or choice-making conversions, a type name for a
  faithful conversion (stdlib rule), `Law_`, `Witness_`, `Oracle_`, `Check_` as in SPEC-DSL.md.
- Angles are `Angle`, never `Number`. Lengths are `Number` in the model's `LengthUnit`.
- Before declaring any new name, check `stdlib/types-and-concepts.txt` and PLATO-PRIMER.md
  section G.

## Changes to this contract

Format: date, layer, old name, new name, reason.

- 2026-10-17, 2, `BrepEdgeUse` (reused), `Coedge` (declared): the stdlib type indexes a mesh edge
  (`UndirectedEdgeIndex`); the kernel needs `BrepEdgeIndex`. Found by the validation and primer
  agents.
- 2026-10-17, 2, `EdgeOrientation` (reused), `EdgeOrientation` (declared identically): the gate
  excludes the stdlib's three `brep.*.plato` files so the v2 names are free.
- 2026-10-17, 2, `Law_EveryEdgeUsedTwiceWithOppositeOrientation`, split into
  `Law_EveryEdgeUsedTwiceInClosedShell` and `Law_EdgeUsesHaveOppositeOrientation`: one statement per
  law (SPEC-DSL.md).
- 2026-10-17, 2, (new) `ShellCounts`, `ReducedCounts`: Euler-Poincare needs degenerate edges
  contracted and redundant vertex loops dropped (`research/VALIDATION-MATH.md` section 1).
- 2026-10-17, 3, (new) orientation folding rule: STEP oriented faces and shells have no kernel type.
- 2026-10-17, 4, `DiscretizationCriteria` gains `MinLength`; (new) `SegmentFloors`,
  `RefinementReason`, `EdgeRefinementRequest`, `Refine`; `Discretize` evaluates criteria in each
  adjacent face's parameter space too: `research/MESHING-REQUIREMENTS.md` finding 2 (every kernel
  that is gap-free re-discretizes edges against both faces) and finding 1 on termination.
- 2026-10-17, 5, `BoundarySource`, `UvPointSource` with `SeamCut`, `Pole`, `Interior` cases: faces
  that cover a whole sphere or torus, or contain a pole that is not a vertex, need synthetic
  boundary points (`research/MESHING-REQUIREMENTS.md` finding 5).
- 2026-10-17, 5, `FaceMesh` restructured: parameter-space points distinct from 3D vertices
  (`LocalVertex`), normals per parameter-space point; (new) `FaceMeshOutcome` carrying refinement
  requests.
- 2026-10-17, 6, `VertexLayout`, `MeshVertexNumbering`: the stdlib has a `VertexLayout`
  (`graphics/render.types.plato`).
- 2026-10-17, 6, `ModelMesh.Normals`/`Uvs` per vertex, `CornerNormals`/`CornerUvs` per element
  corner: a seam vertex has two parameter values, a crease vertex several normals
  (`research/MESHING-REQUIREMENTS.md` finding 6); (new) `ToSplitTriangleMesh3D`.
- 2026-10-17, 7, library block `BrepValidation`, `BrepChecking`: the stdlib v1 has a type
  `BrepValidation`; the name would read badly if the v1 file is kept.
- 2026-10-17, 7, (new) `Oracle_FaceAreaByGreen`, `Law_OuterShellVolumePositive`,
  `Law_VoidShellVolumeNegative`, `Law_MeshEulerEqualsBrepEuler`,
  `Law_VertexReevaluatesFromProvenance`: `research/VALIDATION-MATH.md` sections 4 and 5.
- 2026-10-17, 8, `MeshingOptions` gains `MaxRefinementRounds`; (new) `MeshModel` as a bounded loop;
  `MeshOutcome` gains `Rounds`.
- 2026-10-17, all, `UvCoordinate` reused for natural parameters: the stdlib comment says
  "normalized"; the design states the deviation in every declaration that holds one.

Revision 3, 2026-10-17: after Phase 1 (the layer authors), the fix wave (`reviews/FIX-WAVE.md`) and
the name review. One line per change; the layer READMEs' "Changes to the contract", "Fix wave" and
"Name review" sections hold the full lists.

- 2026-10-17, 0, `Tolerances.Parameter`, `LengthParameter` and `AngleParameter`: one floor per kind
  of parameter (fix wave, review C2); `ParameterFloor` became `LengthParameterFloor(length, extent)`
  and `AngleParameterFloor(length, modelSize, extent)`.
- 2026-10-17, 0, `Periodicity` gains `Closed(Period)`: a clamped closed B-spline has coincident
  ends but no wrapping formula (review T1, C1); (new) `HasSeam` on `Periodicity` and `CurveDomain`.
- 2026-10-17, 0, `Provenance` gains `WholeInput`, `KernelCurve`, `KernelSurface`: findings about
  the whole file and about a geometry record get a location (fix wave; layer 8's `WholeInput`
  sentinel deleted).
- 2026-10-17, 0, `Check` gains `Bound`, set by `CheckWithin`, `CheckExact`, `WorseOf`;
  `DiagnosticOf` and `ReportOf` drop their bound argument; (new) `Exceedance`: layer 7 wrote the
  bound twice.
- 2026-10-17, 0, `Report` gains the constructor `Located(r, where)`, with `Located(d, where)`:
  taken from layer 8.
- 2026-10-17, 0, rounding floors at the coordinate extent, not the model size; (new)
  `ResolutionAt`, `ResolvableLength`; `ParameterToleranceAt` and `UvToleranceAt` take the floor.
- 2026-10-17, 0, (new) `UvTolerance`, `ConstraintGroup`, `StepOccurrenceIndex`,
  `UnboundedDomain`, `IsPeriodicDomain`, `PeriodicRepresentativeAbove`, `IntegerTotal`,
  `IsOnFace`: stand-ins of layers 1, 2, 3, 5, 6, 8 moved down (fix wave).
- 2026-10-17, 0, proposed `Coincident`, `SameDirection`, `SameParameter`, `Samples`, `SamplePlan`,
  `Wrap`, `ShortestDifference`, `NearestUnwrapped` fixed with the signatures listed above;
  `SamplePlan.Count` counts both ends (review C8).
- 2026-10-17, 0, (new) `ScaledTolerances(t, factor)`: moved from layer 2's stand-in (name review).
- 2026-10-17, 1, `BSplineCurveData`, `BSplineSurfaceData` hold a `SplineBasis`; (new)
  `BSplineCurve2DData`, `CompositeSegment`, `CompositeSegment2D`, `CurveSupport`, `TorusPart`,
  `SurfaceParameter`, the arena views: payloads written once per basis.
- 2026-10-17, 1, proposed `SurfaceCurveKind` dropped (derivable from the supports);
  `PreferredRepresentation` fixed with three cases.
- 2026-10-17, 1, `DegenerateSides(g, s)`, `DegenerateSides(g, s, tol)`: a spline side collapses
  within a tolerance.
- 2026-10-17, 1, `GeometrySet` gains `Closures: Array<ClosureMark>` (fifth field): closure decided
  once at decode and seen by every layer.
- 2026-10-17, 1, (new) evaluation on `PcurveIndex` and `Curve2DIndex`, `PcurvesOf`,
  `NormalAgreesWithParameterization`: one owner (layers 2 and 4 deleted their copies, fix wave).
- 2026-10-17, 1, (new) `Handedness`, `PlacementHandedness`; placement laws admit mirrored frames
  (review F2).
- 2026-10-17, 1, Boolean file-geometry claims, measures (`PlacementDeviation`, `TrimExcess`,
  `SegmentGap`, `SupportGap`, ...): layer 7 grades them (fix wave).
- 2026-10-17, 1, (new) `PcurveRangeOver`, `TrimmedToBasis(g, basis, ...)`, `Breaks(order)`,
  `IsBreakKnot(b, i, order)`, `UvFloorOf`, per-kind parameter floors (review F4, F5, C2).
- 2026-10-17, 1, (new) `ScaledCurve`, `ScaledSurface`, `ScaledPcurve`, `ScaledGeometry` in
  `BrepGeometryScaling`: layer 2's `ScaledBy` builds on them (fix wave ownership table).
- 2026-10-17, 1, (new) `BrepGeometryMotion` (`MovedVector`, `MovedDirection`, `MovedFrame`,
  `Moved` on curves and surfaces, `MovedGeometry`) and `DefiningPoints`: layer 2's
  `belongs-in: 01-geometry` stand-ins moved here (name review).
- 2026-10-17, 2, (new) `CoedgeSite`, `EdgeEnd`; `CoedgeRunsForwardOnCurve` typed, with a
  `CoedgeSite` overload; `FaceNormalSign(m, f): Integer`.
- 2026-10-17, 2, `EdgeDomain`: range always increasing, a closed edge spans one period on a
  `Periodic` or `Closed` curve; (new) `PcurveEdgeDomain` over layer 1's `PcurveRangeOver`
  (review F4).
- 2026-10-17, 2, (new) `RawCounts`, `EulerPoincare`, `ShellEulerPoincare`, `ShellGenus`,
  `IsRedundantVertexLoop`, `KeptBounds`, `OrientationFlips`, `SharesCurveParameter`.
- 2026-10-17, 2, (new) laws `Law_ShellIsConnected`, `Law_ShellIsOrientable`,
  `Law_OpenShellEulerEvenAndBounded`, `Law_PolyLoopEdgesPairUp`, `Law_PolyLoopHasThreePoints`,
  `Law_NoRedundantVertexLoop` (Warning), `Law_ParameterizationSignIsConstantOnFace`.
- 2026-10-17, 2, (new) `ModelSize(m)`, `CoordinateExtent(m)`, `BoundingDiagonal`: the two
  magnitudes layer 0's floors read and layer 3 exports.
- 2026-10-17, 2, (new) `ScaledBy(m, factor)`, `RigidlyMoved(m, motion)`, `ScaledPoint`,
  `WithEveryFaceReversed`, `WithEdgeReversed`, and layer 4's topology queries with
  `FacesOfEdge(m, e)`: one owner (layers 4, 7, 8 deleted their copies); the contracts of the
  three transforms moved here from layer 8's spec (name review).
- 2026-10-17, 2, `Law_SeamUsesAreInOneFace`, `Law_SeamUsesRunOpposite`: the law says the seam's
  two uses run opposite (review F12; renamed in layers 2, 7 and 8 by the name review).
- 2026-10-17, 3, `ProvenanceMap` keyed by `StepSource` with occurrences, folds and repairs; (new)
  `KernelOf`, `KernelElement`: a part placed twice has two kernel copies of one instance.
- 2026-10-17, 3, `StepHeader` completed to ten fields; `Part21File.Instances` in ascending `Id`.
- 2026-10-17, 3, `AttributeKind` is the element kind only; (new) `AggregateForm`,
  `AggregateBound`, `ValueRule`, `EntityTreatment`, `RecordSlot`, `StepKnotSpec`.
- 2026-10-17, 3, proposed typed `StepEntity` sum not introduced: decoding goes straight to kernel
  types with WHERE laws over `Part21File`.
- 2026-10-17, 3, (new) `DecodePolicy`, `DecodeBrepWith`, `ContextUnits`, `ContextUncertainty`,
  `StepDiagnosticCode`, `Diagnose`: defaults and codes as data.
- 2026-10-17, 3, `DecodedModel` gains `ModelSize`, `CoordinateExtent`; `ModelLengthTolerance` and
  `ModelTolerances` take the extent.
- 2026-10-17, 3, (new) `DecidesClosed`, `ClosureMarks`, `WithClosures`,
  `Law_ClosureMarksAreTheDecisions`, `IsMirroredSource`, `StepFindingSubject`, `SubjectOf`,
  `FitsSubject`, `PointsAtSubject`; codes `ClosedFlagWithoutClosure`, `ClosureWithoutClosedFlag`.
- 2026-10-17, 3, `ParseStep`, `PrintStep`: host obligations bound through the foreign function
  interface, signatures unchanged (owner decision in `PLAN.md`).
- 2026-10-17, 3, `ModelSize(points)` deleted: a forwarder to layer 2's `BoundingDiagonal` with no
  callers left (name review).
- 2026-10-17, 3, `adapter/part21-witnesses.laws.plato` (`Part21Witnesses`),
  `03-step/step-witnesses.laws.plato` (`StepWitnessesLaws`): the `Part21File` witnesses are this
  layer's data (name review).
- 2026-10-17, 4, `EdgeRefinementRequest` gains `Segments`; `Sagitta` kept exact, (new)
  `SampledSagitta`; `TurningAngle(d, i): Angle`, (new) `TangentDeviation`; `Angular` defined.
- 2026-10-17, 4, (new) `EdgeImage`, `ImagePoints`: one image function for layers 4 and 5
  (review C5).
- 2026-10-17, 4, `DiscretizeAll` total with `Undiscretized(e)`, `IsDiscretized`;
  `Law_AtLeastTwoParameters`, `Law_EmptyOrAtLeastTwoParameters` (layer 8 finding 2).
- 2026-10-17, 4, `IsRefinable(m, ds)`, `IsRefinable(m, ds, requests, c)`; `SameDiscretization`
  moved from the laws block to `EdgeDiscretizing` (layer 8 findings 2, 3).
- 2026-10-17, 4, (new) `IsClosedRegularEdge`, `MeetsCriteria`, `Law_CertifiedSagittaWithinChordal`;
  `Law_ImageFollowsPcurve`, `PcurveGap`, `UvGap`, `PeriodicGap` deleted (review F9).
- 2026-10-17, 4, (new) `ScaledBy` on `DiscretizationCriteria` and `Limit`: moved from layer 8's
  stand-ins (name review).
- 2026-10-17, 5, `RegionOf(m, f, d, c)`, `Lift(m, f, d, t)`: synthetic boundary points sampled
  under the criteria; shared positions copied from the discretization.
- 2026-10-17, 5, `FaceMeshOutcome`: only a blocking request comes with an empty mesh;
  `SurfaceAngular` is the normal turn along a surface edge.
- 2026-10-17, 5, (new) `UvSample`, `FaceChart`, `QuadSides`, `QuadGridOutcome`, library block
  `UvRegions`; `CoedgeUvRoute`, `ChooseUvRoute`, `PcurveUv`, `UvOfPoint` deleted for layer 4's
  `ImagePoints` (review C5).
- 2026-10-17, 5, `Unwrap` places seams by the left rule; (new) `Law_SeamUsesOnOppositeCopies`
  (review F1, M8).
- 2026-10-17, 5, theorem `ChartWindingIsFaceWinding` and conjecture
  `NormalTurnBoundsCentroidDeviation` dropped; (new) `Law_BoundarySegmentIsElementSide`,
  `Law_InteriorSideIsShared`, `Law_ElementLiftsFacingFaceNormal`, `IsCollapsedElement`.
- 2026-10-17, 5, `MeshFace` ensures `Law_RequestsNameFaceEdges` and
  `Law_MeshFaceReadsOnlyFaceEdges`; `IsDiscretizedFace` moved into `FaceMeshing`; (new)
  `SameFaceMesh`, `SameFaceMeshOutcome` (layer 8's copies deleted).
- 2026-10-17, 5, `MeshedBounds` is layer 2's `KeptBounds` mapped to bounds; this layer's copy of
  `IsRedundantVertexLoop` deleted (name review).
- 2026-10-17, 5, (new) `ScaledBy(FaceMeshingCriteria, factor)`: moved from layer 8's stand-in
  (name review).
- 2026-10-17, 6, (new) `MeshVertexSite`, `NumberMeshVertices`; numbering start arrays are CSR
  offsets; `GlobalIndex`'s slot defined per site.
- 2026-10-17, 6, `ToQuadMesh3D` returns `QuadMeshOutcome`; `ToSplitTriangleMesh3D` returns
  `SplitTriangleMesh3D`; `MeshEdgeTable` fields fixed.
- 2026-10-17, 6, `Genus` per component, `Genus(c, fallback)` with `MeshComponents`,
  `MeshComponentCounts` (gains `BoundaryCycles`, 2 - chi - B), `ComponentsOf`; `MeshComponents`
  gains `ElementParent`, `ElementDepth`.
- 2026-10-17, 6, (new) `CompensatedSum`, `TotalsAgree`; nine rounding laws lose their tolerance
  parameter (judged by `ResolutionAt`).
- 2026-10-17, 6, (new) `SameConnectivity`, `IsSameNumbering`: one comparison by numbering (layers
  7 and 8 deleted theirs).
- 2026-10-17, 6, (new) `RestrictedToFaces`, `ReferencedEulerCharacteristic`, `PieceCount`,
  `Law_CornerProvenanceIsOnItsElementFace`, `Law_VectorAreaVanishes` (review M9, M10, M11).
- 2026-10-17, 7, validators gain a level form; `ValidateModelMesh(mesh, t, th, level)`,
  `CrossCheck(m, mesh, level, c)`; (new) `ValidateFaceMeshOutcome`, `ValidateAssembly`,
  `CheckFamily`.
- 2026-10-17, 7, `ExactReport`, `MeasuredReport`, `QualityReport` lose their bound; (new)
  `WarningReport`: layer 0's `Check.Bound`.
- 2026-10-17, 7, `validation-transforms.library.plato` became `validation-comparisons.library.plato`
  (`BrepComparisons`); `MovedBy`, `ScaledBy`, `ScaledPoint`, `MeshOnce`, `SameConnectivity`
  deleted for layers 2 and 6's.
- 2026-10-17, 7, `Law_OuterShellVolumePositive`, `Law_VoidShellVolumeNegative` joined by their
  exact forms `Law_OuterShellExactVolumePositive`, `Law_VoidShellExactVolumeNegative`; (new)
  `Law_DivergenceEqualsTorusVolume`, `Law_EveryFaceIsMeshed`, further oracles and allowances.
- 2026-10-17, 7, (new) `Witness_Box`, sized forms of every witness, `Witness_SphereByPoleLoops`,
  three negative witnesses, `Witness_BoxWithPolyLoopSheet` (the planted bad face), `WitnessFacts`,
  `CorpusEntry`.
- 2026-10-17, 7, `Law_RigidMotionKeepsConnectivity`, theorem `RigidMotionCommutesWithMeshing`,
  conjectures `ScalingByAnyFactorKeepsConnectivity`, `TighterChordalNeverIncreasesDeviation`
  dropped as false (layer 8 decisions 11, 12).
- 2026-10-17, 7 and 8, `WitnessOptions`, `WitnessOutcome`, `WitnessMesh` and the sixteen laws that
  mesh a witness, from layer 7 to `08-pipeline/pipeline-witnesses.laws.plato`
  (`StepToMeshWitnessesLaws`): they named layer 8 from below (name review).
- 2026-10-17, 7, `IsRedundantVertexLoop`, `LoopOfBoundaryPoint`, `LoopStart` deleted: copies of
  layer 2's and layer 5's (`LoopOffset`) (name review).
- 2026-10-17, 8, proposed `ParseOutcome`, `DecodeOutcome` not declared: layer 3's `ParsedFile`
  and `DecodedModel` serve.
- 2026-10-17, 8, `MeshingOptions` gains `Decode: DecodePolicy` and `Quality: MeshQualityThresholds`;
  (new) `RelativeMeshingOptions`, `DefaultMeshingOptions`, `Witness_UnitScaleOptions`.
- 2026-10-17, 8, (new) `MeshStepTextTraced`, `StepMeshOutcome`, `MeshChosenFaces`,
  `PipelineState` and the loop's step functions: tracing and failure isolation.
- 2026-10-17, 8, `Validated(m, mesh, level)`, `Validated(m, mesh, o)`;
  `Law_CrossCheckIsIdempotent`, `Law_ValidationIsIdempotent`; (new)
  `Law_PendingRequestsAreRefinable` (layer 7 finding 8).
- 2026-10-17, 8, `DiscretizeUsable`, `Undiscretized`, `WholeInput`, `Located`,
  `SameConnectivity`, `RigidlyMoved`, `ScaledPoint`, `ScaledBy(m)`, `SameFaceMesh`,
  `SameFaceMeshOutcome`, `Law_RequestsNameEdgesOfTheirFace` deleted for their owners' (fix wave);
  `WithEveryFaceReversed` and the criteria `ScaledBy`s deleted or moved down (name review).
