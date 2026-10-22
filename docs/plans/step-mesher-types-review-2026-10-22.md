# STEP mesher: how well the library uses Plato's types (review, 2026-10-22)

Ticket: TKT-435. Serves workflow 3 (the STEP mesher's version 1 contract: closed, watertight,
oriented, covering, within the chordal bound, traceable; `sandbox/step-brep-mesh/README.md`).

The library is the STEP B-rep mesher in `sandbox/step-brep-mesh` (layers 00 to 11, about 80,000
lines of Plato, 523 declared types), compiled to C# as `Ara3D.StepBrep` in `deps/bim-open-data`.
The question asked: does it use Plato's types as well as it could to make its algorithms correct,
elegant and efficient? A sibling report, `docs/plans/step-mesher-reliability-2026-10-22.md`
(session v1-reliability), asks why defects slip past the laws; this one asks only about types.

Method: five read-only surveys (layers 00 to 02, 03 to 05, 06 to 11, the defect record, and
Plato's compiler and generated C#), each counting with grep and reading every cited line, then a
staged prototype of the top change (`sandbox/step-mesh-staging/v1-types`, chunk T1). Counts are
grep counts over `*.library.plato` and `*.types.plato` unless a row says otherwise, and may be off
by a few percent. Paths are relative to `sandbox/step-brep-mesh/` unless they start with
`sandbox/` or `deps/`.

## Verdict

The library has the right types and does not use them. `TYPE-CATALOG.md` (2026-10-19) asked for
about 250 types; about 240 are now declared, in their own files, each with a comment saying what
mistake it removes and laws for its conversions. Almost none is on a path the meshing code runs:

| Type | What it promises | Uses on the meshing path |
|---|---|---|
| `UvPoint` (a point in a surface's own parameters) | not a unit-square point | 69 references; the stdlib `UvCoordinate` has 578 |
| `CurveParameter`, `EdgeParameter` | a 3D curve's parameter is not a pcurve's or an edge's | 0 in layers 3 to 11; the arena `Eval(g, c, t: Number)` takes a bare Number (`01-geometry/geometry-curves.library.plato:86`) |
| `UvPointIndex`, `LocalVertexIndex` | a parameter point index is not a 3D vertex index | 0 in `FaceMesh`, whose `LocalVertex: Array<VertexIndex>` indexes positions while its triangles' `VertexIndex` index uv points (`05-face-meshing/face-meshing.types.plato:66-76`) |
| `Sense` (Same or Opposite) | composed senses as an algebra | laws only; `BrepEdge.SameSense`, `BrepFace.SameSense`, `FaceBound.Orientation` are Booleans, and the XOR of three Booleans the catalog cites as its bad example is unchanged (`02-topology/topology.library.plato:470`) |
| `InRangeModel`, `CheckedMesh`, `WatertightMesh`, `SimpleUvLoop`, `CompleteDiscretization` | a checked value is a different type | 0 parameters anywhere; 289 `Precondition:` comments stand in for them, 20 of them `IsEveryIndexInRange` |
| `DecidedNumber` and 38 other `Decided*` sums, `Projection`, `ClosestParameterResult` | no sentinel | used in their own four files; `Project` returns a bare `UvCoordinate`; 25 `NormalOr(..., +z)` fallbacks remain |
| `MeshResult` (a sum) | the pipeline's outcome as a decision | converted from `MeshOutcome { Ok: Boolean; ... }` after the fact; no caller |

The lessons log in `docs/plans/step-mesher-v2.md` already says why: under the first freeze seven
tracks added no type. The rule changed on 2026-10-19 ("additions never wait"), and the tracks then
added types, in new files, beside the code they did not change. Additions are free; adoption is a
change to a signature every caller reads, which the staging rules (new files only, changes wait
for the wave) push to a merge nobody schedules. The v1-gate track's four chunks each record "No
type added".

What the types do well, and should keep doing:

- **Every `match` is exhaustive.** Plato has no wildcard arm (CHK300 to CHK304), so the closed
  sums for geometry (`BrepCurve`, `BrepSurface`), topology (`BrepLoop`, `BrepBody`,
  `CurveSupport`, `TorusPart`), provenance (`UvPointSource`, `MeshVertexSite`, `SampleKey`),
  validation (`Defect`, 26 cases) and repair (`RepairAction`, `Fixability`) make a forgotten case a
  compile error. The defect record has no missing-case bug in library code.
- **Topology rows refer to each other by typed index**, and `CoedgeSite` holds a `BoundSlot` and
  a `CoedgeSlot`, so the two cannot be swapped (`02-topology/topology-model.types.plato:93`).
- **Tolerances and angles are typed** in signatures: no function takes a `tol` or `eps` Number;
  77 parameters use `LengthTolerance` and its siblings; every angle is an `Angle`.
- **The mesh edge table does not pack keys**: it sorts `VertexPair.Canonical`
  (`06-mesh/mesh-topology.library.plato:22-56`).
- **Wrappers cost nothing at run time**: every generated type is a C# `readonly struct`, and a
  one-field wrapper (`ModelLength`) is a struct around a `double` with inlined members
  (`deps/bim-open-data/.../Generated/_ModelLength.g.cs:26-45`). A typed index or a typed
  parameter is free.

Where they are too weak, in order of the damage done:

1. **`&&` and `||` do not short-circuit**, so a count guard does not guard the index on its right.
   This is a language fact, not a library choice, and it caused the worst corpus defect so far.
2. **Sentinels in typed indices.** 89 `XIndex(-1)` values over 16 index types; `IIndex` itself
   documents -1 as "none" (`00-foundation/foundation-indices.types.plato:6-7`). With no generic
   sum, every "maybe an index" would need its own sum, so nobody wrote one.
3. **One index type, several index spaces.** `VertexIndex` is a uv-point index, a local 3D
   vertex, a global vertex, and a position in an outer loop (`QuadSides.FourSided(Corners)`); and
   the stdlib's `At(self: IIndexable<$T>, index: IIndex)` lets any typed index read any array.
4. **Arity read back from `Count`.** `ElementCorners` returns an `Array<VertexIndex>`, and every
   reader asks `ps.Count == 3` and reads `ps[3]` by position. The generated `TriangleFace`
   indexer returns C for any index past 2 (`_TriangleFace.g.cs:86`), so an off-by-one is silent.
5. **Proofs are Booleans.** The quad keep rule, the grid outcome, `MeshOutcome.Ok`,
   `QuadMeshOutcome.Ok`, `TrialInsertion.Kept`, `GreenEstimate.Ran`: each is a flag a caller can
   ignore, and Plato cannot stop anyone building a proof value, because it has no private
   constructor.
6. **Strings.** Layer 3 compares 426 distinct entity and attribute names as strings (F-1, on
   hold); `LawName` converts implicitly from `String`, so two laws already lack the `Law_` prefix
   (`07-validation/validation-checks-mesh.library.plato:278, 283`), and `FailedDefectOf`
   classifies defects by seven law-name comparisons (`07-validation/validation-defects.library.plato:258-266`).

## The defect record against the types

58 defects from `reviews/FINDINGS.md`, the math review, every `TRACK.md`, the v2 plan's log, and
the mesher's defect tickets, each classed by root cause and by the type that would have prevented
it (full table in the appendix). A row with two causes is
counted under its first.

| Root cause | Defects | A type or language feature plausibly prevents (high or medium) |
|---|---|---|
| Sentinel or default value | 11 | 9 |
| Algorithm logic | 7 | 1 |
| Flag instead of proof | 6 | 6 |
| Performance | 6 | 2 |
| Wrong unit or space | 5 | 5 |
| Index confusion or out of range | 5 | 5 |
| Non-short-circuit `&&` | 5 | 4 (a language feature) |
| Wrong tolerance | 5 | 2 |
| Non-exhaustive or degraded match | 3 | 3 (two are compiler defects) |
| Integer overflow | 2 | 2 |
| Names checked as strings | 2 | 2 |
| Compiler or writer defect | 1 | 0 |
| **Total** | **58** | **41**, 18 with high confidence |

The defects the brief named:

- **TKT-411** (30 three-edge sphere, cone and cylinder faces in 7 corpus files throw
  `ArgumentOutOfRangeException`). One of its three causes is `IsBandPair`
  (`05-face-meshing/uv-regions.library.plato:387-391`): `winding.Count == 2 && ... loops[winding[1]]`
  reads index 1 of a one-entry array, because `&&` evaluates both sides. The staged fix
  (`IsBandPairGuarded`, v1-faces F3) is a conditional. Preventers: short-circuit `&&` (Plato), or a
  winding classification sum `NoWinding | BandPair(First, Second: UvLoopIndex) | OtherWinding`
  matched before use. A fixed-size type for quad sides would not have helped: the throw is not in
  the side code. The other two causes are an unwrap tie at a half-turn lune (logic) and a pole
  compared with the point tolerance instead of the parameter floor (a `PointTolerance` and a
  `ParameterFloor` type at the call would have).
- **TKT-400** (edge-use keys packed as `(a * N + b) * 2 + dir` overflow 32-bit Integer above
  about 32,768 points per shell). Fixed by v1-edges E3 with a rank (`rank * 2 + forward`, below
  twice the use count), not a type. Packing survives at `02-topology/topology.library.plato:994`
  and `02-topology/topology-shell-tables.library.plato:261` (`i * n + j`), at
  `02-topology/topology.library.plato:1307`, and in `CheckGrid`'s `(n * k).MapRange` with
  `j / k, j % k` (`07-validation/validation-checks-common.library.plato:54-74`). Each of these
  overflows only where the work is already quadratic in a count above 46,340, so the fix is the
  algorithm (a grid or a sort), and a pair record (`IndexPair { First; Second }`) removes the
  encode and decode while it is there. Under cpu64, `Integer` is 64-bit but `MapRange` casts with
  `checked((int)...)`, so an oversized grid throws instead of wrapping.
- **TKT-415** (the bump solid's B-spline top meshed as one flat quad) and **v1-gate's finding**
  that a quad's keep rule and the contract's rule differ. Three readers measured a quad three ways:
  `IsKeptQuad` (corners planar within SurfaceChordal and convex,
  `05-face-meshing/face-meshing.library.plato:640`), F1's `GridUnlessFoldedOrCoarse` and the
  library's `FlatElementDistance` (the nearer triangle of the split on the diagonal from corner 0,
  `05-face-meshing/grid-chordal.library.plato:27-58`, `face-meshing.library.plato:521`), and the
  gate's `QuadSplitsWithin` (all four triangles of both diagonal splits,
  `08-pipeline/pipeline-v1-gate.library.plato:121-138`). Only the third is the contract. Chunk
  T1 below names the splits once and makes the keep rule the third.
- **TKT-355** (generated `Equals` compared array fields by reference). Fixed at Plato c8c83c8b by
  `Intrinsics.ArrayEquals`, but the pinned CLI the tracks use (e37c032f) is three commits older
  and lacks it, so a rebuild with the pin brings reference equality back. `==` on two arrays is
  still CHK201 in Plato source.
- **The `a.Count == b.Count && ...` guard.** `SameUvPoints`
  (`05-face-meshing/face-meshing-lift.laws.plato:116`) throws when the first array is longer, so
  `Law_RefinedIsFaceTriangulation` reported an error where it should have failed (v1-gate,
  perf-angle). The library has 33 `Count == Count &&` guards and 32 hand-written
  `Same*(Array, Array)` helpers, while foundation already has the generic, guarded
  `Corresponds(xs, ys, same)` (`00-foundation/foundation.library.plato:837`, 87 uses). Chunk T1's
  first draft added a 33rd helper; it now uses `Corresponds`.

## Layer by layer

### 00-foundation, 01-geometry, 02-topology

| Measure | L0 | L1 | L2 |
|---|---|---|---|
| Function signatures | 312 | 519 | 282 |
| Signatures with a `Number` parameter | 51 | 134 | 21 |
| `uv: UvCoordinate` parameters | 13 | 72 | 1 |
| Hand-built `XIndex(...)` from an Integer | 16 | 27 | 31 |
| Array indexings `[ ]` / `.At(` | 25 | 144 | 330 |
| `Precondition` / `requires` comments | 29 | 31 | 95 |
| Guards that return 0, -1, false or true | 8 | 28 | 61 |

Of the 262 `Number` parameters in layers 0 to 2, 113 are named `t` (a curve or edge parameter)
and about 31 are lengths; typed-parameter types appear in 48 parameters. The core arena API is
untyped: `Eval(g, c, t: Number)`, `ClosestParameter` returns `Number`
(`01-geometry/geometry-curves.library.plato:86, 179`), `Project` returns `UvCoordinate`
(`01-geometry/geometry-surfaces.library.plato:249`); the typed forms are wrappers in
`01-geometry/geometry-views.library.plato:24` that only layer 1 calls. Signs come back as
Integers (`ParameterizationSignAt ... : Integer`, `02-topology/topology.library.plato:511`) though
`Sign` exists. The foundation's own types use bare fields: `ParameterRange { Start; End: Number }`,
`LengthTolerance.Value: Number`, `Check { Holds: Boolean; Worst; Bound: Number }` with NaN for
"unmeasured" (`00-foundation/foundation-diagnostics.types.plato:97-102`). `ShellCounts` and
`ShellCountsDelta` share one field list (`02-topology/topology-model.types.plato:61, 73`).
`BrepModel` holds arrays of records, and the four derived tables are hand-written compressed rows
(`Array<Integer>` offsets), because the stdlib's `JaggedArray` does not generate
(`02-topology/topology-edge-tables.types.plato`).

### 03-step, 04-discretization, 05-face-meshing

| Measure | 03 | 04 | 05 |
|---|---|---|---|
| `.Value` unwraps | 38 | 59 | 149 |
| Typed index built from an Integer | 8 | 15 | 64 |
| `%` (a cyclic position) / `3 * t` neighbour-slot strides | 3 / 0 | 0 / 0 | 107 / 103 |
| `-1` literals | 52 | 26 | 140 |
| `Array<Integer>` / `Array<Boolean>` | 13 / 3 | 2 / 4 | 99 / 41 |
| `UvCoordinate` / `UvPoint` | – | 21 / 0 | 182 / 3 |

Layer 4 does not say which parameter it holds: `EdgeDiscretization.Parameters` is
`Array<Number>`, and two comments disagree about its space (`04-discretization/discretization.types.plato:51`
against `00-foundation/foundation-parameters.types.plato:35`); `EdgeParameter` is used twice in the
layer. In layer 5, three 2D spaces share `Point2D` (tolerance units, mirrored, chart;
`05-face-meshing/uv-regions.library.plato:597, 601, 605`), and the function `ChartPoint(chart, uv)`
returns a `Point2D`, not the `ChartPoint` type; six functions take `mirrored: Boolean` while
`FaceChart.Mirrored` is a `Parity`. `TrialInsertion.Kept: Boolean`
(`05-face-meshing/triangulation-built.types.plato:51`) stands beside the unused `InsertionAttempt`
sum; `FaceMeshOutcome` is a record whose empty mesh means "blocked"
(`05-face-meshing/face-meshing.library.plato:790`). The flip code is written three times
(`triangulation-built.library.plato:195`, `triangulation-built-indexed.library.plato:69`,
`triangulation-fast.library.plato:128`), so any type change there is made three times.
`TriangleNeedsRefinement` (`05-face-meshing/uv-delaunay.library.plato:170`) chains eight `||`
tests, the angle tests among them, and evaluates every one for every triangle.

### 06-mesh, 07-validation, 08-pipeline (10 and 11 briefly)

| Measure | 06 | 07 | 08 | 10 | 11 |
|---|---|---|---|---|---|
| `.Value` uses | 330 | 170 | 43 | 33 | 67 |
| `XIndex(-1)` sentinels | 18 | 26 | 0 | 0 | 9 (laws) |
| Hand corner arithmetic (`3T + 4q + s`) | about 26 | about 8 | 2 | 1 | 0 |
| `law: String` parameters / `"Law_..."` literals | 0 / 0 | 73 / 538 | 0 / 7 | 0 / 4 | 0 / 0 |
| `Undecided(r) =>` arms returning a constant | 7 of 7 | 14 of 14 | 18 of 19 | – | – |

`CornerOf` returns `CornerIndex(-1)` and `CornerVertex` returns `VertexIndex(-1)`
(`06-mesh/mesh.library.plato:76-93`); `MeshVertexSite.ModelVertex(BrepVertexIndex(-1))` stands for
"no site" in a sum that has no such case (`06-mesh/mesh-numbering.library.plato:101, 116, 276`).
`ElementRef` carries a bare `Index: Integer`. All 18 `Undecided => true` arms in 08's proof laws
(`08-pipeline/pipeline-proofs-mesh.laws.plato:82-175`) make a law pass when the checker declines
to decide; a checker that always declines would pass them (handed to v1-reliability, whose
subject that is). 10-editing and 11-repair are mostly sum-typed data with inverses, the best-typed
layers in the library.

## What Plato can and cannot express (at c8c83c8b; the pin is e37c032f)

| Feature | Status | Cost of working around it here | Ticket |
|---|---|---|---|
| One-field wrapper (newtype) | exists, zero cost (`readonly struct`) | operators written by hand; two leaks: a function named after its type is an implicit conversion (D.11), and the type checker accepts a `Number` returned where a `ModelLength` is declared (`src/.../Solver.cs:744, 777`, only C# rejects it); the C# wrapper converts implicitly to `double` | TKT-445 |
| Sums with payloads, exhaustive `match` | exist | none; sums are wide (below) | – |
| Generic sums (`Option<T>`, `Decided<T>`) | missing: CHK306 (`SumTypeChecker.cs:27-41`), restricted by default | 39 hand-copied `Decided*` sums, each with its own `ValueOr`; 89 `-1` index sentinels because a per-index sum was not worth writing | TKT-443 |
| Short-circuit `&&`, `||` | missing: `And` is `this & b`; `All`/`Any` fold the whole array | 5 defects (TKT-411's corpus throw among them); 109 `(a ? b : false)` sites, which a writer bug once mis-parenthesised (F-50); every guard written as a conditional | TKT-442 |
| Private or sealed constructors | missing (`SEMANTICS.md:387`, no visibility) | proof types are convention: anyone builds a `CheckedMesh` or a `GridWithinChordal` | TKT-444 |
| Refinement types, validated constructors | missing | tolerances of 0 or below made by specs and by the law runner fail at least 25 laws (TKT-423, review F12, F-58) | TKT-446 (the runner part) |
| Units of measure | one named type per quantity, no dimension algebra | product overloads (`Length * Length -> Area`) by hand; acceptable | – |
| Checked `requires` / `ensures` / invariants | missing; laws are property tests | 289 precondition comments | – (TKT-444 covers the part that pays: sealed proofs) |
| Fixed-size arrays | missing; `TriangleFace` is a three-field record | its generated indexer returns C for every index past 2 (`_TriangleFace.g.cs:86`) | TKT-447 |
| Index bound to its table | missing: `At(IIndexable<$T>, IIndex)` takes any index | a `BrepFaceIndex` reads the edges table silently | – (needs a phantom-typed index; noted, not filed) |
| Array equality | fixed at c8c83c8b, not in the pin | `==` on arrays still CHK201; 32 `Same*` helpers | – (pin move belongs to v1-compiler) |
| Monomorphization | partial: a generic with no concrete version compiles to a throwing stub (TKT-398) | failures show only at run time | TKT-398 (open) |

## Efficiency: what the types do to the generated C#

- **Wrappers are free.** A typed index, `ModelLength`, `CurveParameter` or `UvPoint` is a
  struct around one value with inlined members, so adopting them costs nothing at run time. The
  argument against them is only call-site churn.
- **Sums are as wide as all their cases.** A sum is a `readonly struct` with an `int Kind` and
  every case's fields side by side, never boxed. `BrepSurface` has 25 fields, five of them a
  12-double `Frame3D`, about 700 bytes under cpu64 (estimate); `Defect` has 55 fields. Values are
  copied by value and no generated parameter uses `in`. An array of `BrepSurface` therefore costs
  about 700 bytes per surface whatever its kind. Two cheaper shapes: a sum whose cases hold an
  index into a per-kind table (the flat-table rule applied to geometry), or a writer change that
  overlaps the cases' fields. This matters for `GeometrySet` on the corpus (tens of thousands of
  surfaces per file) and for any `Array<Defect>`; it does not matter for small sums such as
  `Sign` or `ElementShape`.
- **Equality boxes.** `Equals(T)` returns the wrapped `Boolean`, and no generated type implements
  `IEquatable<T>`, so `Dictionary`, `HashSet`, `List.Contains` and `ArrayEquals` box both
  operands (Plato idea plato-384).
- **Arrays are interface calls.** `Array<T>` is an `IReadOnlyList<T>` over a `T[]`; struct
  elements are inline, but every `xs[i]` and `Count` is an interface call, and `Map` allocates a
  closure and makes two delegate calls per element. `ModelMesh` is already a table (seven
  columns); `BrepModel` is arrays of records, which is the better shape for rows read whole.
- **Non-short-circuit evaluation is the measurable cost.** `GridElementWithinChordal` orders its
  tests "surface-point tests first" and then evaluates all four, two of them projections, on every
  element; `TriangleNeedsRefinement` evaluates eight tests, two angle tests and four surface
  evaluations among them, per triangle per round. A conditional chain or short-circuit `&&` stops
  at the first failure. T1's decision exits at the first element not kept instead of visiting
  every element with `All`.
- **Lazy ranges (TKT-350)** are fixed (`MapRange` fills a `T[]` once), but `Ara3D.StepBrep` keeps
  its own copy of the runtime (`Intrinsics/ArrayIntrinsics.cs`), so a runtime fix must be copied
  there, not only regenerated.

## The changes worth making, ranked by defects prevented per hour

Each row is a ticket written for a builder who has not read this review. "Now" means it can start
today without touching a library file the version 1 tracks are changing; "after v1" means it
renames or changes signatures many call sites read, and waits until the version 1 wave closes.

| Rank | Change | Defects it removes (record above) | Hours | Ticket | Start |
|---|---|---|---|---|---|
| 1 | Merge chunk T1: the grid keep rule decided on both diagonal splits; `ElementShape`, `QuadSplits` | TKT-415's class, the keep-rule mismatch; makes three quad measures one | 0.5 (merge) | TKT-435 (staged) | now, by the v1 supervisor |
| 2 | Short-circuit `&&` and `||` in Plato (or, as a first step, a lint that flags an index on the right of a count test) | 5, including the corpus throw of TKT-411; retires 109 conditional guards | 4 to 8 | TKT-442 | now (Plato repository) |
| 3 | Replace the 32 `Same*` array helpers with `Corresponds`, and the 33 `Count == Count &&` guards with conditionals | 2 (law errors where a law should fail), and the next one | 1.5 | TKT-448 | after v1 (laws files in every layer) |
| 4 | Sealed constructors, so a proof type is built only by its checker | 6 (flag instead of proof), once the proof types are required | 6 | TKT-444 | now (Plato repository) |
| 5 | Validated generation for tolerance types in the law runner | at least 25 failing laws (TKT-423, F12, F-58) | 3 | TKT-446 | now (Plato repository) |
| 6 | `FaceMesh` and `UvTriangulation` with three index spaces: `UvPointIndex` for corners, `LocalVertexIndex` for `LocalVertex`, global `VertexIndex` only in `ModelMesh` | the index-confusion class (F-53.2 and the next); `QuadSides.FourSided(Corners)` as loop positions | 6 | TKT-449 | after v1 |
| 7 | Generic sums in Plato (`Decided<T>`, `Maybe<T>`), then the 89 `-1` index sentinels as `Maybe<XIndex>` | 9 of the 11 sentinel defects in time; the 39 `Decided*` copies collapse | 2 days (Plato) + 6 (library) | TKT-443, TKT-450 | Plato now; library after v1 |
| 8 | Proof types required: layers 4 to 8 take `PreparedModel` / `InRangeModel`, the pipeline returns `MeshResult`, the 20 `IsEveryIndexInRange` preconditions become a parameter type | the O(E M) re-checks (perf, 2), F-54, F-53.2; the 289 precondition comments start to shrink | 8 | TKT-451 | after v1, after TKT-444 |
| 9 | Typed parameters in the layer 1 arena API (`CurveParameter`, `UvPoint`, `Projection`) and `Sense` in the topology records | the unit-and-space class (5, F-58's `ToCurveParameter` among them) | 8 | TKT-452 | after v1 |
| 10 | Newtype leaks in Plato: the checker accepts a `Number` where a wrapper is declared | latent; every typed wrapper rests on it | 2 | TKT-445 | now (Plato repository) |

Also filed, small and outside the ranking: TKT-447, the generated `TriangleFace` / `QuadFace`
indexers that return the last corner for an out-of-range index (Plato, now).

Not filed: packed pair keys (each surviving one overflows only where the work is already
infeasible; fix when the algorithm is touched); the index-to-table binding (a phantom-typed
index is a larger Plato design, after generic sums); sum width (measure on the corpus before
choosing between per-kind tables and an overlapping layout); `IEquatable<T>` (plato-384 already
records it).

## Staged: chunk T1 (`sandbox/step-mesh-staging/v1-types`)

`element-shape.types.plato`: `ElementShape = TriangleShape(TriangleFace) | QuadShape(QuadFace) |
NoElement(ElementIndex)`, `QuadSplit`, `QuadSplits { OnAC; OnBD }`, `GridChordalDecision =
GridWithinChordal(Grid, Bound) | GridExceedsAt(Element)`. `element-shape.library.plato`
(`V1TypesElements`): a total `ShapeOf`, `SplitsOf`, `RenderTriangles` (a triangle, or all four
triangles of a quad's two splits), `QuadDistanceBothSplits`, `FlatElementDistanceBothSplits`, and
`DecideGridChordal`, which keeps a grid only when every triangle any element may be drawn as faces
the face normal and is within the bound, stops at the first element that is not, and names it.
Seven laws pass on the warm server (cpu64, 14 s): on the eight grid witnesses the new rule keeps
and refuses exactly the grids F1's rule does; a quad twisted along its second diagonal, which the
old measure puts at distance 0, is refused; `SplitsOf` gives the gate's `QuadSplitTriangles` in its
order. Merge instructions are in the folder's `TRACK.md`.

What T1 does not do, for want of a Plato feature: `GridWithinChordal` can still be built by any
function (no sealed constructor, TKT-444), its `Bound` is a bare `Number` (the layer's criteria
are), and `QuadGridOutcome.Grid` still takes a plain `UvTriangulation`. Once TKT-444 lands,
`QuadGridOutcome.Grid` should take the decision's proof, so no grid reaches the mesh unchecked.

## Durations

| Step | Wall time |
|---|---|
| Reading the design documents (README, TYPE-CATALOG, PLATO-PRIMER) and the grid code | 15 min |
| Five survey agents in parallel (layers 0-2, 3-5, 6-11, defects, Plato) | 13 min wall, 10 to 13 min each |
| Chunk T1: types, library, laws, one type check (23 s), two law runs (16 s, 10 s) | 25 min |
| This document | 20 min |
| Tickets and the report | 15 min |

## Appendix: the 58 defects

Root-cause classes: UNIT wrong unit or space; INDEX index confusion or out of range; SENT sentinel or default; FLAG a flag where a proof was needed; AND non-short-circuit `&&`; OVF integer overflow; MATCH non-exhaustive or degraded match; TOL wrong tolerance; ALG algorithm logic; PERF performance; STR names as strings; TOOL compiler or writer defect. R-Fn are items of `sandbox/step-brep-mesh/reviews/MATH-REVIEW-layers-0-6.md`.

| # | Id | Defect (one line) | Class | Type that would have prevented it | Conf. | Evidence |
|---|---|---|---|---|---|---|
| 1 | F-1 | WHERE laws read entities by string name; a misspelt entity or attribute makes a law vacuously true | STR | Typed STEP records and SELECT sums generated from EXPRESS (`face_geometry` as a three-case sum makes WR1 true by construction) | high | FINDINGS F-1; TKT-300 |
| 2 | TKT-422 | A file written with entity short names (CRTPNT, PLYLP) decodes to 0 faces with no diagnostic | STR | Generated decode with an explicit `Unrecognised(name)` case that must be matched and reported | medium | TKT-422 |
| 3 | R-F2 | Mirrored placements give inward normals on analytic faces and fail the orthonormal-placement law | UNIT | `OrthonormalFrame` carrying `Parity` (handedness) so the fold must read it; partly applied as `Placement { Frame: OrthonormalFrame }` | medium | MATH-REVIEW F2; F-58 geometry |
| 4 | R-F3 | `NormalAgreesWithParameterization` assumed constant per surface; false on a spindle torus (major < minor) | ALG | `TorusPart = Apple / Lemon / Ring` split at decode, so no surface value has a sign change | medium | MATH-REVIEW F3 |
| 5 | R-F4 | A closed edge on an unbounded curve or line pcurve gets `[Number.MinValue, Number.MaxValue]`; sampling gives inf and NaN | SENT | `CurveDomain = Bounded(Interval) / Unbounded`; sampling defined only on `Bounded` | high | MATH-REVIEW F4 |
| 6 | R-F8 | `Samples` on `[-MaxValue, MaxValue]` overflows to inf; `Law_SamplesStrictlyIncreasing` fails | SENT | `BoundedInterval` (finite length) as the parameter of `Samples` | high | MATH-REVIEW F8 |
| 7 | R-F5, R-F7 | Derivative and normal laws bound library rounding by the file's angle tolerance (and `AngleBetween` by 1e-9) | TOL | Distinct `Resolution` (rounding bound) and `AngleTolerance` (file) types; a rounding law takes only `Resolution` | medium | MATH-REVIEW F5, F7 |
| 8 | R-F6 | Rounding floor taken at the model's size, not the coordinates' magnitude (survey coordinates) | UNIT | `CoordinateMagnitude` distinct from `ModelLength` (size) as the argument of `ResolutionAt` | medium | MATH-REVIEW F6 |
| 9 | R-F9 | `UvGap` is a Euclidean norm over radians and millimetres compared with one scalar | UNIT | `UvPoint` with no Euclidean norm; `UvTolerance` as a per-direction box | high | MATH-REVIEW F9 |
| 10 | R-F12 | Specs build `ParameterTolerance(0.0)` and `LengthTolerance(0.0)`, breaking layer 0's smallest-normal invariant | SENT | Tolerance types whose only constructor validates (refined, positive) | high | MATH-REVIEW F12 |
| 11 | TKT-423 | 23 model-validity laws fail because the runner constructs `LengthTolerance` 0 or -0.5 | SENT | Same refined tolerance type, with the generator drawing through the validated constructor | high | TKT-423 |
| 12 | F-58 proofs | `Law_CurvePlacementOrthonormal` and `Law_SurfacePlacementOrthonormal` fail on a negative angle tolerance (no `> 0` guard) | SENT | Positive `AngleTolerance` by construction | high | FINDINGS F-58 proofs |
| 13 | F-60 / v1-gate | `SameUvPoints` is `a.Count == b.Count && a.Count.Range.All(... b[i] ...)`; unequal sizes throw, so `Law_RefinedIsFaceTriangulation` errors instead of failing; every `Same*` helper has it (33 such guards) | AND | Short-circuit `&&` in Plato, or a built-in structural array equality (the writer's `Intrinsics.ArrayEquals`) so no hand-written `Same*` exists | high | v1-gate TRACK Findings; perf-angle TRACK; `05-face-meshing/face-meshing-lift.laws.plato:116` |
| 14 | TKT-411 cause 2 | `IsBandPair`'s `winding.Count == 2 && ... winding[1]` reads index 1 with one winding loop: the ArgumentOutOfRangeException on 30 corpus faces in 7 files | AND, INDEX | Short-circuit `&&`; or `BandPairOf(...)`: `Decided<BandPair { First: UvLoopIndex; Second: UvLoopIndex }>` matched before use | high | v1-faces TRACK F3; `05-face-meshing/uv-regions.library.plato:387` |
| 15 | bspline track | `i > 0 && xs[i - 1]` errored on the first inverse run | AND | Short-circuit `&&` | high | bspline TRACK Findings |
| 16 | F-50 | C# writer drops parentheses in `(a ? b : false) ? x : y`, 109 sites, about 97 compile with the wrong meaning; the idiom exists only because `&&` does not short-circuit | AND, TOOL | Short-circuit `&&` removes the idiom the writer broke; the writer bug itself needs a differential test | medium | FINDINGS F-50 |
| 17 | F-59 | A law's `var` is evaluated before a later guard, so a weightless spline reached `BSplinePoint` | AND | None as a type; a lazy `let` or a lint for a binding used only under a guard | low | FINDINGS F-59 |
| 18 | TKT-411 cause 1 | Unwrap at a half-turn lune ties the two copies of the pole's free parameter; past it the loop is a period off | ALG | none | high | v1-faces TRACK F3 |
| 19 | TKT-411 cause 3 | `ExpandedPoint` compares with the point tolerance, whose cap at a pole is half a period, instead of the parameter floor | TOL | Distinct `PointTolerance` and `ParameterFloor` types at the call | medium | v1-faces TRACK F3 and Findings |
| 20 | TKT-400 | Implicit edge-use key `(a * N + b) * 2 + dir` overflows 32-bit Integer above about 32,768 poly points per shell, so distinct edges share a key | OVF | `EdgeUseKey { Low: PolyPointIndex; High: PolyPointIndex; Direction: Sense }` with an ordering, no packed integer | high | TKT-400; perf-faceted TRACK |
| 21 | v1-edges E3 | `CoincidenceRootsPairwise` keys `i * n + j`, overflows above 46,340 points | OVF | A pair key type (as row 20) | high | v1-edges TRACK Findings |
| 22 | TKT-415 / F-60 F1 | The quad grid kept the bump solid's top as one flat quad: chordal tested only on boundary edges, so a 0.3 bump vanished; same on every doubly curved four-sided face | FLAG | The grid returns `Decided<CertifiedGrid>` whose certificate records the interior deviation at refinement's samples; `QuadGridOnSides` cannot return a grid without one | medium | TKT-415; F-60 F1; v1-faces TRACK |
| 23 | v1-gate | The grid's keep rule (planar within SurfaceChordal and strictly convex) is not the contract's rule (both diagonal splits within chordal and oriented) | FLAG | One `AcceptedQuad` type whose single constructor is the contract predicate (`QuadSplitsWithin`, `QuadSplitsOriented`) | medium | v1-gate TRACK, Requests to other tracks |
| 24 | F-51.1 | `SameModel` ignores pcurves, loop and body cases: an empty edge loop equals a poly loop, `ManifoldSolid(s)` equals `ShellSet([s])` | MATCH | Compiler-derived structural equality over sums and records | high | FINDINGS F-51 |
| 25 | TKT-355 | Generated `Equals` compared array fields by reference, so a B-spline witness differed from itself compiled | SENT, TOOL | Value-semantics arrays in records (fixed by `Intrinsics.ArrayEquals`) | medium | TKT-355 Resolution |
| 26 | F-53.2 | `Law_ValidationIsIdempotent` errors on a `ModelMesh` with negative vertex indices (`At` out of range in `CornerNormalAt`) | INDEX | Typed non-negative `VertexIndex`, and `CheckedMesh` (in range by proof) as the parameter | medium | FINDINGS F-53 |
| 27 | F-54 | Laws over `(m, mesh)` assume the mesh came from `m`; layer 6 invariant laws fail on meshes no constructor made | FLAG | A proof-carrying `MeshOf(m)` / `CheckedMesh` returned only by `MeshModel` | medium | FINDINGS F-54 |
| 28 | TKT-424 | `Law_SegmentFloorMet` takes any `EdgeDiscretization`, fails on an empty one under a chordal bound of -2.36 | FLAG | An opaque `Discretization` only `Discretize` constructs | medium | TKT-424 |
| 29 | perf-edge-tables | `Refine` on a requested `Undiscretized` entry indexes an empty array | INDEX, SENT | An entry sum `Discretized(d) / Undiscretized(reason)` matched exhaustively, not an empty array guarded by `IsRefinable` | high | perf-edge-tables TRACK |
| 30 | perf-refine-edges | `RaisedToCount` on fewer than two parameters indexes out of range when a raise is needed | INDEX | A discretization type whose parameters are `AtLeastTwo<Number>` | medium | perf-refine-edges TRACK |
| 31 | perf-masks | `RestrictedToFaces` keeps an element whose `ElementFace` is negative when the filter names the same negative index | SENT | Non-negative `FaceIndex`; "no face" as an option case | high | perf-masks TRACK |
| 32 | F-58 editing | `BodyShells` indexes `m.Bodies[b]` without a range guard | INDEX | `BodyIndex` obtained only from the model's table (in range by construction) | medium | FINDINGS F-58 editing |
| 33 | F-58 editing | `DirtyAfter` reads every script edit against `Before`; wrong for an edit after a removal shifts indices | INDEX | Indices tagged by model version, converted only through an `IndexRemap` | medium | FINDINGS F-58 editing |
| 34 | F-58 catalog | `ToCurveParameter` does not apply `SameSense` | UNIT | Distinct `EdgeParameter` and `CurveParameter` types, converted by one function that reads the sense | high | FINDINGS F-58 item 4 |
| 35 | F-55 (genus) | The cone's Green area multiplies by the sign of rho at the apex, where rho is 0 and the sign is rounding noise: area came out negated | SENT | `OrientationWithin(tol): Sign` with a `Zero` case that must be matched, in place of `Number.Sign` | medium | genus TRACK Findings |
| 36 | F-57.2 | Refinement takes corner normals with a +z fallback, wrong at a cone apex | SENT | `SurfaceNormal = Regular / Limit / Undefined` returned by the normal function (catalog request, not applied) | medium | FINDINGS F-57; F-58 decided |
| 37 | F-58 decided | A decided normal classed the sphere's pole as `Regular` because `AreaElement > 0` (6e-17) | TOL | none alone: the sum type inherited the float test; it needs a tolerance argument | low | FINDINGS F-58 decided |
| 38 | F-57.1 | Angle-defect sum in plain floats exceeds its allowance under gpu32 on every curved witness | TOL | An `Allowance` type carrying its derivation (count of additions) | low | FINDINGS F-57; poles TRACK |
| 39 | F-57.3 | `Oracle_BodyVolume` counts redundant vertex loops, doubling the sphere's volume | ALG | none | high | FINDINGS F-57 |
| 40 | F-57.4 | A face whose winding loops are not paired is returned unchanged by `CutWholePeriods`, with no outcome to diagnose it | FLAG | A region outcome sum with an `Unpaired(diagnostic)` case | medium | FINDINGS F-57 |
| 41 | TKT-348 / F-59 | Closure decided by evaluating every curve; a bodiless `BSplinePoint` threw and 72 of 88 corpus files meshed nothing | FLAG | `DecidedClosure = Closed / Open / Undecided` (added by D1) so an undecidable closure is a value, not a throw | medium | TKT-348; FINDINGS F-59 |
| 42 | TKT-410 / F-58 | A `match` whose subject's sum type depends on file order degraded silently to a throwing stub (CHK304 not printed); 24,439 B-spline and 20,684 surface-curve edges lost | MATCH, TOOL | The existing check made fatal; no library type needed | medium | TKT-410; v1-compiler TRACK; F-58 item 3 |
| 43 | TKT-398, TKT-347 | Writer drops a List-first function; generic helper with a concrete first parameter not monomorphized | TOOL | none | high | TKT-347; TKT-398; perf-closure-marks TRACK |
| 44 | F-46.6 | Fixtures in millimetres, `Witness_UnitBox` in metres; a decode-equals-witness law needs a scale | UNIT | A length type that carries its unit (`ModelLength` in the file's unit) | medium | FINDINGS F-46 |
| 45 | TKT-309 | Curved faces triangulated with no interior points; densification was a type test on `CylinderMap` only (C# kernel) | MATCH | An exhaustive match over surface kinds instead of one type test | medium | TKT-309 |
| 46 | TKT-346 | Discretization never returns when an edge is off its face's surface: count raised one segment at a time to the cap | ALG | `WorkBudget` fuel in the signature would bound it; the fix was a bounded search | low | TKT-346 |
| 47 | TKT-406 | 15 degree surface-angle criterion unattainable on chords capped by the minimum length | ALG | none | high | TKT-406; perf-angle TRACK |
| 48 | TKT-401 | Bump solid's mesh has a degenerate element (1541) | ALG | none | high | TKT-401; perf-pipeline-laws TRACK |
| 49 | TKT-420, TKT-421 | Needle cones and single-winding cylinders refine into folded elements joining apex copies half a turn apart | ALG | none | high | TKT-420; TKT-421; v1-edges TRACK |
| 50 | TKT-425 | `Law_SagittaIsAttained` fails on fixture 12, both ends below the domain; possibly clamped to an empty interval | SENT | `NonEmptyInterval` from `DomainAt` (cause unconfirmed) | low | TKT-425 |
| 51 | perf-cdt, perf-collide | A NaN chart point makes the bridge test visit every position and sort out of order | SENT | A finite-number type for chart points | low | perf-cdt, perf-collide TRACKs |
| 52 | bspline track | gpu32 cannot honour the witness tolerances away from the origin; recovery laws "test luck" | TOL | A tolerance checked against `ResolutionAt` at construction | low | bspline TRACK Findings |
| 53 | F-53.1 / TKT-335 | `CanEvaluate` re-runs `IsWellFormed` at every sample; 26 s in one law | PERF | A proof-carrying checked `GeometrySet` (chunk H2: callers take an already-checked set) | high | FINDINGS F-53; perf-samplers TRACK |
| 54 | perf-sparse-grids, perf-editing-repair | `CountsAsEdge` evaluates `IsEveryIndexInRange` over the whole model per edge: O(E M) per shell | PERF | A proof-carrying in-range model (`InRangeModel`) checked once | high | perf-sparse-grids, perf-editing-repair TRACKs |
| 55 | TKT-350 | Generated `MapRange` is lazy and recomputes on each read; MeshModel re-meshes every face | PERF | none | high | TKT-350 |
| 56 | TKT-349 | One plane face with 80 to 212 edges took 86 s to over 8 min | PERF | none | high | TKT-349; v1-gate V1G-2 |
| 57 | v1-compiler | The lowered `match` re-evaluates its subject in every case test | PERF | none | high | v1-compiler TRACK |
| 58 | F-57.5 | `Lift` compares every pair of points (12 million at 3,500 points) | PERF | none | high | FINDINGS F-57 |
