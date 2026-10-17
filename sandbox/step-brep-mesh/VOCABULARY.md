# Vocabulary: the contract between layers

Every author of a layer reads this before writing, and writes against it. It fixes the layer order,
the names each layer exports and the names it may use from below, the stdlib names reused as they
are, and the naming rules. A name listed here as **fixed** is not renamed by a layer author; a name
listed as **proposed** may be renamed or split inside its layer, and the author records the change in
the layer README and in the "Changes to this contract" section at the end of this file.

Plato has one global namespace and nominal types, so a name declared twice anywhere in a compilation
is an error. That is why this file exists.

Stdlib reference: `C:\Users\cdigg\git\plato`, commit `f6e02cf0` (2026-10-17). The index of every
stdlib type and interface is `stdlib/types-and-concepts.txt` in that repository; a name not in it
does not exist.

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
| 7 | `07-validation` | `BrepValidation` |
| 8 | `08-pipeline` | `StepToMesh` |

Laws live in `<stem>.laws.plato` in a block named `<LibraryBlock>Laws`.

## Stdlib names reused as they are

Use these; do not redeclare them or declare a near-synonym.

| Stdlib name | File | Used for |
|---|---|---|
| `Number`, `Integer`, `Boolean`, `String` | `foundation/primitives.plato` | scalars |
| `Array<T>`, `Array2D<T>`, `JaggedArray<T>`, `List<T>`, `Buffer<T>` | `foundation/primitives.plato`, `collections-jagged.types.plato` | collections; builders only inside function bodies |
| `Point3D`, `Vector3D`, `Direction3D`, `Point2D`, `Vector2D` | `foundation/points.types.plato`, `vectors.types.plato` | positions and displacements |
| `Frame3D` | `foundation/transforms.types.plato` | a placement: origin and three orthonormal axes (STEP `axis2_placement_3d`) |
| `InfiniteLine3D` | `geometry/lines.types.plato` | an axis: origin and direction (STEP `axis1_placement`) |
| `Angle`, `AngleInterval` | `foundation/quantities.types.plato`, `intervals.types.plato` | angular quantities; radians stored |
| `NumberInterval` | `foundation/intervals.types.plato` | a closed parameter range; empty when `Start > End` |
| `Bounds2D`, `Bounds3D` | `foundation/intervals.types.plato` | axis-aligned boxes |
| `UvCoordinate` | `foundation/points.types.plato` | a point in a surface's parameter space |
| `ComparisonTolerance` | `foundation/numbers.types.plato` | absolute-plus-relative scalar near-equality |
| `KnotVector` | `geometry/splines.types.plato` | an expanded, non-decreasing knot sequence |
| `VertexIndex`, `FaceIndex`, `UndirectedEdgeIndex` | `geometry/topology.types.plato` | **mesh** vertex, element, and edge indices |
| `TriangleFace`, `QuadFace` | `geometry/topology.types.plato` | mesh elements over `VertexIndex` |
| `TriangleMesh3D`, `QuadMesh3D`, `PolygonMesh3D`, `HalfEdgeMesh` | `geometry/meshes.types.plato`, `topology.types.plato` | the stdlib mesh types this library converts **to**, explicitly |
| `Polyline2D`, `Polyline3D`, `Polygon2D`, `PolygonWithHoles2D` | `geometry/polygons.types.plato` | discretized curves and planar regions where the stdlib meaning fits |
| `EdgeOrientation` (`Forward | Reversed`), `BrepEdgeUse` | `geometry/brep.types.plato` | a coedge: an oriented citation of an edge (STEP `oriented_edge`) |
| `IIndex`, `IValue`, `IEquatable`, `IOrderable`, `IProcedural<TDomain,TRange>` | `foundation/*.concepts.plato` | the interfaces new types implement |

Names in the stdlib that this design **does not** reuse, and why: `Brep3D`, `BrepEdge`, `BrepFace`,
`BrepLoop`, `BrepCurve`, `BrepSurface`, `BrepValidation` (v1 faceted shapes; v2 below replaces
them, same names, richer shape; the reconciliation is a TASKS.md item); `Plane`
(normal-and-distance, no in-plane axes, so no parameterization); `Cylinder`, `Cone`, `Sphere`,
`Torus` (finite or unit-square parameterized; STEP surfaces are placement-based and infinite in the
unbounded direction); `ICurve3D`, `IParametricSurface` (unit-square canonical domain; STEP uses
natural parameters). Conversions to these are explicit `To*` functions in `06-mesh` and
`01-geometry`.

