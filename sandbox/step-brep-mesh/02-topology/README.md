# 02-topology: the B-rep as a cell complex

Layer 2 of the STEP B-rep to mesh design ([../README.md](../README.md)). It holds the boundary
representation's combinatorial part (vertices, edges, coedges, loops, faces, shells, bodies) as flat
tables with typed indices, the maps from those cells into layer 1's geometry, and the laws that make
the result a closed, oriented 2-manifold whose cells sit on their geometry. Layer 3 (`03-step`)
builds a `BrepModel`; layers 4 and 5 read edge domains, coedge senses and face normal signs from it;
layer 7 turns its laws into checks.

Written 2026-10-17 against VOCABULARY.md revision 2 as types, signatures, laws and contracts, every
algorithm bodiless with a `// deferred:` note. Implementation chunk A (TKT-314) gave ten of the
eleven algorithms bodies; the genus track (TKT-328) gave the last, `SharesCurveParameter`.

| File | Holds |
|---|---|
| `topology-elements.types.plato` | `EdgeOrientation`, `Coedge`, `BrepVertex`, `BrepEdge`, `BrepLoop`, `FaceBound`, `BrepFace`, `BrepShell`, `BrepBody` |
| `topology-model.types.plato` | `LengthUnit`, `BrepModel`, `ShellCounts`, `CoedgeSite`, `EdgeEnd` |
| `topology.library.plato` | library `BrepTopology`: predicates, traversal, sense, edge and pcurve domains, vertex links, counts, connectivity, orientability, coupling measures, size and extent, model transforms; eleven given bodies (ten in chunk A, `SharesCurveParameter` by the genus track); eight declarations marked `belongs-in` layers 0 and 1 |
| `topology.laws.plato` | library `BrepTopologyLaws`: 41 laws |
| `topology.spec.plato` | invariants of `BrepModel` and `ShellCounts`, 13 function contracts, 4 theorems |

## The objects

### A B-rep as a cell complex

A closed shell is a compact surface `S` in space, partitioned into finitely many disjoint cells:

- **Vertices**, points `P(v)`.
- **Edges**, open arcs. Edge `e` is the image of an open parameter interval `(t0, t1)` under its
  curve `c_e`, with `c_e(t0)` and `c_e(t1)` its end vertices. The two ends may be one vertex (a
  closed edge, such as a full circle), and the curve may be unbounded and shared with other edges.
- **Faces**, open surfaces. Face `f` is the image under its surface map `sigma_f` of an open region
  of the parameter plane, the region cut out by the face's bounds.

The closure of each cell is a union of cells: an edge's closure adds its end vertices, a face's
closure adds the edges and vertices of its bounds. That makes the partition a CW complex, with
attaching maps given by the bounds. `BrepModel` stores it as one table per cell kind. Each row refers
to other rows by typed index and to geometry in the arena (`GeometrySet`, layer 1) by `CurveIndex`
and `SurfaceIndex`. The geometry gives each cell its embedding; the topology gives the incidences.
Each is only half of the model, and the coupling laws (vertex on curve, curve on surface, pcurve on
curve) say that the two halves agree within the file's length tolerance.

### Coedges, and the two-colouring orientation requires

A face's boundary, traversed so that the face lies to the left as seen from its normal, is a closed
oriented curve: an integer 1-chain on the edges. A **coedge** (`Coedge`, STEP `oriented_edge`) is
one term of that chain: one citation of an edge by one bound of one face, with a direction. Since
a coedge value does not say which face uses it, the traversal functions address coedges by
`CoedgeSite`: the face, the position of the bound in the face, and the position of the coedge in
the loop.

For a closed surface the boundary of the sum of all faces is zero: every edge receives two coedges,
and they cancel. Colour each coedge `+` when the face runs it in the curve's increasing parameter
and `-` otherwise (`CoedgeRunsForwardOnCurve`). The surface is a coherently oriented 2-manifold
along its edges exactly when every edge has two coedges of opposite colour. That is
`Law_EveryEdgeUsedTwiceInClosedShell` and `Law_EdgeUsesHaveOppositeOrientation`. A seam is the case
where both coedges of an edge belong to one face (`Law_SeamUsesRunOpposite`): a point on a
cylinder's seam has a neighbourhood of two half-disks of the same face, glued along the seam.

### Loops, bounds and faces

`BrepLoop` has three kinds. An `EdgeLoop` is a closed chain of coedges: each ends at the vertex the
next starts from (`Law_LoopsChainEndToStart`). A `VertexLoop` is a single vertex that the face
excludes, a puncture at a pole or apex; when it is a face's only bound, the face is a whole closed
surface minus that point. A `PolyLoop` is a polygon with implicit straight edges, used only by
faceted B-reps.

A `FaceBound` cites a loop with an `Orientation` (false: the face runs the whole loop backwards)
and an `IsOuter` hint. A `BrepFace` has a surface, a `SameSense` flag (true: the face's normal is
the surface normal `N`), and at least one bound. Which bound is outer is not needed by any law here
except `Law_AtMostOneOuterBound`. A sixth of real faces mark none and some cylinder bands mark both
circles (research/STEP-BREP-MODEL.md 3.6, 6.6), so the flag is read as a hint and nothing else
depends on it.

### Shells and bodies

A `BrepShell` is a set of faces with a `DeclaredClosed` flag. The flag records what the file
claimed; the survey found 371 shells declared closed that have free edges, so
`Law_DeclaredClosedIsClosed` checks the claim. A shell has no orientation flag. STEP's
`oriented_face`, `oriented_closed_shell`, and the void orientation of `brep_with_voids` are folded
by the decoder into `BrepFace.SameSense` and `FaceBound.Orientation`. Reversing a face means
flipping its `SameSense` and every bound's `Orientation`; the next section shows that this leaves
every rule of this layer unchanged. A `BrepBody` is a solid inside one closed shell, a solid with
voids, or a set of sheets.

## Sense and orientation, composed

Write `sigma(x) = +1` for true and `-1` for false. Three flags decide which way a face runs along a
coedge's curve, and two decide which side of it the face lies on (research/STEP-BREP-MODEL.md 4):

```
kappa = sigma(edge.SameSense) * sigma(coedge.Orientation) * sigma(bound.Orientation)
        kappa = +1: the face traverses the coedge in increasing curve parameter.

FaceNormalSign(f) = sigma(face.SameSense) * epsilon(surface)
        +1: the face's topological normal points along PartialU x PartialV.
        epsilon = -1 only for the inner (lemon) part of a degenerate torus.
```

`epsilon` is one sign per surface because layer 1 states ISO's normal as
`N = epsilon <PartialU x PartialV>` on placements of either handedness and on a plain toroidal
surface with `major < minor`, whose normal turns over inside the axis together with the cross
product (layer 1 decisions 6 and 17). A mirrored placement enters through `SameSense` alone: layer 3
folds the transform's determinant (layer 1's `PlacementHandedness`) into it. Multiplying the
handedness into `FaceNormalSign` as well would count the mirror twice: a mirrored sphere would get
`+1 * -1 * -1`, an inward normal. `Law_ParameterizationSignIsConstantOnFace` samples
`N . (PartialU x PartialV)` at the projections of a face's coedge points and checks it against
`epsilon`, so a surface that breaks the premise is caught at the faces that use it.

`CoedgeRunsForwardOnCurve` computes `kappa` in Boolean form:
`(SameSense == IsForward) == bound.Orientation`. XNOR on Booleans is multiplication on signs, so
the formula is exact and needs no tolerance. A pcurve has the sense of its 3D curve, so the same
`kappa` orients it.

In the parameter plane, with `u` turned a quarter turn counter-clockwise onto `v`, the face's
interior lies to the left of every coedge traversed in direction `kappa` when
`FaceNormalSign = +1`, and to the right when it is `-1`. A region whose bounds close in `(u, v)`
then has positive signed area exactly when `FaceNormalSign = +1`; that is
`Law_LoopWindingMatchesSameSense`. `epsilon` belongs to the surface: layer 1's
`NormalAgreesWithParameterization(g, s)`.

Folding is invisible to these rules. Reversing a face negates `sigma(SameSense)` and every
`sigma(bound.Orientation)`. Every `kappa` of the face flips, so the face runs each coedge the other
way, and `FaceNormalSign` flips, so the interior moves to the other side of that reversed
traversal. The interior is the same point set as before.

Worked example (research/STEP-BREP-MODEL.md 4.3): a cylinder of radius 10 and height 20 whose side
face has one loop `[bottom +, seam +, top -, seam -]` in a bound with `Orientation` true and
`SameSense` true, all edges `SameSense` true. Then `kappa` is `+1, +1, -1, -1`: the bottom circle
runs with increasing angle, the seam up, the top circle backwards, the seam down. In `(u, v)` the
loop is `(0,0) -> (2pi,0) -> (2pi,20) -> (0,20) -> (0,0)`, counter-clockwise, area `40 pi`, sign
`+1 = FaceNormalSign`. The bottom cap, on a plane whose axis is `+z`, has `SameSense` false and
uses the bottom circle with `Orientation` false: `kappa = -1`, opposite to the side face's `+1`, as
`Law_EdgeUsesHaveOppositeOrientation` requires.

