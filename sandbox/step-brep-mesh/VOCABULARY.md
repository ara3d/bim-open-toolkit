# Vocabulary: the contract between layers

Every author of a layer reads this before writing, and writes against it. It fixes the layer order,
the names each layer exports and the names it may use from below, the stdlib names reused as they
are, and the naming rules. A name listed here as **fixed** is not renamed by a layer author; a name
listed as **proposed** may be renamed or split inside its layer, and the author records the change in
the layer README under "Changes to the contract". The supervising session merges those into the
"Changes to this contract" section at the end of this file.

Plato has one global namespace and nominal types, so a name declared twice anywhere in a compilation
is an error. That is why this file exists.

Stdlib reference: `C:\Users\cdigg\git\plato`, commit `f6e02cf0` (2026-10-17). The index of every
stdlib type and interface is `stdlib/types-and-concepts.txt` in that repository; a name not in it
does not exist. [PLATO-PRIMER.md](PLATO-PRIMER.md) section C quotes the declarations this design
reuses, and section G lists the collisions this revision resolves.

Revision 2, 2026-10-17: after Phase 1. Revision 1 is in git history (commit 02c2aacf).

## Layer order and dependency rule

A layer may reference names from itself and from lower-numbered layers only.

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
under `tools/PlatoGate/` in this sandbox.

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

### 0. `00-foundation`

Fixed:

- `LengthTolerance { Value: Number }`, `AngleTolerance { Value: Angle }`,
  `ParameterTolerance { Value: Number }`: the three coincidence tolerances. How a parameter
  tolerance is derived from the length tolerance and a surface's local metric (it is not one number
  near a pole) is the layer author's decision, recorded in the layer README.
- `Tolerances { Length: LengthTolerance; Angle: AngleTolerance; Parameter: ParameterTolerance }`:
  the model's own tolerances, read from the STEP file's geometric context.
- `Periodicity = Aperiodic | Periodic(Period: Number)`.
- `CurveDomain { Range: NumberInterval; Periodicity: Periodicity }`.
- `SurfaceDomain { U: CurveDomain; V: CurveDomain }`.
- `DomainSide = UMin | UMax | VMin | VMax`.
- All typed indices of the library, each `{ Value: Integer }` implementing `IIndex`, `-1` meaning
  none: `CurveIndex`, `Curve2DIndex`, `PcurveIndex`, `SurfaceIndex`, `BrepVertexIndex`,
  `BrepEdgeIndex`, `BrepLoopIndex`, `BrepFaceIndex`, `ShellIndex`, `BodyIndex`,
  `StepInstanceId`, `StepAttributeIndex`, `ElementIndex` (a mesh element: triangles first, then
  quads), `CornerIndex` is **not** ours (the stdlib has one); use `Integer` for a corner slot.
- `MeshVertexProvenance = OnVertex(Vertex: BrepVertexIndex) | OnEdge(Edge: BrepEdgeIndex, Parameter: Number) | OnFace(Face: BrepFaceIndex, Uv: UvCoordinate)`.
- `Provenance = Nowhere | StepInstance(Id: StepInstanceId) | KernelVertex(Index: BrepVertexIndex) | KernelEdge(Index: BrepEdgeIndex) | KernelLoop(Index: BrepLoopIndex) | KernelFace(Index: BrepFaceIndex) | KernelShell(Index: ShellIndex) | KernelBody(Index: BodyIndex) | MeshVertex(Index: VertexIndex) | MeshElement(Index: ElementIndex)`.
- `Severity = Error | Warning | Info`.
- `Check { Law: String; Holds: Boolean; Worst: Number; Where: Provenance }`.
- `Diagnostic { Severity: Severity; Code: String; Message: String; Where: Provenance; Measure: Number }`.
- `Report { Checks: Array<Check>; Diagnostics: Array<Diagnostic> }` with `IsClean` and `Merge`.

Proposed: `Coincident(a: Point3D, b: Point3D, t: LengthTolerance): Boolean`,
`SameDirection`, `SameParameter`, `Samples(range: NumberInterval, count: Integer): Array<Number>`
(end points included), `SamplePlan { Count: Integer }`, and the periodic arithmetic
(`Wrap(t, period)`, `ShortestDifference`, `NearestUnwrapped(t, reference, period)`).

### 1. `01-geometry`

Fixed:

- `BrepCurve` (3D, sum). Case names: `Line`, `Circle`, `Ellipse`, `Hyperbola`, `Parabola`,
  `Polyline`, `BSpline`, `Trimmed`, `Composite`, `Offset`, `OnSurface`. Payloads are the
  author's, under the rule that a case is a distinct evaluation formula; basis curves are
  referenced by `CurveIndex`, never nested.
- `BrepCurve2D` (sum): the same families in the plane, for pcurves.
- `Pcurve { Surface: SurfaceIndex; Curve: Curve2DIndex }`.
- `BrepSurface` (sum). Case names: `Plane`, `Cylinder`, `Cone`, `Sphere`, `Torus`, `Revolution`,
  `LinearExtrusion`, `BSpline`, `RectangularTrimmed`, `Offset`. Placement-based cases carry a
  `Frame3D`; basis surfaces are referenced by `SurfaceIndex`. Case names equal to stdlib type
  names compile when qualified (`BrepSurface.Cylinder(...)`, PLATO-PRIMER.md probe L08).
- `BSplineCurveData`, `BSplineSurfaceData`: the knot, degree, control point, and weight records
  (weights present always; all ones means polynomial).
- `GeometrySet { Curves: Array<BrepCurve>; Curves2D: Array<BrepCurve2D>; Pcurves: Array<Pcurve>; Surfaces: Array<BrepSurface> }`:
  the geometry arena.
- Evaluation over the arena: `Domain(g, c: CurveIndex): CurveDomain`,
  `Eval(g, c, t): Point3D`, `Derivative(g, c, t): Vector3D`,
  `ClosestParameter(g, c, p: Point3D): Number` (inverse evaluation on a curve),
  `Domain(g, s: SurfaceIndex): SurfaceDomain`, `Eval(g, s, uv): Point3D`,
  `PartialU`, `PartialV`, `NormalOr(g, s, uv, fallback: Direction3D)`,
  `Project(g, s, p: Point3D): UvCoordinate` (inverse evaluation),
  `DegenerateSides(g, s): Array<DomainSide>` (sides the surface map collapses to a point),
  `AreaElement(g, s, uv): Number` (the length of `PartialU x PartialV`).

Proposed: concepts `INaturalCurve3D`, `INaturalCurve2D`, `INaturalSurface` naming the operations
above so that a non-STEP geometry could implement them later; `SurfaceCurveKind`,
`PreferredRepresentation` for the `OnSurface` case.

### 2. `02-topology`

Fixed:

- `EdgeOrientation = Forward | Reversed` (identical to the stdlib v1 declaration, which the gate
  excludes).
- `Coedge { Edge: BrepEdgeIndex; Orientation: EdgeOrientation }`: one oriented citation of an
  edge inside a loop (STEP `oriented_edge`). Replaces the v1 `BrepEdgeUse`, whose `Edge` is a mesh
  index.
- `BrepVertex { Point: Point3D }`.
- `BrepEdge { Start: BrepVertexIndex; End: BrepVertexIndex; Curve: CurveIndex; SameSense: Boolean }`.
- `BrepLoop = EdgeLoop(Coedges: Array<Coedge>) | VertexLoop(Vertex: BrepVertexIndex) | PolyLoop(Points: Array<Point3D>)`.
- `FaceBound { Loop: BrepLoopIndex; Orientation: Boolean; IsOuter: Boolean }`.
- `BrepFace { Surface: SurfaceIndex; SameSense: Boolean; Bounds: Array<FaceBound> }`.
- `BrepShell { Faces: Array<BrepFaceIndex>; DeclaredClosed: Boolean }`. A shell carries no
  orientation flag: the decoder folds STEP's `oriented_face`, `oriented_closed_shell`, and void
  orientation into `BrepFace.SameSense` and `FaceBound.Orientation` (see layer 3).