## Exported names per layer

### 0. `00-foundation`

Fixed:

- `LengthTolerance { Value: Number }`, `AngleTolerance { Value: Angle }`,
  `ParameterTolerance { Value: Number }`: the three coincidence tolerances.
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
  quads).
- `MeshVertexProvenance = OnVertex(Vertex: BrepVertexIndex) | OnEdge(Edge: BrepEdgeIndex, Parameter: Number) | OnFace(Face: BrepFaceIndex, Uv: UvCoordinate)`.
- `Provenance = Nowhere | StepInstance(Id: StepInstanceId) | KernelVertex(...) | KernelEdge(...) | KernelLoop(...) | KernelFace(...) | KernelShell(...) | KernelBody(...) | MeshVertex(Index: VertexIndex) | MeshElement(Index: ElementIndex)`.
- `Severity = Error | Warning | Info`.
- `Check { Law: String; Holds: Boolean; Worst: Number; Where: Provenance }`.
- `Diagnostic { Severity: Severity; Code: String; Message: String; Where: Provenance; Measure: Number }`.
- `Report { Checks: Array<Check>; Diagnostics: Array<Diagnostic> }` with `IsClean`.

Proposed: `Coincident(a: Point3D, b: Point3D, t: LengthTolerance): Boolean`,
`SameDirection`, `SameParameter`, `Samples(range: NumberInterval, count: Integer): Array<Number>`
(end points included), `SamplePlan { Count: Integer }`.

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
  `Frame3D`; basis surfaces are referenced by `SurfaceIndex`.
- `BSplineCurveData`, `BSplineSurfaceData`: the knot, degree, control point, and weight records
  (weights present always; all ones means polynomial).
- `GeometrySet { Curves: Array<BrepCurve>; Curves2D: Array<BrepCurve2D>; Pcurves: Array<Pcurve>; Surfaces: Array<BrepSurface> }`:
  the geometry arena.
- Evaluation over the arena: `Domain(g, c: CurveIndex): CurveDomain`,
  `Eval(g, c, t): Point3D`, `Derivative(g, c, t): Vector3D`,
  `Domain(g, s: SurfaceIndex): SurfaceDomain`, `Eval(g, s, uv): Point3D`,
  `PartialU`, `PartialV`, `NormalOr(g, s, uv, fallback: Direction3D)`,
  `Project(g, s, p: Point3D): UvCoordinate` (inverse evaluation),
  `DegenerateSides(g, s): Array<DomainSide>` (sides the surface map collapses to a point).

Proposed: concepts `INaturalCurve3D`, `INaturalCurve2D`, `INaturalSurface` naming the operations
above so that a non-STEP geometry could implement them later; `SurfaceCurveKind`,
`PreferredRepresentation` for the `OnSurface` case.

### 2. `02-topology`

Fixed:

- `BrepVertex { Point: Point3D }`.
- `BrepEdge { Start: BrepVertexIndex; End: BrepVertexIndex; Curve: CurveIndex; SameSense: Boolean }`.
- `BrepLoop = EdgeLoop(Uses: Array<BrepEdgeUse>) | VertexLoop(Vertex: BrepVertexIndex) | PolyLoop(Points: Array<Point3D>)`.
- `FaceBound { Loop: BrepLoopIndex; Orientation: Boolean; IsOuter: Boolean }`.
- `BrepFace { Surface: SurfaceIndex; SameSense: Boolean; Bounds: Array<FaceBound> }`.
- `BrepShell { Faces: Array<BrepFaceIndex>; DeclaredClosed: Boolean }`.
- `BrepBody = ManifoldSolid(Outer: ShellIndex) | SolidWithVoids(Outer: ShellIndex, Voids: Array<ShellIndex>) | ShellSet(Shells: Array<ShellIndex>)`.
- `BrepModel { Geometry: GeometrySet; Vertices; Edges; Loops; Faces; Shells; Bodies; Tolerances: Tolerances; Unit: LengthUnit }`
  (arrays named in the plural, element types as above; `LengthUnit` is declared here, not in
  `03-step`, because the model carries it).
- `LengthUnit = Metre | Millimetre | Centimetre | Inch | Foot | Scaled(MetresPerUnit: Number)`.
- Range predicates `IsVertexInRange`, `IsEdgeInRange`, `IsLoopInRange`, `IsFaceInRange`,
  `IsShellInRange`, `IsBodyInRange`, and the traversal helpers `StartVertex(m, use)`,
  `EndVertex(m, use)`, `EdgeDomain(m, e): CurveDomain`.