## The edge domain

STEP stores no parameter range for an edge: an `edge_curve` names a possibly unbounded curve and two
vertices. `EdgeDomain(m, e)` derives the range:

1. The vertex met first along the curve's increasing parameter is `Start` when `SameSense` is
   true, else `End` (`FirstVertexAlongCurve`). Its parameter `a` and the other vertex's parameter
   `b` come from layer 1's `ClosestParameter`.
2. Aperiodic curve: the range is `[a, b]`. A closed edge (`Start == End` as indices) on a curve
   that neither wraps nor closes can only be degenerate, and gets `[a, a]`. The first version gave
   it the curve's whole domain, which is `[-MaxValue, MaxValue]` on a line (review F4a).
3. Curve that loops, `Periodic(P)` or `Closed(P)` (a clamped B-spline whose ends coincide, decided
   by layer 3 at decode): the range is `[a, a + w]`, where `a + w` is the representative of `b` in
   `(a, a + P]` (`PeriodicRepresentativeAbove`). A closed edge spans `[a, a + P]`. An arc that
   crosses a closed B-spline's join gets that arc, not its complement (review F4c).
4. Periodicity: `Periodic` is copied, since the formula wraps everywhere. `Closed` says that the
   range's two ends are one point, so a closed edge keeps it and an open arc is `Aperiodic`. A
   parameter beyond a `Closed` curve's range is wrapped into it before evaluation
   (`EdgeCurvePoint`, through layer 0's `Wrap`).

The range is always bounded: both ends are inverse-evaluation results. Two worked examples. A
closed edge on a `Line` (one vertex at parameter 3) had the range `[-1.8e308, 1.8e308]`; now it is
`[3, 3]`, and `Law_EdgeHasPositiveExtent` reports it as degenerate. An open edge on a clamped closed
B-spline over knots `[0, 3]` (`Closed(3)`), from parameter 2.5 to 0.5 with `SameSense` true, had the
complementary arc `[0.5, 2.5]` read backwards; now it is `[2.5, 3.5]`, and 3.5 is evaluated at
`Wrap` = 0.5.

The range therefore always runs forward in the curve's parameter, which is what layer 4's
discretization needs (`EdgeDiscretization.Parameters` strictly increasing from `Range.Start` to
`Range.End`). The vertex that `SameSense` assigns to `Range.Start` is the first along the curve:
`(atStart == SameSense) ? Range.Start : Range.End` (`DomainEndParameter`).

Closedness is decided by vertex index identity, not by coincidence. A closed curve trimmed by two
distinct vertex instances at one point, which some exporters write, is a decoding defect that layer
3 repairs by merging the two vertices (research/STEP-BREP-MODEL.md 6.6).
`Law_CoincidentEndsAreOneVertex` reports any that remain. Without the merge, the domain would come
out either nearly zero or nearly a full period, depending on rounding in `ClosestParameter`.

The laws of the rule: `Law_VertexCoincidesWithCurveEnd` (each vertex lies on the curve; a data law),
`Law_EdgeDomainEndsAtVertices` (the curve at the assigned end reproduces the vertex; the theorem
`EdgeDomainEndsFollowFromVertexOnCurve` derives it from the previous law on every curve but a
`Closed` one, where wrapping adds the closure gap), and `Law_EdgeDomainIsForward` (on an aperiodic
curve a wrong `SameSense` inverts the range; judged by the parameter tolerance at the range's start,
layer 1's `ParameterToleranceAt`). On a periodic curve a wrong `SameSense` instead gives the complementary arc,
which no edge-level law can see; the face-level winding law and layer 7's area oracles catch it.

## Pcurves

`Coedge` carries no pcurve, and research/STEP-BREP-MODEL.md 9.8 says that a pcurve belongs to one use
of an edge. In STEP a pcurve hangs off the edge's curve (`surface_curve`, `seam_curve`), and most
exporters write none. This layer therefore finds pcurves through the curve:
`PcurvesOnFace(m, e, f)` lists the pcurves of `e`'s curve that lie on `f`'s surface, one for an
ordinary edge and two for a seam. Which seam pcurve goes with which use is decided by the left/right
rule above, and that decision is face meshing's (layer 5).

`PcurveEdgeDomain(m, e, p)` is the range of `p` that covers the edge's curve over `EdgeDomain`:
layer 1's `PcurveRangeOver`, which locates the curve's end points on the pcurve and moves the end by
the pcurve's parameter period where its space point repeats. It never reads the pcurve's own
domain. The bottom circle of a cylinder is a closed edge whose pcurve is a 2D line `v = 0`: its own
domain is unbounded, and the first version's rule sampled `[-1.8e308, 1.8e308]` (review F4b). Now
the range is `[a, a + 2 pi / |du|]`, one turn. A closed edge spans one parameter period by index
identity, as in `EdgeDomain`.

Four laws couple a pcurve to its edge (review M3). `Law_PcurveAgreesWithCurve` (pcurve to curve)
and `Law_CurveAgreesWithPcurve` (curve to pcurve) make them one point set within `epsL`;
`Law_PcurveRunsWithCurve` checks that their tangents do not point apart, which is the premise of
orienting a pcurve with the coedge's composed sense; `Law_PcurveSurfaceIsAFaceSurface` checks that
the pcurve's surface is one a face citing the edge lies on (a Warning: `PcurvesOnFace` ignores any
other). Same parameterization, `|S(q(t)) - c(t)| <= epsL` at the edge's parameters, is not a law:
STEP does not promise it (layer 1 decision 8). `SharesCurveParameter` decides it per pcurve, and is
the route choice of review C5 for layers 4 and 5: evaluate the pcurve at the curve's parameters
where it holds, invert where it does not.

## Euler-Poincare and the counting rule

The Euler characteristic with compact support is additive over a partition into cells: a point
counts `+1`, an open arc `-1`, and an open face with `L_f` bounds `2 - L_f` (a sphere with `L_f`
disks or points removed). A closed shell is the disjoint union of its cells, so

```
chi = V - E + sum over faces (2 - L_f) = V - E + 2F - L
```

and a closed, connected, orientable surface of genus `G` has `chi = 2 - 2G`. ISO 10303-42 writes the
same equation for a solid as `V - E + 2F - L - 2(S - G) = 0`
(research/VALIDATION-MATH.md 1.1). The derivation assumes every counted edge is an open arc and every
bound removes something distinct. Real files break both assumptions: degenerate edges at poles have
no extent, and a vertex loop placed on a vertex of another bound of the same face removes nothing.
So the counts are reduced first (research/VALIDATION-MATH.md 1.4):

1. **Contract degenerate edges.** An edge is degenerate when its curve over its domain stays within
   the length tolerance of its start vertex (`IsDegenerateEdge`). A closed degenerate edge is
   deleted. An open one is deleted and its two vertices merged, which leaves `chi` unchanged. An edge
   loop left with no coedge becomes a vertex loop on the merged vertex.
2. **Drop redundant vertex loops**: a vertex loop whose vertex lies on another bound of the same
   face, or repeats an earlier vertex loop there.
3. **Identify poly-loop points** by coincidence within the length tolerance. Their implicit edges
   are the unordered pairs of consecutive identified points.
4. **Count per shell**: `V` distinct vertex classes the remaining bounds reference, `E` distinct
   remaining edges (a seam counts once), `F` faces, `L` remaining bounds.

`RawCounts` counts the indexed cells as the file gives them, and is a definition. `ReducedCounts`
applies the rule and is deferred (union-find). `ShellEulerPoincare` is `V - E + 2F - L` on reduced
counts and `ShellGenus` is `(2 - chi) / 2`. `Law_EulerPoincareEvenAndBounded` checks, per shell
declared closed, that `chi` is even and at most 2, which is ISO's condition 9. Nothing in a file
states the genus, so no law can check the full equality. Checking per shell matters: an error of
`+1` in one shell and `-1` in another cancel in a model total. The reduction makes `chi`
meaningful despite a defect but does not excuse it: `Law_EdgeHasPositiveExtent` and
`Law_NoRedundantVertexLoop` still report the defect, as a Warning (decision 12). The use-count laws
judge the reduced complex: a degenerate edge is exempt from them (`CountsAsEdge`), so a sphere
written `[seam+, degN, seam-, degS]`, whose pole edges are each used once, is not reported as open.

An open shell is a compact surface with boundary. With `B` boundary circles, `chi = 2 - 2G - B`, and
the cells counted include the boundary's, so `Law_OpenShellEulerEvenAndBounded` requires `chi + B`
even and at most 2. A single square face: `V = 4, E = 4, F = 1, L = 1`, `chi = 1`, `B = 1`, sum 2. A
cylinder's seamed side face alone: `V = 2, E = 3, F = 1, L = 1`, `chi = 0`, `B = 2` (the two
circles), sum 2. `B` is the number of closed walks over the free edges, crossing each vertex through
its link, which in an open shell is one path at a boundary vertex
(`Law_OpenShellVertexLinkIsCycleOrPath`).

Worked examples, all checked by hand. Raw counts first; a second row where the reduction changes
them.