- `BrepBody = ManifoldSolid(Outer: ShellIndex) | SolidWithVoids(Outer: ShellIndex, Voids: Array<ShellIndex>) | ShellSet(Shells: Array<ShellIndex>)`.
- `LengthUnit = Metre | Millimetre | Centimetre | Inch | Foot | Scaled(MetresPerUnit: Number)`.
- `BrepModel { Geometry: GeometrySet; Vertices: Array<BrepVertex>; Edges: Array<BrepEdge>; Loops: Array<BrepLoop>; Faces: Array<BrepFace>; Shells: Array<BrepShell>; Bodies: Array<BrepBody>; Tolerances: Tolerances; Unit: LengthUnit }`.
- Range predicates `IsVertexInRange`, `IsEdgeInRange`, `IsLoopInRange`, `IsFaceInRange`,
  `IsShellInRange`, `IsBodyInRange`; traversal `StartVertex(m, c: Coedge)`, `EndVertex(m, c)`,
  `EdgeDomain(m, e): CurveDomain` (STEP edges carry no explicit range: it is derived from the
  vertices' positions on the curve; closed curves with `Start == End` span the full period);
  `CoedgeRunsForwardOnCurve(m, bound, coedge): Boolean` (the composed sense); `FaceNormalSign`.
- `ShellCounts { Vertices; Edges; Faces; Loops: Integer }` and `ReducedCounts(m, s): ShellCounts`:
  the counts after contracting degenerate edges and dropping vertex loops whose vertex lies on
  another bound of the same face (the rule derived in `research/VALIDATION-MATH.md` section 1).
- Laws, among them: `Law_IndicesInRange`, `Law_LoopsChainEndToStart`,
  `Law_EveryEdgeUsedTwiceInClosedShell` (count), `Law_EdgeUsesHaveOppositeOrientation` (sense;
  a seam edge's two uses are in one face), `Law_AtMostOneOuterBound`, `Law_AtLeastOneBound`,
  `Law_EulerPoincareEvenAndBounded` (`V - E + 2F - L` even and at most 2, on reduced counts, per
  shell), `Law_VertexCoincidesWithCurveEnd`, `Law_EdgeLiesOnAdjacentSurfaces`,
  `Law_PcurveAgreesWithCurve`, `Law_VertexLinkIsOneCycle`, `Law_DeclaredClosedIsClosed`,
  `Law_DegenerateEdgeHasCoincidentVertices`.

### 3. `03-step`

Fixed:

- `Part21File { Header: StepHeader; Instances: Array<StepInstance>; Attributes: Array<StepAttribute> }`:
  the file as data, attributes in a flat arena so lists and typed values nest by index.
- `StepInstance { Id: StepInstanceId; Body: StepInstanceBody }`;
  `StepInstanceBody = Simple(TypeName: String, Attributes: Array<StepAttributeIndex>) | Complex(Parts: Array<StepSimpleRecord>)`;
  `StepSimpleRecord { TypeName: String; Attributes: Array<StepAttributeIndex> }`.
- `StepAttribute = IntegerValue(Value: Integer) | RealValue(Value: Number) | StringValue(Value: String) | EnumValue(Name: String) | BinaryValue(Bits: String) | Reference(Id: StepInstanceId) | Typed(TypeName: String, Inner: StepAttributeIndex) | ListValue(Items: Array<StepAttributeIndex>) | Unset | Derived`.
- `StepHeader { Description: Array<String>; Name: String; Schema: Array<String>; ... }` (the
  author completes the fields from ISO 10303-21).
- A schema model for the supported subset: `EntityDefinition`, `AttributeDefinition`,
  `AttributeKind`, and `SupportedSchema(_: Part21File): Array<EntityDefinition>`.
- `ProvenanceMap`: `StepInstanceId` to kernel index and back, for every decoded instance, plus
  which instances had an orientation flag folded (see below).
- Orientation folding: STEP's `oriented_face`, `oriented_closed_shell`, and the orientation of
  void shells are **not** kernel types. The decoder folds them into `BrepFace.SameSense` and
  `FaceBound.Orientation` so that every face's bounds run counter-clockwise about the face normal
  and every face normal points out of the material. Void shells therefore end up with normals
  pointing into the void (out of the material), which layer 7 checks by signed volume.
- `DecodedModel { Model: BrepModel; Map: ProvenanceMap; Diagnostics: Array<Diagnostic> }`,
  `ParseStep(text: String): ParsedFile` (`ParsedFile { Ok: Boolean; File: Part21File; Diagnostics }`),
  `DecodeBrep(file: Part21File): DecodedModel`.
- WHERE rules of ISO 10303-42 for every decoded entity, as `Law_` functions over the typed form.

Proposed: whether a typed `StepEntity` sum sits between `Part21File` and `BrepModel` (one case per
supported entity, so WHERE rules attach to typed values) or decoding goes straight to kernel types
with laws stated over `Part21File`. The author decides and records why.

### 4. `04-discretization`

Fixed:

- `Limit = Unlimited | AtMost(Value: Number)`.
- `DiscretizationCriteria { Chordal: Number; Angular: Angle; MaxLength: Limit; MinLength: Number; MinSegments: Integer }`.
  `MinLength` is the floor below which refinement stops, so every refinement terminates.
- `SegmentFloors { ByEdge: Array<Integer> }`: a per-edge minimum segment count, indexed by
  `BrepEdgeIndex`, empty by default; the hook quad count-matching uses.
- `EdgeDiscretization { Edge: BrepEdgeIndex; Parameters: Array<Number>; Points: Array<Point3D> }`:
  parameters in the edge curve's own parameter, strictly increasing from the edge domain's start to
  its end; `Points[i]` is the curve evaluated at `Parameters[i]`; first and last points are the
  vertex points exactly.
- `EdgeDiscretizations { ByEdge: Array<EdgeDiscretization> }` indexed by `BrepEdgeIndex`.
- `RefinementReason = LoopSelfIntersects | TooCoarseInParameterSpace | QuadCountMismatch`.
- `EdgeRefinementRequest { Edge: BrepEdgeIndex; Reason: RefinementReason; Chordal: Number }`: a
  request from face meshing for a finer polyline on one edge.
- `Discretize(m, e, c, floors): EdgeDiscretization`: the criteria are met along the 3D curve
  **and** along the edge's image in each adjacent face's parameter space (its pcurve, or the
  projection of the 3D points), so the face's parameter-space polygon is simple when its loops are.
- `DiscretizeAll(m, c, floors): EdgeDiscretizations`, `Refine(m, d, requests, c): EdgeDiscretizations`
  (only the requested edges change), `Reversed(d): EdgeDiscretization`, `Sagitta(m, e, t0, t1)`,
  `TurningAngle(...)`.

### 5. `05-face-meshing`

Fixed:

- `UvPointSource = FromVertex(Vertex: BrepVertexIndex) | FromEdge(Edge: BrepEdgeIndex, Index: Integer) | SeamCut(Side: DomainSide, Index: Integer) | Pole(Side: DomainSide, Index: Integer) | Interior`:
  where a parameter-space point came from. `SeamCut` and `Pole` are **synthetic** boundary points
  that face meshing adds when a face covers a whole period or contains a pole that is not a model
  vertex; `Interior` is a refinement point.
- `UvLoop { Points: Array<UvCoordinate>; Sources: Array<UvPointSource> }`.
- `UvRegion { Outer: UvLoop; Holes: Array<UvLoop> }`.
- `FaceMeshingCriteria { Discretization: DiscretizationCriteria; SurfaceChordal: Number; SurfaceAngular: Angle; PreferQuads: Boolean }`.
  The exact meaning of `SurfaceAngular` (normal deviation across an element, as kernels measure it)
  is defined by the layer author per `research/MESHING-REQUIREMENTS.md`.
- `UvTriangulation { Points: Array<UvCoordinate>; Sources: Array<UvPointSource>; Triangles: Array<TriangleFace>; Quads: Array<QuadFace> }`:
  elements index `Points`.
- `FaceMesh { Face: BrepFaceIndex; UvPoints: Array<UvCoordinate>; Sources: Array<UvPointSource>; LocalVertex: Array<VertexIndex>; Positions: Array<Point3D>; Normals: Array<Direction3D>; Triangles: Array<TriangleFace>; Quads: Array<QuadFace>; Provenance: Array<MeshVertexProvenance> }`.
  Parameter-space points and 3D vertices are **distinct**: `LocalVertex[i]` is the local 3D vertex
  of parameter-space point `i`, so the two copies of a seam point share one 3D vertex; `Positions`
  and `Provenance` are per local 3D vertex; `Normals` are per parameter-space point; elements index
  parameter-space points.
- `FaceMeshOutcome { Mesh: FaceMesh; Requests: Array<EdgeRefinementRequest>; Diagnostics: Array<Diagnostic> }`:
  face meshing may return refinement requests instead of a usable mesh when a loop is not simple in
  parameter space.
- `LoopToUv`, `Unwrap`, `AddMissingSeamsAndPoles`, `RegionOf(m, f, d): UvRegion`,
  `OrientRegion`, `TriangulateRegion`, `RefineToSurface`, `QuadGridIfRectangular`, `Lift(m, f, t): FaceMesh`,
  `MeshFace(m, f, d, c): FaceMeshOutcome`.

### 6. `06-mesh`

Fixed:

- `MeshVertexNumbering { ModelVertexCount: Integer; EdgeInteriorStart: Array<Integer>; FaceInteriorStart: Array<Integer> }`:
  the global mesh vertex numbering, model vertices first, then edge interiors by edge, then face
  interiors by face; `GlobalIndex(n, p: MeshVertexProvenance, slot: Integer): VertexIndex`.
- `ModelMesh { Positions: Array<Point3D>; Triangles: Array<TriangleFace>; Quads: Array<QuadFace>; CornerNormals: Array<Direction3D>; CornerUvs: Array<UvCoordinate>; ElementFace: Array<BrepFaceIndex>; VertexProvenance: Array<MeshVertexProvenance>; Numbering: MeshVertexNumbering }`.
  Normals and parameter values are **per element corner** (three per triangle in order, then four
  per quad), because a vertex on a seam has two parameter values and a vertex on a crease has one
  normal per face. Positions and provenance are per vertex.
- `MeshEdgeTable`: undirected mesh edges with incident element count and orientation parity.
- `EulerCharacteristic(mesh)`, `IsManifold`, `IsClosed`, `IsConsistentlyOriented`, `Area`,
  `SignedVolume`, `AngleDefectSum`, `Genus` per component.
- `TriangleQuality`, `QuadQuality` records and their functions.
- `ToTriangleMesh3D(mesh)` (positions and connectivity only, quads split along a stated diagonal),
  `ToQuadMesh3D(mesh)` (only when there are no triangles), `ToPolygonMesh3D(mesh)`,
  `ToSplitTriangleMesh3D(mesh)` (vertices duplicated wherever corner attributes differ, for
  renderers that want per-vertex normals).
- `AssembleModelMesh(m, faceMeshes: Array<FaceMesh>, numbering): ModelMesh`: boundary vertices of
  each face mesh map to shared global indices through their provenance; no welding by distance.

### 7. `07-validation`

Fixed:

- `ConformanceLevel = Structural | Geometric | Oracle`.
- `ValidateStep(file): Report`, `ValidateBrep(m): Report`, `ValidateDiscretizations(m, d): Report`,
  `ValidateFaceMesh(m, fm): Report`, `ValidateModelMesh(mesh): Report`,
  `CrossCheck(m, mesh, level): Report`.
- The oracles: `Oracle_FaceAreaByGreen` (the one Green's-theorem oracle over the parameter-space
  polygon including pole and seam sides, with the per-surface antiderivatives),
  `Oracle_PlanarFaceArea`, `Oracle_CylinderPatchArea`, `Oracle_SphereArea`, `Oracle_TorusArea`,
  `Oracle_ConePatchArea` (closed forms, to check the Green oracle against), `Oracle_AngleDefectSum`,
  `Oracle_DivergenceVolume`, `Oracle_EulerCharacteristic`.
- The witnesses: `Witness_UnitBox`, `Witness_Cylinder` (one seam), `Witness_Sphere` (two poles),
  `Witness_Torus` (two seams), `Witness_Cone` (an apex), `Witness_BlockWithThroughHole`
  (genus one), `Witness_HollowBox` (a void shell), `Witness_BSplinePatchSolid`, each with its
  exact counts stated.
- Laws, among them: `Law_OuterShellVolumePositive`, `Law_VoidShellVolumeNegative`,
  `Law_MeshEulerEqualsBrepEuler` (per shell, on reduced counts), `Law_VertexReevaluatesFromProvenance`,
  `Law_FaceAreaMatchesOracle`.

### 8. `08-pipeline`

Fixed:

- `ParseOutcome { Ok: Boolean; File: Part21File; Diagnostics: Array<Diagnostic> }`.
- `DecodeOutcome { Ok: Boolean; Model: BrepModel; Map: ProvenanceMap; Diagnostics: Array<Diagnostic> }`.
- `MeshOutcome { Ok: Boolean; Mesh: ModelMesh; Report: Report; Rounds: Integer }`.
- `MeshingOptions { Face: FaceMeshingCriteria; Level: ConformanceLevel; MaxRefinementRounds: Integer }`.
- `MeshModel(m, o): MeshOutcome`: the bounded loop (discretize all edges; mesh every face; collect
  refinement requests; refine those edges and re-mesh their faces; stop when there are no requests
  or the round limit is reached, diagnosing the faces still unresolved).
- `MeshStepText(text: String, options: MeshingOptions): MeshOutcome` and the stage functions it
  composes.

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