- Laws named in the README of the layer, among them `Law_IndicesInRange`,
  `Law_LoopsChainEndToStart`, `Law_EveryEdgeUsedTwiceWithOppositeOrientation` (closed shells),
  `Law_AtMostOneOuterBound`, `Law_EulerPoincare`, `Law_VertexCoincidesWithCurveEnd`,
  `Law_EdgeLiesOnAdjacentSurfaces`, `Law_PcurveAgreesWithCurve`.

### 3. `03-step`

Fixed:

- `Part21File { Header: StepHeader; Instances: Array<StepInstance>; Attributes: Array<StepAttribute> }`:
  the file as data, attributes in a flat arena so lists and typed values nest by index.
- `StepInstance { Id: StepInstanceId; Body: StepInstanceBody }`;
  `StepInstanceBody = Simple(TypeName: String, Attributes: Array<StepAttributeIndex>) | Complex(Parts: Array<StepSimpleRecord>)`.
- `StepAttribute = IntegerValue(...) | RealValue(...) | StringValue(...) | EnumValue(...) | BinaryValue(...) | Reference(Id: StepInstanceId) | Typed(TypeName: String, Inner: StepAttributeIndex) | ListValue(Items: Array<StepAttributeIndex>) | Unset | Derived`.
- `StepHeader { Description: Array<String>; Name: String; Schema: Array<String>; ... }`.
- A schema model for the supported subset: `EntityDefinition`, `AttributeDefinition`,
  `AttributeKind`, and `SupportedSchema(_: Part21File): Array<EntityDefinition>`.
- `ProvenanceMap`: `StepInstanceId` to kernel index and back, for every decoded instance.
- `ParseStep(text: String): ParseOutcome`, `DecodeBrep(file: Part21File): DecodeOutcome`
  (outcome records are declared in `08-pipeline`; `03-step` declares the functions' inner results
  `DecodedModel { Model: BrepModel; Map: ProvenanceMap; Diagnostics: Array<Diagnostic> }`).
- WHERE rules of ISO 10303-42 for every decoded entity, as `Law_` functions over the typed form.

Proposed: whether a typed `StepEntity` sum sits between `Part21File` and `BrepModel` (one case per
supported entity, so WHERE rules attach to typed values) or decoding goes straight to kernel types
with laws stated over `Part21File`. The author decides and records why.

### 4. `04-discretization`

Fixed:

- `Limit = Unlimited | AtMost(Value: Number)`.
- `DiscretizationCriteria { Chordal: Number; Angular: Angle; MaxLength: Limit; MinSegments: Integer }`.
- `EdgeDiscretization { Edge: BrepEdgeIndex; Parameters: Array<Number>; Points: Array<Point3D> }`:
  parameters in the edge curve's own parameter, strictly increasing from the edge domain's start to
  its end; `Points[i]` is the curve evaluated at `Parameters[i]`; first and last points are the
  vertex points exactly.
- `EdgeDiscretizations { ByEdge: Array<EdgeDiscretization> }` indexed by `BrepEdgeIndex`.
- `Discretize(m, e, c): EdgeDiscretization`, `DiscretizeAll(m, c): EdgeDiscretizations`,
  `Reversed(d): EdgeDiscretization`, `Sagitta(m, e, t0, t1): Number`,
  `TurningAngle(...)`.

### 5. `05-face-meshing`

Fixed:

- `BoundarySource = FromVertex(Vertex: BrepVertexIndex) | FromEdge(Edge: BrepEdgeIndex, Index: Integer)`.
- `UvLoop { Points: Array<UvCoordinate>; Sources: Array<BoundarySource> }`.
- `UvRegion { Outer: UvLoop; Holes: Array<UvLoop> }`.
- `FaceMeshingCriteria { Discretization: DiscretizationCriteria; SurfaceChordal: Number; SurfaceAngular: Angle; PreferQuads: Boolean }`.
- `UvTriangulation { Points: Array<UvCoordinate>; Sources: Array<BoundarySource>; Triangles: Array<TriangleFace>; Quads: Array<QuadFace> }`
  where a point beyond the boundary has no source and is interior.