| Model | V | E | F | L | chi | G |
|---|---|---|---|---|---|---|
| Box | 8 | 12 | 6 | 6 | 2 | 0 |
| Cylinder: two circles and one seam; side loop `[bottom, seam, top reversed, seam reversed]` | 2 | 3 | 3 | 3 | 2 | 0 |
| Cylinder: two circles, no seam (the side face is a band with two loops) | 2 | 2 | 3 | 4 | 2 | 0 |
| Sphere: seam from pole to pole, loop `[seam+, seam-]` | 2 | 1 | 1 | 1 | 2 | 0 |
| Sphere: as above plus vertex loops at both poles, raw | 2 | 1 | 1 | 3 | 0 (wrong) | |
| the same, reduced: both vertex loops sit on the seam loop's vertices and are dropped | 2 | 1 | 1 | 1 | 2 | 0 |
| Sphere: no seam, vertex loops at both poles (an open annulus) | 2 | 0 | 1 | 2 | 2 | 0 |
| Sphere: one vertex loop only (a sphere minus a point) | 1 | 0 | 1 | 1 | 2 | 0 |
| Sphere: loop `[seam+, degN, seam-, degS]` with degenerate pole edges, raw | 2 | 3 | 1 | 1 | 0 (wrong) | |
| the same, reduced: both degenerate closed edges deleted | 2 | 1 | 1 | 1 | 2 | 0 |
| Cone: base circle and a vertex loop at the apex on the side face | 2 | 1 | 2 | 3 | 2 | 0 |
| Torus: meridian `a` and parallel `b` crossing at one vertex, loop `[a+, b+, a-, b-]` | 1 | 2 | 1 | 1 | 0 | 1 |
| Block with a square through hole (top and bottom each carry an inner loop) | 16 | 24 | 10 | 12 | 0 | 1 |
| Block with a round through hole (the hole wall has one seam) | 10 | 15 | 7 | 9 | 0 | 1 |
| Hollow box, outer shell | 8 | 12 | 6 | 6 | 2 | 0 |
| Hollow box, void shell (faces stored reversed) | 8 | 12 | 6 | 6 | 2 | 0 |

The hollow box shows why the law is per shell. The model total, `V = 16, E = 24, F = 12, L = 12`,
gives `chi = 4`, which `Law_EulerPoincareEvenAndBounded` would reject if it were applied to the
model instead of to each shell.

The formula is necessary, not sufficient. Two L-shaped blocks touching at two corners give
`chi = 2` with two non-manifold vertices, which only `Law_VertexLinkIsOneCycle` catches. A box with
a sheet glued along one edge satisfies the formula with an edge used three times, which
`Law_EveryEdgeUsedTwiceInClosedShell` catches. A sphere's faces and a torus's faces in one closed
shell give `chi = 2 + 0 = 2` and pass every local law as genus 0; only `Law_ShellIsConnected`
catches them. The theorem `ClosedOrientableShellHasEvenEuler` in the spec file shows which laws
imply the parity half. Parity survives faces with handles, because a handle changes `chi` by 2. The
bound `chi <= 2` needs a connected shell, which `Law_ShellIsConnected` now checks, and handle-free
faces, which no law here can check (a torus face with no bound counts 2 where its surface has 0), so
it stays a law of its own.

## The vertex link

The edge condition does not exclude two sheets meeting at a point. The vertex condition is that a
small sphere around the vertex meets the shell in one circle (research/VALIDATION-MATH.md 2.2). Over
the tables:

- A **corner** at `v` is a pair of consecutive coedges of an edge loop whose first coedge ends at
  `v`. It is named by that coedge's site (`CornersAtVertex`).
- Its two **ends** are the edge end the first coedge arrives through (`ArrivingEnd`: the edge's
  `End` for a forward coedge, its `Start` for a reversed one) and the edge end the next coedge leaves
  through (`LeavingEnd`). A closed edge has two distinct ends at one vertex.
- The **link** of `v` is the graph on those edge ends whose links are the corners. Every end has
  degree 2 when every edge at `v` has two uses. `Law_VertexLinkIsOneCycle` requires one component
  (`LinkComponentCount`, deferred) for shells declared closed.
- `CornersAroundVertex` lists the corners in cyclic order and `FacesAroundVertex` their faces. The
  order exists "where the model allows": when the link is one component and no edge at `v` has more
  than two uses. It closes into a cycle when every edge at `v` has two uses, and is a path at an open
  shell's boundary vertex.

Examples. At the cylinder's bottom vertex the ends are bottom-circle `Start`, bottom-circle `End`
and seam `Start`. The bottom cap's corner joins the two circle ends, and the side face's two corners
join circle `End` to seam `Start` and seam `Start` to circle `Start`: one triangle, so the vertex is
manifold, with faces around it `[bottom cap, side, side]`. At a sphere's pole with loop
`[seam+, seam-]` there is one corner, which joins seam `End` to itself: one cycle of length 1. Two
cones apex to apex give two cycles at the shared apex and fail the law; their reduced counts give
`chi = 3`, which fails the Euler law too. A vertex loop's vertex has no corners, so
`Law_VertexLoopVertexIsIsolated` requires that no edge of the shell touches it.

## Size and extent

`ModelSize(m)` is the diagonal of the bounding box of the model's defining points (vertex points,
poly-loop points, and every point, placement origin and control point of the arena), and
`CoordinateExtent(m)` their largest absolute coordinate. Layer 0 divides the angle parameter floor
by the size, which bounds a radius, and takes every rounding floor at the extent, because rounding
follows the magnitude of the coordinates: a building in millimetres at survey coordinates near
`5e9` mm has a size near `1e5` and `ResolutionAt(5e9) = 1.8e-5` mm, where `ResolutionAt(1e5)` would
claim `3.6e-10` (review F6). Layer 3 exports both in `DecodedModel`. A face's points can lie up to a
radius outside the defining points' box (a full circle with one vertex), and that radius is at most
the size, so the true extent is at most `CoordinateExtent + ModelSize`. `DefiningPoints` over
`BrepCurve` and `BrepSurface` is layer 1's knowledge and is marked `belongs-in: 01-geometry`.

## Model transforms

`RigidlyMoved(m, motion)` and `ScaledBy(m, factor)` are the metamorphic inputs of
research/VALIDATION-MATH.md 6.4, declared here once for layers 7 and 8 (FIX-WAVE.md ownership
table). `RigidlyMoved` moves every point of the arena, every vertex and every poly-loop point by
`motion.PointInFrame`, turns every frame, direction and vector, and keeps every parameter, so the 2D
curves and pcurves are unchanged; the topology rows are copied, so indices, senses and edge-domain
structure carry over. `ScaledBy` scales the arena through layer 1's `ScaledGeometry` (positions,
radii and speed vectors by the factor, so curve parameters stay; a length along a unit frame axis,
the plane's `u` and `v` and the cylinder's and cone's `v`, scales, and every pcurve's 2D curve is
rescaled for its surface; the first version of this transform in layer 7 left pcurves as they were),
every vertex and poly-loop point by `ScaledPoint`, and the tolerances as a re-decode of the scaled
file would set them (`ScaledTolerances`: the length tolerance and the length parameter floor scale,
the angle tolerance and the angle floor stay). With the per-kind floors of layer 0, scaling by a
power of two is exact in both directions. The arena parts of the rigid motion (`MovedGeometry`,
`Moved` over `BrepCurve` and `BrepSurface`, `MovedFrame`, `MovedDirection`, `MovedVector`) are
layer 1's knowledge and are marked `belongs-in: 01-geometry`; `ScaledTolerances` is marked
`belongs-in: 00-foundation`.

## Decisions

1. **Coedges are addressed by site.** A `Coedge` value does not say which face and bound use it,
   and the bound's `Orientation` is a factor of the sense. `CoedgeSite { Face; Bound; Slot }` names
   one coedge in place. `Bound` and `Slot` are positions inside one row's own array, so they are
   Integers, by VOCABULARY.md's rule for corner slots.
2. **Sense in Booleans.** `CoedgeRunsForwardOnCurve` is a two-level XNOR, exact and branch-free.
   An Integer sign is never stored.
3. **`FaceNormalSign` is relative to the parameterization**, `sigma(SameSense) * epsilon`, so that
   face meshing's left/right rule and the winding law read one number. `epsilon` comes from layer 1.
4. **The edge domain runs forward, and closedness is index identity.** The two alternatives,
   traversal-ordered ranges and closedness by coincidence, each make layer 4's discretization or the
   full-circle case ambiguous. Whether a closed edge spans a period is decided by the curve's
   periodicity alone (`Periodic` or `Closed`, decided once by layer 3), never by the curve's domain:
   on a curve that does not loop, a closed edge is degenerate.
5. **Pcurves are found through the curve**, not stored on coedges: `Coedge` is fixed with two
   fields, pcurves are optional in STEP, and assigning the two seam pcurves to uses is face meshing's
   job.
6. **Edge-use, link and Euler laws are per shell.** Errors in different shells do not cancel, and an
   edge shared by two shells of a `ShellSet` is legal.
7. **Structural laws guard locally; geometric laws guard globally.** A loop that fails to chain is
   reported even when some face elsewhere has a dangling index. A law that evaluates geometry or calls
   a deferred function requires `IsEveryIndexInRange`, because layer 1's evaluators read the arena
   and an out-of-range basis curve would fault inside them.
8. **Degeneracy is a property of the curve over the edge domain**, not of the vertex points: a
   full circle has coincident ends and is not degenerate.
9. **The winding law applies only to plain faces** (`IsPlainInParameters`). With a seam, a loop
   wrapping a `Periodic` or `Closed` direction, or a pole, the parameter-space image depends on choices face meshing makes: which seam copy,
   where to cut, where the collapsed side lies. Layer 5's region laws check those faces after the
   choice. Plane faces, split cylinder faces and most B-spline faces are plain.
10. **No law takes a free genus or a rounding bound.** Research/VALIDATION-MATH.md proposes
    `Law_EulerPoincareMatchesGenus(m, s, g)`, but it is false for most values of `g`, and a law must
    hold for every value of its parameters. A witness's known genus belongs to layer 7.
    `Law_EdgeDomainWithinPeriod` holds by construction up to rounding, which needs a rounding bound,
    not a model tolerance (SPEC-EXECUTION.md 5.9 item 4). It is stated as `ensures` clauses of
    `EdgeDomain` instead.
11. **Lower-layer names are only the fixed ones.** Layer 0 has written `Coincident`, `Wrap` and
    `ParameterToleranceAt`, but VOCABULARY.md lists them as proposed, so this layer defines
    `IsCoincident(m, a, b)` and `PeriodicRepresentativeAbove` itself and records the duplication
    below.

12. **A defect the reduction repairs exactly is a Warning** (research/VALIDATION-MATH.md open
    question 4, settled in the fix wave). A degenerate edge (`Law_EdgeHasPositiveExtent`) and a
    redundant vertex loop (`Law_NoRedundantVertexLoop`) break ISO 10303-42, and real exporters write
    both (spheres B and C, the cone with a degenerate apex edge). The reduction removes them without
    changing the point set; the use-count laws exempt degenerate edges (`CountsAsEdge`), and face
    meshing builds its region from `KeptBounds`. So nothing the pipeline computes depends on them,
    and `IsClean` stays true. Two edge loops of one face touching at a vertex are not repaired and
    stay an Error (`Law_FaceBoundsShareNoVertex`). This adds a third rule to SPEC-DSL.md section 4's
    "structural is Error": a structural defect with an exact repair is a Warning.

## Laws

Kind: structural laws are exact or tolerance-based statements about topology or about the data's
claims, Error when they fail. A geometric law is a Warning when it fails by less than ten times its
tolerance and an Error above (SPEC-DSL.md section 4). A library law can fail only through a defect in
this library. `epsL` is `Tolerances.Length.Value`; a parameter tolerance is the one at the point,
layer 1's `ParameterToleranceAt`.

| Law | Statement | Tolerance | Kind, severity |
|---|---|---|---|
| `Law_IndicesInRange(m)` | every index in every table, and in the arena, names an existing row | exact | structural, Error |
| `Law_LoopsChainEndToStart(m, l)` | an edge loop is a non-empty closed chain | exact | structural, Error |
| `Law_AtMostOneOuterBound(m, f)` | at most one bound marked outer | exact | structural, Error |
| `Law_AtLeastOneBound(m, f)` | at least one bound | exact | structural, Error |
| `Law_FaceBoundsShareNoVertex(m, f)` | distinct bounds of a face share no vertex, redundant vertex loops left out | exact | structural, Error |
| `Law_NoRedundantVertexLoop(m, f)` | no bound is a vertex loop on another bound's vertex or repeating an earlier vertex loop | exact | structural, Warning (repaired) |
| `Law_PolyLoopHasThreePoints(m, l)` | a poly loop has at least three points | exact | structural, Error |
| `Law_PolyLoopEdgesPairUp(m, s)` | a faceted shell's implicit edges obey the edge-use rules after identification | `epsL` | structural, Error |
| `Law_EveryEdgeUsedTwiceInClosedShell(m, s, e)` | in a shell declared closed, a non-degenerate edge it uses has exactly two uses | exact | structural, Error |
| `Law_OpenShellEdgesUsedAtMostTwice(m, s, e)` | in a shell not declared closed, no non-degenerate edge has more than two uses | exact | structural, Error |
| `Law_DeclaredClosedIsClosed(m, s)` | a shell declared closed has no non-degenerate edge used exactly once | exact | structural, Error |
| `Law_EdgeUsesHaveOppositeOrientation(m, s, e)` | an edge's two uses in a shell have opposite composed senses | exact | structural, Error |
| `Law_EdgeReversalKeepsCoedgeSense(m, site)` | reversing the coedge's edge leaves its composed sense unchanged | exact | library, test |
| `Law_SeamUsesRunOpposite(m, f, e)` | an edge's two uses in one face (a seam) have opposite composed senses, for every face, in a shell or not | exact | structural, Error |
| `Law_VertexLinkIsOneCycle(m, s, v)` | in a shell declared closed, the link of a vertex with corners has one component | exact | structural, Error |
| `Law_VertexLoopVertexIsIsolated(m, s, v)` | a vertex-loop vertex is an end of no edge the shell cites | exact | structural, Error |
| `Law_EulerPoincareEvenAndBounded(m, s)` | in a shell declared closed, reduced `V - E + 2F - L` is even and at most 2 | exact | structural, Error |
| `Law_OpenShellEulerEvenAndBounded(m, s)` | in a shell not declared closed, reduced `V - E + 2F - L` plus the boundary cycle count `B` is even and at most 2 | exact | structural, Error |
| `Law_OpenShellVertexLinkIsCycleOrPath(m, s, v)` | in a shell not declared closed, the link of a vertex with corners has one component | exact | structural, Error |
| `Law_ShellIsConnected(m, s)` | the shell's faces form one class under touching at a vertex or a coinciding poly-loop point | exact | structural, Error |
| `Law_ShellIsOrientable(m, s)` | reversing the faces `OrientationFlips` names makes every edge's two uses opposite | exact | structural, Error |
| `Law_ReversingEveryFaceKeepsCoherence(m, s)` | reversing every face leaves the shell's coherence unchanged | exact | library, test |
| `Law_SolidShellsAreDeclaredClosed(m, b)` | the outer and void shells of a solid are declared closed | exact | structural, Error |
| `Law_EdgeDomainIsForward(m, e)` | the edge domain's start does not exceed its end | parameter tolerance at the start | structural, Error |
| `Law_EdgeReversalKeepsEdgeDomain(m, e)` | reversing an edge leaves its domain unchanged, bit for bit | exact | library, test |
| `Law_EdgeDomainEndsAtVertices(m, e, atStart)` | the curve at the domain end assigned to a vertex reproduces the vertex | `epsL` | geometric, W/E |
| `Law_VertexCoincidesWithCurveEnd(m, e, atStart)` | a vertex lies on its edge's curve | `epsL` | geometric, W/E |
| `Law_CoincidentEndsAreOneVertex(m, e)` | two distinct vertices of an edge coincide only if the edge is degenerate | `epsL` | structural, Error |
| `Law_EdgeHasPositiveExtent(m, e)` | no edge is degenerate | `epsL` | structural, Warning (repaired) |
| `Law_DegenerateEdgeHasCoincidentVertices(m, e)` | a degenerate edge's two vertices coincide | `epsL` | structural, Error |
| `Law_DegenerateEdgeStaysAtStart(m, e, t)` | a degenerate edge's curve at fraction `t` lies at its start vertex | `epsL` | library, test |
| `Law_EdgeLiesOnAdjacentSurfaces(m, site, t)` | the edge's curve at fraction `t` lies on the surface of the face citing it | `epsL` | geometric, W/E |
| `Law_PcurveAgreesWithCurve(m, e, k, t)` | the `k`-th pcurve's point at fraction `t` of its bounded edge range lies on the 3D curve | `epsL` | geometric, W/E |
| `Law_CurveAgreesWithPcurve(m, e, k, t)` | the curve's point at fraction `t` of the edge domain lies on the `k`-th pcurve's image | `epsL` | geometric, W/E |
| `Law_PcurveRunsWithCurve(m, e, k, t)` | the pcurve's and the curve's tangents do not point apart | exact sign beyond rounding | structural, Error |
| `Law_PcurveSurfaceIsAFaceSurface(m, e, k)` | the pcurve's surface is that of a face citing the edge | exact | structural, Warning (ignored) |
| `Law_ParameterizationSignIsConstantOnFace(m, site, t)` | at the projection of a coedge point, `N . (PartialU x PartialV)` has the sign `epsilon` says, where resolvable | exact sign | library, test |
| `Law_ModelSizeWithinExtent(m)` | the model size is at most `2 sqrt(3)` times the coordinate extent | `ResolutionAt(size)` | library, test |
| `Law_RigidMotionKeepsCoedgeSense(m, motion, site)` | a rigid motion leaves every coedge's composed sense unchanged | exact | library, test |
| `Law_ScalingScalesExtent(m, factor)` | scaling by a positive factor scales the coordinate extent by it | `ResolutionAt(scaled extent)` | library, test |
| `Law_LoopWindingMatchesSameSense(m, f)` | a plain face's parameter-space region has the sign `FaceNormalSign` says | exact sign | structural, Error |