- `FaceMesh { Face: BrepFaceIndex; Positions: Array<Point3D>; Uvs: Array<UvCoordinate>; Normals: Array<Direction3D>; Triangles: Array<TriangleFace>; Quads: Array<QuadFace>; Provenance: Array<MeshVertexProvenance> }`.
- `LoopToUv`, `Unwrap`, `RegionOf(m, f, d): UvRegion`, `TriangulateRegion`, `RefineToSurface`,
  `QuadGridIfRectangular`, `Lift(m, f, t): FaceMesh`, `MeshFace(m, f, d, c): FaceMesh`.

### 6. `06-mesh`

Fixed:

- `VertexLayout { ModelVertexCount: Integer; EdgeInteriorStart: Array<Integer>; FaceInteriorStart: Array<Integer> }`:
  the global mesh vertex numbering, model vertices first, then edge interiors by edge, then face
  interiors by face.
- `ModelMesh { Positions; Normals; Uvs; Triangles: Array<TriangleFace>; Quads: Array<QuadFace>; ElementFace: Array<BrepFaceIndex>; VertexProvenance: Array<MeshVertexProvenance>; Layout: VertexLayout }`.
- `MeshEdgeTable`: undirected mesh edges with incident element count and orientation parity.
- `EulerCharacteristic(mesh)`, `IsManifold`, `IsClosed`, `IsConsistentlyOriented`, `Area`,
  `SignedVolume`, `AngleDefectSum`.
- `TriangleQuality`, `QuadQuality` records and their functions.
- `ToTriangleMesh3D(mesh)`, `ToQuadMesh3D(mesh)` (only when there are no triangles),
  `ToPolygonMesh3D(mesh)`.
- `AssembleModelMesh(m, faceMeshes: Array<FaceMesh>, layout): ModelMesh`.

### 7. `07-validation`

Fixed:

- `ConformanceLevel = Structural | Geometric | Oracle`.
- `ValidateStep(file): Report`, `ValidateBrep(m): Report`, `ValidateDiscretizations(m, d): Report`,
  `ValidateFaceMesh(m, fm): Report`, `ValidateModelMesh(mesh): Report`,
  `CrossCheck(m, mesh, level): Report`.
- The oracles: `Oracle_PlanarFaceArea`, `Oracle_CylinderPatchArea`, `Oracle_SphereArea`,
  `Oracle_TorusArea`, `Oracle_ConePatchArea`, `Oracle_AngleDefectSum`,
  `Oracle_DivergenceVolume`, `Oracle_EulerCharacteristic`.
- The witnesses: `Witness_UnitBox`, `Witness_Cylinder` (one seam), `Witness_Sphere` (two poles),
  `Witness_Torus` (two seams), `Witness_Cone` (an apex), `Witness_BlockWithThroughHole`
  (genus one), `Witness_HollowBox` (a void shell), `Witness_BSplinePatchSolid`.

### 8. `08-pipeline`

Fixed:

- `ParseOutcome { Ok: Boolean; File: Part21File; Diagnostics: Array<Diagnostic> }`.
- `DecodeOutcome { Ok: Boolean; Model: BrepModel; Map: ProvenanceMap; Diagnostics: Array<Diagnostic> }`.
- `MeshOutcome { Ok: Boolean; Mesh: ModelMesh; Report: Report }`.
- `MeshingOptions { Face: FaceMeshingCriteria; Level: ConformanceLevel }`.
- `MeshStepText(text: String, options: MeshingOptions): MeshOutcome` and the stage functions it
  composes.

## Naming rules

- Kernel topology types carry the `Brep` prefix (`BrepFace`), their indices `Brep<Thing>Index`,
  except `ShellIndex` and `BodyIndex` where no stdlib collision exists.
- STEP-layer types carry the `Step` prefix. A decoded entity type, if the author introduces them,
  is the EXPRESS name in PascalCase with the prefix: `advanced_face` becomes `StepAdvancedFace`.
- Sum case names are nouns without prefix (`Cylinder`, not `CylindricalSurface`), because the sum
  type qualifies them (`BrepSurface.Cylinder(...)`).
- Mesh-side indices are the stdlib's (`VertexIndex`, `FaceIndex`); `ElementIndex` is ours because
  the mesh holds triangles and quads in two arrays.
- Functions: `Is*` for predicates, `To*` for lossy or choice-making conversions, a type name for a
  faithful conversion (stdlib rule), `Law_`, `Witness_`, `Oracle_`, `Check_` as in SPEC-DSL.md.
- Angles are `Angle`, never `Number`. Lengths are `Number` in the model's `LengthUnit`.

## Changes to this contract

Record here any renaming or split a layer author made, with the reason, so that the other layers
can follow. Format: date, layer, old name, new name, reason.

(none yet)