The pointwise laws take a fraction `t`, clamp it into `[0, 1]`, and map it onto the domain. Layer 7's
`Check_` functions choose `t` with layer 0's `SamplePlan` and report the largest measure
(`SurfaceDeviationAt`, `PcurveDeviationAt`, `VertexCurveDeviation`, `DomainEndDeviation`) as `Worst`.
A passing sample set is a lower bound on the worst deviation, never a proof
(research/VALIDATION-MATH.md 3.2).

## Deferred functions

The algorithm families as the design pass wrote them. None is still bodiless: ten have the bodies
described in "Implementation, chunk A", and `SharesCurveParameter` has the one the genus track gave it.

| Function | Algorithm | Measure |
|---|---|---|
| `IsDegenerateEdge(m, e)` | largest distance from a point to a curve arc: closed form for lines and conics, span subdivision and Newton for splines | 1 per edge, span count for splines |
| `ReducedCounts(m, s)` | union-find over vertices joined by degenerate edges, one pass over bounds, spatial hash for poly-loop points | coedge sites plus bounds of the shell |
| `LinkComponentCount(m, s, v)` | union-find over edge ends at `v` | corners at `v` |
| `PolyEdgeUseDefects(m, s)` | spatial hash and union-find over poly-loop points, one pass over directed implicit edges | faces plus bounds of the shell |
| `BoundaryCycleCount(m, s)` | walk the free edges, crossing each vertex's link path | free edges of the shell |
| `OrientationFlips(m, s)` | two-colouring of the face graph by the parity of each edge's two uses | coedge sites of the shell |
| `ShellComponentCount(m, s)` | union-find over the shell's faces joined at shared vertices and coinciding poly-loop points | coedge sites plus bounds of the shell |
| `CornersAroundVertex(m, s, v)` | walk the link across shared ends | corners at `v` |
| `IsPlainInParameters(m, f)` | sample coedges, `Project`, lift by continuity across the period of every direction with a seam (`Periodic` or `Closed`), test closure and pole contact | coedge sites of `f` times samples |
| `SharesCurveParameter(m, e, k)` | `PcurveParameterDeviationAt` at breakpoints and midpoints, bisecting where it grows | breakpoints of the edge domain |
| `SignedParameterArea(m, f)` | shoelace over the lifted polygons, refined until the sign is settled | coedge sites of `f` times samples |

## Names

**Declared here, fixed by the contract**: `EdgeOrientation`, `Coedge`, `BrepVertex`, `BrepEdge`,
`BrepLoop` (`EdgeLoop`, `VertexLoop`, `PolyLoop`), `FaceBound`, `BrepFace`, `BrepShell`, `BrepBody`
(`ManifoldSolid`, `SolidWithVoids`, `ShellSet`), `LengthUnit`, `BrepModel`, `ShellCounts`, the six
range predicates, `StartVertex`, `EndVertex`, `EdgeDomain`, `CoedgeRunsForwardOnCurve`,
`FaceNormalSign`, `ReducedCounts`, and 17 laws: the 13 VOCABULARY.md lists and the 4 the layer
brief added (`Law_SeamUsesRunOpposite`, `Law_EdgeDomainEndsAtVertices`,
`Law_LoopWindingMatchesSameSense`, `Law_OpenShellEdgesUsedAtMostTwice`).

**Declared here, new** (proposed; the consumers most likely to use each in parentheses):
`CoedgeSite`, `EdgeEnd`; `CoedgeSitesOfFace`, `CoedgeSitesOfShell`, `CoedgeSitesOfEdge`,
`CoedgeSitesOfEdgeInFace`, `CoedgeAt`, `BoundAt`, `NextSite`, `IsCoedgeSiteInRange` (5, 7);
`ShellFaces`, `LoopsOfFace`, `FacesOfEdge(m, s, e)`, `EdgesOfShell`, `VerticesOfShell`, `UseCount` (6, 7);
`Opposite`, `CoedgeCount`, `CitesEdge`, `LoopUsesEdge`, `FaceUsesEdge`, `FacesOfEdge(m, e)` (the
shell-free form), `SwappedEnds`, `WithUsesFlipped`, `WithEdgeReversed` (4, 8; adopted from layer 4's
`belongs-in: 02-topology` stand-ins with the same signatures);
`IsSeamEdgeOf`, `HasSeam`, `PcurvesOnFace`, `PcurveEdgeDomain`, `DomainEndParameter`,
`FirstVertexAlongCurve`, `LastVertexAlongCurve`, `IsClosedEdge`, `IsOnClosedCurve`, `EdgeCurvePoint` (4, 5);
`CornersAtVertex`, `CornersAroundVertex`, `FacesAroundVertex`, `LinkComponentCount` (5, 7);
`RawCounts`, `EulerPoincare`, `ImpliedGenus`, `ShellEulerPoincare`, `ShellGenus` (7);
`IsDegenerateEdge`, `IsCoincident`, `IsEveryIndexInRange(m)`, `ScaleToMetres`, the deviation
measures (7, 8); and the seven laws beyond the contract's list, in the table above.

**Used from other layers' fix-wave declarations**: from layer 0, `Periodicity.Closed`, `HasSeam(d)`,
`Wrap(d, t)`, `PeriodicRepresentativeAbove`, `Tolerances.LengthParameter` and `AngleParameter`,
`ResolutionAt`; from layer 1, `PcurveRangeOver`, `PcurveParameterPeriod`, `ScaledGeometry`,
`GeometrySet.Closures`, `ParameterToleranceAt(g, c, t, tol)`, `NormalAgreesWithParameterization`
(one sign per surface, mirrored frames and the full torus included), `FrameVector`, `Derivative`
over curves and pcurves. Layer 1's `PlacementHandedness` is deliberately not read: layer 3 folds it
into `SameSense` ("Sense and orientation, composed").

**Used from 00-foundation (fixed)**: `CurveIndex`, `PcurveIndex`, `SurfaceIndex`, `BrepVertexIndex`,
`BrepEdgeIndex`, `BrepLoopIndex`, `BrepFaceIndex`, `ShellIndex`, `BodyIndex` (each with `IValue`, so
`==` works, as layer 0 declares them); `Tolerances` with `Length`;
`CurveDomain`, `Periodicity` (`Aperiodic`, `Periodic`). The spec file also uses `SurfaceDomain` and
`DomainSide`, and the README names `SamplePlan` (proposed).

**Used from 01-geometry (fixed)**: `GeometrySet` with `Curves`, `Curves2D`, `Pcurves`, `Surfaces`;
`Pcurve` with `Surface` and `Curve`; `Domain(g, c: CurveIndex)`, `Eval(g, c, t)`,
`ClosestParameter(g, c, p)`, `Eval(g, s, uv)`, `Project(g, s, p)`; in the spec file also
`Domain(g, s)`, `PartialU`, `PartialV`, `NormalOr`, `AreaElement`, `DegenerateSides`.

**Used from 01-geometry, declared there but not yet fixed in VOCABULARY.md**:
`IsEveryIndexInRange(g)`, `PcurvesOf(g, c)`, and `Domain`, `Eval`, `ClosestParameter` over
`PcurveIndex`. This layer first declared them itself with `// belongs-in: 01-geometry`. Layer 1
then wrote the same five signatures, so the copies were removed to keep calls unambiguous. They
should move to VOCABULARY.md's fixed list. This layer relies on three properties of them:
`ClosestParameter` returns a nearest parameter, and returns the same representative every time it
is called; `PcurvesOf` returns at most two pcurves; a pcurve has the sense of its 3D curve.

**Declared here on behalf of lower layers** (`// belongs-in:`), to be deleted once the owner
declares them: for 00-foundation, `ScaledTolerances(t, factor)`; for 01-geometry, `DefiningPoints`
over `BrepCurve` and `BrepSurface`, `MovedGeometry`, `Moved` over `BrepCurve` and `BrepSurface`,
`MovedFrame`, `MovedDirection`, `MovedVector`. Deleted in the fix wave because the owner now declares
them: `PeriodicRepresentativeAbove` and `IsPeriodicDomain` (layer 0; this layer uses `HasSeam`), and
`NormalAgreesWithParameterization(g, s)`, the sign `epsilon`, was declared
here for layer 1 and is now layer 1's alone (fix wave).

**Obligations on 03-step**: fold `oriented_face`, `oriented_closed_shell` and void orientation into
`SameSense` and `FaceBound.Orientation`; merge two distinct vertex instances at one point of a
closed curve; decode every index in range (`Law_IndicesInRange` as an `ensures` of `DecodeBrep`).

## What is left open

1. **Open shells' Euler law.** Settled in the fix wave: `Law_OpenShellEulerEvenAndBounded` with the
   deferred walk `BoundaryCycleCount`, and `Law_OpenShellVertexLinkIsCycleOrPath`.
2. **Global laws.** Settled in the fix wave: `Law_ShellIsConnected` and `Law_ShellIsOrientable`
   (research/VALIDATION-MATH.md 2.3), with `OrientationFlips` naming the faces to flip.
3. **Faceted B-reps.** Settled in the fix wave: this layer checks poly loops directly
   (`Law_PolyLoopEdgesPairUp`, `Law_PolyLoopHasThreePoints`) through the same identification as
   `ReducedCounts`, and connectivity sees coinciding poly-loop points. Rewriting poly loops into edge
   loops at decode would remove a case of `BrepLoop` that five layers match on.
4. **The rest of the pcurve laws.** Settled in the fix wave (review M3): see "Pcurves".
5. **Parameter-space loop laws.** Settled in the fix wave: simplicity and nesting
   (`Law_LoopSimpleInParameterSpace`, `Law_InnerBoundInsideOuter`) are layer 5's region laws, for
   plain faces too. A second copy here for plain faces would judge the same polygons twice, built by
   a different unwrapping (`IsPlainInParameters`) that could disagree with layer 5's.
6. **The parameter tolerance for curve parameters.** Settled in the fix wave: layer 1's
   `ParameterToleranceAt(g, c, t, tol)` at the range's start (review T8).
7. **Caching edge domains.** Settled in the fix wave (review T9): not stored. `EdgeDomain` and
   `PcurveEdgeDomain` are pure functions of the model, each the one definition of its range; an
   implementation memoizes them per edge. A stored table would add a tenth field to `BrepModel`,
   which every layer constructs, and a law saying the table equals the function, which is the
   function again.
8. **Severity of a repaired defect.** Settled in the fix wave: a Warning (decision 12).
9. **Cross-shell pinches.** Settled in the fix wave: legal, no law. Two shells of a `ShellSet`, or
   two solids, touching at a vertex or sharing an edge are separate surfaces that meet; each is
   judged on its own by the per-shell laws (decision 6), and nothing in a shell set says its shells
   must be apart. A pinch inside one shell is still caught by the link laws.

## Implementation notes

- The bodies are definitions, and several are quadratic: `EdgesOfShell` calls `UseCount` once per
  edge, and each call enumerates the shell's coedge sites. An implementation builds one incidence
  table per shell (edge to sites, vertex to corners) in a single pass, and `Check_` functions read
  it. A `Check_` also evaluates the `IsEveryIndexInRange` guard once per model, not once per element.
- `IsDegenerateEdge` has a fast path. When the two vertex points are more than `2 epsL` apart the
  edge cannot be degenerate, provided `Law_VertexCoincidesWithCurveEnd` holds.
- `ReducedCounts` and `LinkComponentCount` are both union-find over small sets. A full circle's two
  ends are distinct nodes, so key edge ends by `(edge, IsStart)`, never by vertex.
- `EdgeDomain` for a closed edge on a periodic curve depends on `ClosestParameter` returning the
  same representative every time it is called. Layer 1's contract should say which representative
  it returns. Layer 1 plans to compute the pcurve form through `Project` and a 2D closest parameter;
  near a pole that is less robust than a one-dimensional projection onto the space curve
  (research/VALIDATION-MATH.md 3.3).
- The sum checker cannot type a `match` whose subject is reached through an overloaded call chain:
  `match (m.Geometry.Domain(c).Periodicity)` gave CHK304 with no location. Bind the value through a
  function with a declared parameter type (layer 0's `HasSeam(d: CurveDomain)` is one).
- The type checker accepted `Boolean == 1` in a probe. Equality between unlike types is not caught,
  so every `==` here was checked by reading.
- With a 32-bit `Number` (PLATO-PRIMER.md D.1), coordinates near 100 m in millimetres are about
  0.008 mm apart. That is coarser than most files' uncertainty, so every `epsL` comparison would be
  dominated by rounding.

## Gate result

Run on 2026-10-17 with the PLATO-PRIMER.md E.3 driver, built in the scratch folder.

- **This folder alone**: parse passes. Resolution stops only on names from layers 0 and 1:
  `BrepVertexIndex`, `BrepEdgeIndex`, `BrepLoopIndex`, `BrepFaceIndex`, `ShellIndex`, `BodyIndex`,
  `CurveIndex`, `PcurveIndex`, `SurfaceIndex`, `Tolerances`, `CurveDomain`, `Periodicity` (layer
  0); `GeometrySet` and its field `Pcurves`, `ClosestParameter` over `PcurveIndex`, `PcurvesOf`,
  `Project` (layer 1).
- **With layer 0's files as they stood and a scratch stub of layer 1's names**: PASS, 0 errors.
  The only findings are 8 Info-level LINT003 notes ("field never read") on fields that are read
  through typed-index lookups, which the linter does not follow.
- **With layers 0 and 1 as they stood**: no finding in this folder, given a two-line stub for the
  surface `Eval` and `Project` that layer 1 had not yet written. Layer 1's own in-progress files
  had 22 errors (12 CHK304 among them); none came from this layer.
- One finding was fixed on the way: CHK304 on a `match` over a chained, overloaded call (see
  "Implementation notes").

Fix wave, 2026-10-17: every finding was gated with the same driver over this folder and a snapshot
of the other layers taken at the start of the wave, extended with the declarations their owners
committed during the wave (the `Closed` case, `HasSeam`, `PeriodicRepresentativeAbove`, the
`Tolerances` split, `GeometrySet.Closures`, layer 1's `PcurveRangeOver`, `PcurveParameterPeriod`
and `ScaledGeometry`): 0 findings in this folder each time. Before the last commit, all nine layers
as committed on `main`, with this folder: `PASS: 0 error(s) in scope; 6647 functions
type-checked`.

## Changes to the contract

| Old | New | Reason |
|---|---|---|
| (none) | `CoedgeSite { Face: BrepFaceIndex; Bound: Integer; Slot: Integer }` | a coedge's composed sense needs its bound, and laws and traversal must name one coedge in place |
| (none) | `EdgeEnd { Edge: BrepEdgeIndex; IsStart: Boolean }` | the nodes of a vertex's link; a closed edge has two ends at one vertex |
| `CoedgeRunsForwardOnCurve(m, bound, coedge)` | the same, with `bound: FaceBound`, `coedge: Coedge`, plus an overload `(m, site: CoedgeSite)` | the contract named the function without parameter types |
| `FaceNormalSign` | `FaceNormalSign(m, f): Integer`, `sigma(SameSense) * epsilon`, relative to `PartialU x PartialV` | one number for the left/right rule and the winding law; needs `NormalAgreesWithParameterization` from layer 1 |
| `EdgeDomain(m, e)` | range always increasing; closedness by `Start == End` index; a closed edge on an aperiodic curve spans the curve's domain | layer 4 needs an increasing range; closedness by coincidence is ambiguous |
| `ShellCounts { Vertices; Edges; Faces; Loops: Integer }` | all four fields `Integer`; (new) `RawCounts`, `EulerPoincare(c)`, `ImpliedGenus(c)`, `ShellEulerPoincare`, `ShellGenus` | the Euler value and genus the brief asks for, and the raw counts the reduction's contract refers to |
| (none) | traversal and site functions listed under "Names" | the brief's traversal: coedges of an edge, faces of an edge, loops of a face, edges of a shell, faces around a vertex |
| (none) | laws `Law_FaceBoundsShareNoVertex`, `Law_VertexLoopVertexIsIsolated`, `Law_SolidShellsAreDeclaredClosed`, `Law_EdgeDomainIsForward`, `Law_CoincidentEndsAreOneVertex`, `Law_EdgeHasPositiveExtent`, `Law_DegenerateEdgeStaysAtStart` | the first two and `Law_EdgeHasPositiveExtent` report defects the reduction repairs; the rest guard the edge-domain rule, the body kinds, and `IsDegenerateEdge`'s contract |
| research `Law_EulerPoincareMatchesGenus`, `Law_EdgeDomainWithinPeriod` | not declared | a free genus parameter makes the first false for most values; the second is rounding-only and is an `ensures` of `EdgeDomain` |
| research `Law_VertexLinkIsSingleCycle`, `Law_EdgeUsedAtMostTwiceInOpenShell` | `Law_VertexLinkIsOneCycle`, `Law_OpenShellEdgesUsedAtMostTwice` | the contract's and the brief's names kept |
| (none) | requested of 00-foundation: `PeriodicRepresentativeAbove`, `IsPeriodicDomain` | periodic arithmetic on layer 0's types; `Wrap` exists there but is proposed and gives `[0, P)`, not `(0, P]` |
| (none) | requested of 01-geometry: `NormalAgreesWithParameterization(g, s)` | the sign `epsilon` that the `Lemon` torus case needs |
| (proposed in layer 1's files) | to be fixed: `IsEveryIndexInRange(g)`, `PcurvesOf(g, c)`, `Domain`, `Eval`, `ClosestParameter` over `PcurveIndex` | this layer calls them for arena totality and for pcurves found through the curve |
| `EdgeDomain`: a closed edge on an aperiodic curve spans the curve's domain | spans a period on a `Periodic` or `Closed` curve, `[a, a]` otherwise; `Closed` kept only for a closed edge | review F4a, F4c, T1 (fix wave) |
| `PcurveEdgeDomain` by the `EdgeDomain` rule on the pcurve's own domain | layer 1's `PcurveRangeOver` over the edge domain; one parameter period for a closed edge | review F4b (fix wave) |
| `IsOnPeriodicCurve(m, e)` | `IsOnClosedCurve(m, e)` over layer 0's `HasSeam` | `Closed` counts as a seam (fix wave) |
| `Law_FaceBoundsShareNoVertex` covers redundant vertex loops; `Law_EdgeHasPositiveExtent` Error | `Law_NoRedundantVertexLoop` (Warning) split out; `Law_EdgeHasPositiveExtent` Warning; use-count laws and `FreeEdgeCount` exempt degenerate edges (`CountsAsEdge`) | decision 12 (fix wave) |
| `Law_EdgeDomainIsForward` by `Tolerances.Parameter` | by layer 1's `ParameterToleranceAt` at the range's start | review T8; layer 0 split the floor (fix wave) |
| (none) | laws `Law_ShellIsConnected`, `Law_ShellIsOrientable`, `Law_OpenShellEulerEvenAndBounded`, `Law_OpenShellVertexLinkIsCycleOrPath`, `Law_PolyLoopEdgesPairUp`, `Law_PolyLoopHasThreePoints`, `Law_CurveAgreesWithPcurve`, `Law_PcurveRunsWithCurve`, `Law_PcurveSurfaceIsAFaceSurface`, `Law_NoRedundantVertexLoop`, and seven library laws | review M1, M2, M3, T3, open item 3 (fix wave) |
| (layer 4's and 8's `belongs-in: 02-topology`) | `Opposite`, `CoedgeCount`, `CitesEdge`, `LoopUsesEdge`, `FaceUsesEdge`, `FacesOfEdge(m, e)`, `SwappedEnds`, `WithUsesFlipped`, `WithEdgeReversed`, `WithEveryFaceReversed` | one owner per declaration (fix wave) |
| (layers 7's and 8's copies) | `ScaledBy(m, factor)`, `RigidlyMoved(m, motion)`, `ScaledPoint(p, factor)` with bodies | one owner; pcurves scaled (fix wave) |
| (none) | `ModelSize(m)`, `CoordinateExtent(m)` | layer 0 takes the rounding floor at the extent; layer 3 exports both (fix wave) |
| (none) | `IsRedundantVertexLoop`, `KeptBounds`, `SharesCurveParameter`, `OrientationFlips`, `ShellComponentCount`, `BoundaryCycleCount`, `PolyEdgeUseDefects` | for layers 5 and 7 (review C5, C6) and the new laws (fix wave) |
| requested of 01-geometry: `NormalAgreesWithParameterization`; of 00-foundation: `PeriodicRepresentativeAbove`, `IsPeriodicDomain` | deleted here; owned by layers 1 and 0 | fix wave |

## Fix wave, 2026-10-17

The fixes of the fix wave ([../reviews/FIX-WAVE.md](../reviews/FIX-WAVE.md)), from
[../reviews/MATH-REVIEW-layers-0-6.md](../reviews/MATH-REVIEW-layers-0-6.md) (finding identifiers
`F`, `M`, `C`, `T`, `H` there) and the "Findings in lower layers" of layers 7 and 8. One commit each.

Applied:

- **M1, T3 (connectivity).** `Law_ShellIsConnected(m, s)` over the deferred union-find
  `ShellComponentCount(m, s)`, with `FacesTouch`, `FaceVertices`, `FacePolyPoints`. Faces are joined
  at shared vertices (ISO's arcwise connectivity), not only at shared edges, so two cones apex to
  apex are one component and fail the link law instead.
- **T3 (orientability).** `Law_ShellIsOrientable(m, s)`: reversing the faces the parity search
  `OrientationFlips` names (deferred) makes the shell coherent (`HasCoherentOrientation`). It tells
  a shell with faces stored inside out from a one-sided surface or a twisted seam. New with it:
  `Reversed(face)`, `WithFacesReversed`, `WithEveryFaceReversed` (layer 8's stand-in, same
  signature), `IsOrientable`, the library law `Law_ReversingEveryFaceKeepsCoherence`, and the
  theorem `CoherentShellIsOrientable`.
- **M2 (open shells).** `Law_OpenShellEulerEvenAndBounded(m, s)` (`chi + B` even and at most 2,
  with the deferred walk `BoundaryCycleCount`), and the open-shell vertex condition
  `Law_OpenShellVertexLinkIsCycleOrPath(m, s, v)` (one link component: a cycle inside, a path on the
  boundary).
- **Repaired defects (open item 8, research open question 4).** Decided: Warning, decision 12.
  `Law_NoRedundantVertexLoop` split out of `Law_FaceBoundsShareNoVertex`, which keeps the
  unrepaired case as an Error; the use-count laws and `FreeEdgeCount` exempt degenerate edges
  (`CountsAsEdge`), so sphere C is no longer reported as an open shell; `IsRedundantVertexLoop`
  and `KeptBounds` give face meshing the reduction's rule 2 (review C6).
- **F2, F3, C3 (`FaceNormalSign`).** The stand-in `NormalAgreesWithParameterization` and its spec
  are deleted; layer 1 owns it (FIX-WAVE ownership table). `FaceNormalSign` keeps
  `sigma(SameSense) * epsilon`: layer 1 now states `N = epsilon <PartialU x PartialV>` on mirrored
  frames and on a plain spindle torus, and layer 3 folds the determinant into `SameSense`, so
  multiplying `PlacementHandedness` in here as well, which the fix-wave brief suggested, would count
  the mirror twice. New: `ParameterizationSignAt` and the library law
  `Law_ParameterizationSignIsConstantOnFace`, which test that premise on every face.
- **Layer 4's topology queries (FIX-WAVE ownership table, review C10, layer 8 finding 1).**
  Adopted with layer 4's signatures: `Opposite`, `CoedgeCount`, `CitesEdge`, `LoopUsesEdge`,
  `FaceUsesEdge`, the shell-free `FacesOfEdge(m, e)`, `SwappedEnds`, `WithUsesFlipped`,
  `WithEdgeReversed`; the bodies guard their lookups. `IsClosedEdge` and `IsDegenerateEdge` stay
  this layer's (review C4: layer 4 renames its own meaning `IsClosedRegularEdge`). New library laws
  `Law_EdgeReversalKeepsCoedgeSense` and `Law_EdgeReversalKeepsEdgeDomain`, the second being the
  assumption of layer 4's theorem `EdgeReversalInvariance`.
- **F4a, F4c, C1, T1 (edge domain and the `Closed` case).** A closed edge spans a period on a
  `Periodic` or `Closed` curve and is degenerate, `[a, a]`, on any other, so no range is unbounded
  and an arc across a closed B-spline's join is that arc. `TraversalDomain` gains the `Closed` arm;
  `IsOnPeriodicCurve` becomes `IsOnClosedCurve` (layer 0's `HasSeam`); `EdgeCurvePoint` wraps a
  parameter into a `Closed` curve's domain before evaluating; the spec's `EdgeDomain` contract and
  the theorem `EdgeDomainEndsFollowFromVertexOnCurve` (its exclusion now covers only `Closed`
  curves, by the closure gap) are restated. The stand-in `IsPeriodicDomain` is deleted; layer 0's
  `HasSeam` replaces it. `PeriodicRepresentativeAbove` is deleted in a later commit, once layer 0
  declared it with the same signature and meaning.
- **T8.** `Law_EdgeDomainIsForward` is judged by layer 1's `ParameterToleranceAt` at the range's
  start instead of the model-wide floor, so this layer no longer reads `Tolerances.Parameter`, which
  layer 0 split.
- **T9 (decided, not applied).** Edge and pcurve ranges are not stored at decode (open item 7).
- **F4b, M3, C5 (pcurves).** `PcurveEdgeDomain` is layer 1's `PcurveRangeOver` over the edge
  domain, one parameter period for a closed edge, and bounded always. New laws
  `Law_CurveAgreesWithPcurve` (the reverse point-set direction), `Law_PcurveRunsWithCurve` (tangent
  sense), `Law_PcurveSurfaceIsAFaceSurface` (Warning); measures `CurvePcurveDeviationAt`,
  `PcurveParameterDeviationAt`, `PcurveRunsWithCurveAt`; helpers `PcurveOfEdge`, `HasPcurve`,
  `EdgeParameterAt`, `CurveTangentAt`, `IsPcurveOnAdjacentFace`. Same parameterization is the
  deferred predicate `SharesCurveParameter`, not a law, since STEP does not promise it; it is the
  route choice review C5 asks layers 4 and 5 to share.
- **`CoordinateExtent(m)`, `ModelSize(m)` (FIX-WAVE layer 0 table, review F6, layer 8 finding 8).**
  Both over `ModelPoints`, the model's defining points; helpers `BoundingDiagonal`,
  `LargestAbsoluteCoordinate`, and `DefiningPoints` over curves and surfaces (`belongs-in:
  01-geometry`). Layer 3's `ModelSize(points)` computes the same diagonal over the decoder's points;
  it can call `BoundingDiagonal` or these two on the decoded model. Library law
  `Law_ModelSizeWithinExtent`.
- **Poly loops (open item 3).** Decided: the laws see poly loops directly.
  `Law_PolyLoopEdgesPairUp` over the deferred `PolyEdgeUseDefects` (implicit edges identified by
  coincidence, as `ReducedCounts` does), and `Law_PolyLoopHasThreePoints`.
- **Open items 5 and 9 (decided, no code).** Parameter-space loop simplicity and nesting are layer
  5's; shells that touch each other are legal.
- **Model transforms, part 1 (FIX-WAVE ownership table, layer 7 finding 1).** `RigidlyMoved(m,
  motion)` and `ScaledPoint(p, factor)` with bodies, the signatures layers 7 and 8 declared; the arena
  part `Moved(curve | surface, motion)`, `MovedFrame`, `MovedDirection`, `MovedVector` (marked
  `belongs-in: 01-geometry`), and `Moved(loop, motion)` for poly-loop points; library law
  `Law_RigidMotionKeepsCoedgeSense`.
- **Model transforms, part 2.** `ScaledBy(m, factor)` with a body through layer 1's
  `ScaledGeometry` (pcurves included), `ScaledTolerances` (`belongs-in: 00-foundation`) and
  `Scaled(loop)`; `RigidlyMoved` now builds its arena through `MovedGeometry` (`belongs-in:
  01-geometry`), so it follows `GeometrySet`'s new `Closures` field. Library law
  `Law_ScalingScalesExtent`.
- **Stand-in `PeriodicRepresentativeAbove` deleted.** Layer 0 committed it (`c09a121b`) with the
  same signature and meaning, after this layer's snapshot was taken; the gate's predicted snapshot
  carries it.
- **`Closed` directions in seam reasoning (FIX-WAVE layer 0 table).** Every match on
  `Periodicity` in this layer has the `Closed` arm (`TraversalDomain`); seam and wrap tests read
  layer 0's `HasSeam`; `IsPlainInParameters` unwraps every direction with a seam, so a band on a
  clamped closed B-spline surface is not taken for a plain face.

Skipped:

- **F12, the name of `Law_SeamUsesAreInOneFace`.** Its statement is kept and its comment now says
  what it adds to the shell law (every face, in a shell or not, and a seam whose edge has a third
  use elsewhere). The name is not changed: layer 7's `Check_SeamUsesAreInOneFace` and layer 8's
  theorem cite it, and a rename in this wave would be one FIX-WAVE.md does not predict. The name
  review should rename it `Law_SeamUsesRunOpposite` in all three layers at once.

## Name review, 2026-10-17

The name-and-dependency review after the fix wave (VOCABULARY.md revision 3) changed this layer as follows.

- `WithEveryFaceReversed`'s comment no longer names layer 8's copy, which the review deleted.
- Gave away its stand-ins: `ScaledTolerances` to layer 0; `DefiningPoints`, `MovedVector`, `MovedDirection`, `MovedFrame`, `Moved` (curve, surface), `MovedGeometry` to layer 1. `ModelPoints`, `RigidlyMoved` and `ScaledBy` call them there. The contracts of `RigidlyMoved`, `ScaledBy(m, factor)` and `WithEveryFaceReversed` moved here from layer 8's spec (new spec section "Model transforms").
- Renamed `Law_SeamUsesAreInOneFace` to `Law_SeamUsesRunOpposite` (F12 above, review finding on the name), with layer 7's check and layer 8's theorem text in the same commit.

## Implementation, chunk A

TKT-314, 2026-10-17. Ten bodies, each derived from its contract in `topology.spec.plato` and the
laws that name it. Every union-find goes through layer 0's `ClassRoots` and `ClassCount`
(`foundation.library.plato`, section "Equivalence classes"), written once there because layers 2
and 6 both need it; joins are found by testing every pair, quadratic where the deferred notes
planned one pass (the witnesses have at most 24 edges).

| Body | Derived from | Laws that read it |
|---|---|---|
| `IsDegenerateEdge` | contract `IsDegenerateEdge`: largest distance from the Start vertex to the curve over `EdgeDomain`; fast path of "Implementation notes" (ends more than twice the tolerance apart). Closed form for lines (an end) and circles (an end or the antipode of the vertex's polar angle); other curve cases sampled at 65 points, a lower bound, until chunks C and F give them the subdivision of the contract | `Law_DegenerateEdgeStaysAtStart`, `Law_DegenerateEdgeHasCoincidentVertices`, `Law_CoincidentEndsAreOneVertex`, `Law_EdgeHasPositiveExtent`, the use-count laws through `CountsAsEdge` |
| `LinkComponentCount` | contract: classes of the corners at `v` under `CornersShareEnd` | `Law_VertexLinkIsOneCycle`, `Law_OpenShellVertexLinkIsCycleOrPath` |
| `CornersAroundVertex` | contract: start at a corner with a free end, else the first; step to the first unvisited corner sharing an end | `FacesAroundVertex` |
| `ReducedCounts` | contract and research/VALIDATION-MATH.md 1.4: vertex classes across degenerate edges; edges less degenerate ones; vertex-like bounds (vertex loops, edge loops of degenerate edges only) dropped when their class lies on another bound or an earlier vertex-like bound; poly-loop points identified by coincidence, implicit edges one per unordered class pair | `Law_EulerPoincareEvenAndBounded`, `Law_OpenShellEulerEvenAndBounded`, layer 7's witness Euler laws |
| `BoundaryCycleCount` | contract: under its requirement (every link one cycle or one path) the free edges joined at shared vertex classes form disjoint cycles, so the classes are the cycles; the same for the implicit free edges over the poly-loop point classes, added (`IndexedBoundaryCycleCount`, `ImplicitBoundaryCycleCount`) | `Law_OpenShellEulerEvenAndBounded`; layer 7's `Law_PolyLoopSheetHasOneBoundaryCycle`, `Law_PolyLoopSheetPassesOpenShellEuler` |
| `PolyEdgeUseDefects` | contract: implicit edges keyed by unordered class pair, each use's direction from the loop order and the bound's `Orientation` | `Law_PolyLoopEdgesPairUp` |
| `ShellComponentCount` | contract: classes of the shell's faces under `FacesTouch` | `Law_ShellIsConnected` |
| `OrientationFlips` | contract: breadth-first two-colouring, parity 0 across an edge whose two uses (in two faces) run opposite | `Law_ShellIsOrientable` |
| `IsPlainInParameters` | contract: edge loops only, no seam, a bound; each bound sampled 9 points per coedge in its composed direction, projected, unwrapped by `NearestUnwrapped`, closing within `UvToleranceAt`; no vertex on a `DegenerateSides` side | `Law_LoopWindingMatchesSameSense` |
| `SignedParameterArea` | contract: shoelace over the lifted polygons | `Law_LoopWindingMatchesSameSense` |

One existing body changed: `ParameterizationSignAt` now also returns 0 when a partial is shorter
than the resolution at the surface's evaluation magnitude. At a sphere's pole `cos(-pi/2)` rounds
to -4.4e-8 in 32 bits and the sign was rounding noise, which made
`Law_ParameterizationSignIsConstantOnFace` false on `Witness_Sphere` at the two pole samples.

Settled at chunk A's close (F-52 item 4): a faceted shell's implicit edges count as boundary
edges. `ReducedCounts` already counts them as edges, so leaving them out of `BoundaryCycleCount`
made `Law_OpenShellEulerEvenAndBounded` false on every legal faceted open shell, such as the
planted sheet (shell 1) of layer 7's `Witness_BoxWithPolyLoopSheet` (chi 1, no indexed boundary).
The contract now bounds the result by `FreeEdgeCount` plus `ImplicitFreeEdgeCount`. Points and
vertices are never identified with each other, so the two kinds of cycle are counted apart.
`FreeEdgeCount` stays indexed only: a closed faceted shell's implicit free edges are
`Law_PolyLoopEdgesPairUp`'s to report, and counting them in `Law_DeclaredClosedIsClosed` too
would report one defect twice.

Law results, provisional (the C# writer fixes of TKT-315 had not landed; the run used a scratch
copy of Plato's HEAD compiler with conditionals parenthesized, see the report of TKT-314): every
layer 2 law, swept over every loop, face, shell, edge, vertex, coedge site, the two pcurve slots
and five sample fractions, holds on nine of the ten positive witnesses (7,813 evaluations).
`Witness_BSplinePatchSolid` throws in layer 1's deferred `BSplinePoint` (chunk F), 41 evaluations.
The negative witnesses fail exactly their named laws: `Witness_SphereWithRedundantPoleLoops(1)`
`Law_NoRedundantVertexLoop` at face 0 and `Law_VertexLoopVertexIsIsolated` at vertices 0 and 1;
`Witness_BoxWithFlippedFace` `Law_LoopWindingMatchesSameSense` at face 0;
`Witness_TwoBoxesSharingCorner` `Law_EulerPoincareEvenAndBounded` at shell 0 and
`Law_VertexLinkIsOneCycle` at vertex 6.

