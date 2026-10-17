# Validation mathematics

What can be checked about a B-rep and its mesh independently of the code that produced them, and how.
Written 2026-10-17 for the authors of `02-topology`, `06-mesh`, and `07-validation` (TKT-299, the STEP
B-rep to mesh design sandbox). Every identity below says when it holds and is worked on an example
with numbers. Every numeric example was checked during this research by a short script: brute-force
midpoint integration on a 1400 x 1400 grid for the area formulas, direct evaluation for the rest.
Section 8 collects every law in one table for the design authors to turn into `Law_` functions.

Formulas are written in plain text. `x` between vectors is the cross product, `.` the dot product,
`|a|` a length. Sources are numbered and listed at the end.

## 0. Notation

| Symbol | Meaning |
|---|---|
| `V, E, F` | vertices, edges, faces of a B-rep shell or a mesh |
| `L` | face bounds (loops) of all faces, outer and inner, edge loops and vertex loops alike |
| `R` | rings: bounds beyond the first in each face, `R = L - F` |
| `S` | shells; `G` the genus (number of handles, "through holes") summed over shells |
| `B` | boundary cycles of an open shell or open mesh |
| `chi` | Euler characteristic |
| `epsL` | the model's length tolerance, `Tolerances.Length.Value` (from STEP `uncertainty_measure_with_unit`) |
| `d`, `theta` | the meshing criteria: chordal deviation (a length) and angular deviation |
| `kappa` | a principal curvature; `kappa_max` its largest absolute value over a face |
| `sigma(u, v)` | a surface in its natural STEP parameters; `sigma_u`, `sigma_v` its partial derivatives |
| `h(u, v)` | the area element `|sigma_u x sigma_v|` |
| use, coedge | one `BrepEdgeUse` inside an `EdgeLoop`: an oriented citation of an edge |

## 1. Euler-Poincare for B-reps

### 1.1 The formula in its three published forms

For a solid whose boundary consists of `S` closed, connected, orientable shells of total genus `G`,
whose faces are open disks with holes:

```
Mantyla [5]:          V - E + F = 2 (S - G) + R
Braid et al. [6]:     V - E + F - R = 2 (S - G)        (rings as "holes in faces", G as "passages")
ISO 10303-42 [2]:     V - E + 2F - L - 2 (S - G) = 0   (manifold_solid_brep, IP10)
```

The three are the same equation, because `L = F + R`. The ISO form is the one to implement. It
counts loops without asking which loop is outer, and STEP makes `face_outer_bound` optional, so
"which loop is the ring" is often not stated in the file. For one open shell ISO gives
`(V - E - L + 2F) - (2 - 2H - B) = 0` (equation 7 of [1]), with `H` the shell's genus and `B` its
number of holes.

### 1.2 Derivation

Use the Euler characteristic with compact support, `chi_c`. It is additive over any finite partition
of a tame space into locally closed pieces, and it equals the ordinary `chi` on a compact space. The
values needed:

- a point: `chi_c = 1`
- an open arc (an edge without its end points, including a closed edge such as a full circle
  without its one vertex): `chi_c = -1`
- an open face with `L_f` bounds: a sphere (genus 0, since faces have no handles) with `L_f`
  disjoint closed disks or points removed, one per bound, edge loop or vertex loop. Removing a
  closed disk or a point subtracts 1, so `chi_c = 2 - L_f = 1 - r_f`, where `r_f = L_f - 1` counts
  the face's rings. A face bounded by one edge loop is an open disk (`chi_c = 1`); so is a sphere
  minus one point.

A closed shell is the disjoint union of its vertices, open edges, and open faces, so

```
chi(shell) = V - E + sum over faces (2 - L_f) = V - E + 2F - L = V - E + F - R
```

A closed, connected, orientable surface of genus `H` (the number of handles added to a sphere [4])
has `chi = 2 - 2H` (classification of surfaces). Summing over the `S` shells gives
`V - E + F - R = 2(S - G)`. QED.

The derivation shows exactly what the formula assumes, and therefore what the counting rule must
guarantee:

1. Every counted vertex is a point of the surface.
2. Every counted edge is an open arc: it has positive extent, and it meets no other cell. ISO
   requires this: "The extent of an edge_curve shall be finite and nonzero" [1].
3. Every face is a disk with holes. ISO: "A face domain shall not have handles" [1]. Each of its
   bounds removes a distinct boundary component or a distinct point.

### 1.3 Seams, vertex loops, and degenerate edges

**Seam edge** (an edge used twice by one face, as the cut that makes a periodic face a disk). It is
a genuine open arc. Counted once in `E`, it contributes -1, which is exactly what makes the
cylinder's side face a disk: the open band minus the seam is an open disk.

**Rings** are the inner bounds, edge loops that "float" in a face unconnected to its outer loop
[8]. Each one is a hole, and lowers the face's `chi_c` by 1.

**Vertex loop as a puncture.** A face bounded by a vertex loop at `p` excludes `p` from its interior.
The loop counts in `L`, and `p` counts in `V`. The derivation is satisfied: `p` is a point cell, and
the face lost that point.

**Vertex loop at a point already on another bound of the same face.** The vertex is already outside
the face interior, so this loop removes nothing. Counting it adds a phantom ring and subtracts 1
from `chi`. ISO forbids it: "Distinct face_bounds of the face shall have no common vertices" (face
IP2 of [1]; IP4 of `manifold_solid_brep` in [2]).

**Degenerate edge** (zero extent, typically at a pole or an apex). Its image is a point, the vertex
itself. It is not a 1-cell, and counting it subtracts a phantom 1. ISO forbids it (assumption 2
above). It still occurs: kernels insert such edges at poles internally (Open CASCADE calls them
"degenerated" edges), and a careless exporter writes them out. In parameter space it is a real side
of the face's domain, and section 5.3 depends on that. In 3D it is not an edge.

### 1.4 The counting rule

The validation layer computes `chi` per shell from **reduced counts**:

1. **Degenerate edges.** An edge is degenerate when every point of its curve over its domain lies
   within `epsL` of its start vertex. Contract every degenerate edge. When start and end are the
   same vertex, contraction deletes the edge. When they differ, it merges the two vertices into one,
   which leaves `chi` unchanged (`V - 1`, `E - 1`). Deleting such an edge without merging would be
   wrong. A loop whose uses then all disappear becomes a vertex loop on the one vertex they shared,
   because a chained loop of self-loop edges has one vertex.
2. **Redundant vertex loops.** Drop a vertex loop of face `f` whose vertex also lies on another bound
   of `f`, or duplicates another vertex loop of `f`.
3. **Poly loops** (faceted B-rep). Vertices are the loop points, identified across faces by
   instance identity, or else by coincidence within `epsL`. Edges are the unordered pairs of
   consecutive identified points.
4. Count per shell `s`: `V_s` = distinct vertices referenced by the remaining bounds (edge end
   points and vertex-loop vertices). `E_s` = distinct remaining edges, so a seam counts once.
   `F_s` = faces. `L_s` = remaining bounds.
5. `chi_s = V_s - E_s + 2 F_s - L_s`, which equals `V_s - E_s + F_s - R_s`.

**The law** (`Law_EulerPoincare`). For a shell declared closed, `chi_s` is even and at most 2. The
shell genus is then `G_s = (2 - chi_s) / 2`. For an open shell with `B_s` boundary cycles,
`chi_s + B_s` is even and at most 2. Nothing in an arbitrary file states the genus, so the law can
only check parity and the bound (this is ISO's condition 9 [1]). The full equality is checked two
other ways: against the known genus of a witness (`Law_EulerPoincareMatchesGenus`), and against the
mesh (section 4.4). Check per shell, never only for the whole model: an error of +1 in one shell and
-1 in another cancels in the total.

A defect that the reduction repaired is still reported, by `Law_EdgeHasPositiveExtent` and
`Law_FaceBoundsShareNoVertex`, at the severity of the structural group (Error). The reduction makes
`chi` meaningful despite the defect; it does not excuse it.

### 1.5 Worked examples

Raw counts first, then reduced counts where the rule changes them. Every row satisfies
`chi = 2(S - G)` after reduction.

| Model | V | E | F | L | R | S | G | chi = V-E+F-R |
|---|---|---|---|---|---|---|---|---|
| Box | 8 | 12 | 6 | 6 | 0 | 1 | 0 | 2 |
| Cylinder: two circles, one seam | 2 | 3 | 3 | 3 | 0 | 1 | 0 | 2 |
| Cylinder: two circles, no seam (side face is a band with two loops) | 2 | 2 | 3 | 4 | 1 | 1 | 0 | 2 |
| Sphere A: one seam from pole to pole, loop `[seam+, seam-]` | 2 | 1 | 1 | 1 | 0 | 1 | 0 | 2 |
| Sphere B: as A plus vertex loops at both poles, raw | 2 | 1 | 1 | 3 | 2 | 1 | | **0** (wrong) |
| Sphere B reduced (both vertex loops share a vertex with the seam loop) | 2 | 1 | 1 | 1 | 0 | 1 | 0 | 2 |
| Sphere C: loop `[seam+, degN, seam-, degS]` with degenerate pole edges, raw | 2 | 3 | 1 | 1 | 0 | 1 | | **0** (wrong) |
| Sphere C reduced (both degenerate self-loops deleted) | 2 | 1 | 1 | 1 | 0 | 1 | 0 | 2 |
| Sphere D: no seam, vertex loops at both poles (face = open annulus) | 2 | 0 | 1 | 2 | 1 | 1 | 0 | 2 |
| Sphere E: one vertex loop (face = sphere minus a point) | 1 | 0 | 1 | 1 | 0 | 1 | 0 | 2 |
| Torus: two seams crossing at one vertex, loop `[a+, b+, a-, b-]` | 1 | 2 | 1 | 1 | 0 | 1 | 1 | 0 |
| Cone: base circle, seam from base to apex vertex | 2 | 2 | 2 | 2 | 0 | 1 | 0 | 2 |
| Cone with a degenerate edge at the apex, raw | 2 | 3 | 2 | 2 | 0 | 1 | | **1** (wrong, odd) |
| Cone with a degenerate apex edge, reduced | 2 | 2 | 2 | 2 | 0 | 1 | 0 | 2 |
| Cone: no seam, apex as a vertex loop on the side face | 2 | 1 | 2 | 3 | 1 | 1 | 0 | 2 |
| Cone: no seam, no apex vertex (side face is a disk containing the apex) | 1 | 1 | 2 | 2 | 0 | 1 | 0 | 2 |
| Block with a square through hole | 16 | 24 | 10 | 12 | 2 | 1 | 1 | 0 |
| Block with a round through hole (hole wall has one seam) | 10 | 15 | 7 | 9 | 2 | 1 | 1 | 0 |
| Hollow box (outer shell plus one void shell) | 16 | 24 | 12 | 12 | 0 | 2 | 0 | 4 (2 per shell) |

Notes on the less obvious rows:

- **Cylinder.** Vertices `P0` on the bottom circle and `P1` on the top, both at `u = 0`. Edges: the
  bottom circle `P0 -> P0`, the top circle `P1 -> P1`, the seam `P0 -> P1`. The side face's one loop
  is `[bottom, seam, top reversed, seam reversed]`.
- **Sphere A** is the form a careful exporter writes. The seam is a meridian half-circle from `S` to
  `N`. The loop `[seam+, seam-]` chains (`S -> N -> S`) without any pole edge.
- **Torus.** Edge `a` is the meridian at `u = 0` and edge `b` the parallel at `v = 0`, both closed
  edges on the one vertex where they cross. The loop is the boundary of the square `[0, 2pi]^2`.
- **Block with a square hole.** The top and bottom faces each carry the hole's ring as an inner
  loop, so `R = 2`. These counts match Shene's worked example [7].

### 1.6 What the formula cannot see

It is necessary, not sufficient. A box with an extra rectangular sheet glued along one edge has
`V = 10, E = 15, F = 7, L = 7` and satisfies the formula, yet one edge has three uses [7]; the edge
condition of section 2 catches it. Two L-shaped blocks, stacked so that they touch at exactly two
corner points, form a ring with `V = 22, E = 36, F = 16`, so `chi = 2`. The formula reads that as a
sphere, though both touching vertices are non-manifold; only the vertex condition catches it.

ISO also states a face equation, `V - E - L + sum of loop genera = 0` with oriented edges counted
(equation 5 of [1]), and a loop equation, `(V - E_l) - (1 - G_l) = 0` (equation 4). Given chained
loops whose bounds share no vertices, both are identities: the loop genus is defined by the count it
is checked against. They add nothing beyond `Law_LoopsChainEndToStart` and
`Law_FaceBoundsShareNoVertex`, so no separate laws are proposed for them.

## 2. Manifold and orientability criteria

### 2.1 Edge condition

In a shell declared closed, every edge has exactly two uses among the shell's edge loops. In an open
shell, every edge has one use (a boundary edge) or two. ISO puts it as "Each edge in the shell is
either used by exactly two face bounds or is used twice by one face bound" [1]. Count uses
(coedges), not faces: a seam edge of a cylinder's side face has its two uses in one loop of one
face. Locally, a point inside the seam has a neighbourhood made of two half-disks of the same face,
glued along the seam. That is a disk, so the seam satisfies the edge condition for the same reason
an edge between two faces does.

### 2.2 Vertex condition

The edge condition does not exclude two sheets touching at a point. Example: two cones touching apex
to apex, or two boxes sharing one corner. Every edge still has two uses. The vertex condition is
that the faces around each vertex form one cycle, so that a small sphere around the vertex meets the
shell in a single circle (its *link*).

The corner graph at vertex `v` makes this checkable over the vocabulary. Its nodes are the ends at
`v` of the counted edges: a pair `(edge, Start)` or `(edge, End)`, so a closed edge on `v`
contributes two nodes. Its links are the corners: for each pair of consecutive uses in an edge loop
where the first ends at `v`, join the end node of the first edge to the start node of the second.
In a closed shell, every node has degree 2. The vertex is manifold exactly when the corner graph is
one connected cycle; in an open shell, one cycle or one path. A vertex-loop vertex has no corners:
the face surrounds it, so the condition is that no other bound in the shell references that vertex
(`Law_VertexLoopVertexIsIsolated`).

Worked examples:

- **Cylinder**, vertex `P0`. The nodes are `bottom.Start`, `bottom.End`, and `seam.Start`. The
  bottom face (loop `[bottom reversed]`) joins `bottom.Start` to `bottom.End`. The side face's loop
  joins `bottom.End` to `seam.Start` and `seam.Start` to `bottom.Start`. The graph is one triangle,
  so the vertex is manifold.
- **Sphere A** at `N`. The one corner joins `seam.End` to `seam.End`: one cycle of length 1. Manifold.
- **Two cones, apex to apex.** The corner graph at the shared apex has two disjoint cycles, one per
  cone. Not manifold. With one declared shell, the reduced counts are `V = 3, E = 4, F = 4, R = 0`,
  so `chi = 3`. The odd value also fails Euler-Poincare.
- **Two boxes sharing one corner** (one shell): two cycles at the corner, and
  `V = 15, E = 24, F = 12`, so `chi = 3`.
- **Two L-blocks touching at two corners** (section 1.6): two cycles at each touching vertex, while
  `chi = 2` passes. This is the case only the vertex condition catches.

### 2.3 Orientability

The **effective direction** of a use is +1 when the face walks the edge from `Start` to `End`, and
-1 otherwise:

```
EffectiveDirection(use, bound) = (use.Orientation == Forward) == bound.Orientation ? +1 : -1
```

A face's loops run counter-clockwise about the face's topological normal, so the boundary of the
face induces a direction on each of its edges. The **orientation condition** is that the two uses
of every edge have opposite effective directions. For a seam, both uses lie in the same face, and
the condition still holds.

**Why this gives a consistent orientation.** Two faces that share an edge and induce opposite
directions on it have normals that agree across the edge: this is the definition of a coherent
orientation of a cell complex. If every edge satisfies the condition and every vertex is manifold,
the face normals agree on every overlap, which is an orientation of the whole surface.
Connectedness adds uniqueness. A connected orientable surface has exactly two orientations, so once
every edge is coherent, deciding outward for one face decides it for all. That is why one global
test per shell suffices (section 3.5).

**Detecting the inconsistent case.** Assign each face an unknown sign `s_f` in {+1, -1}. Each edge
with uses of directions `d1` in face `f` and `d2` in face `g` requires `s_f d1 + s_g d2 = 0`. Run a
breadth-first search over the faces with parity labels:

- No conflict and every `s_f = +1`: the shell is consistently oriented.
- No conflict but some `s_f = -1`: the shell is orientable and those faces are flipped. The
  diagnostic names them, which also tells a reader how to repair the file.
- A conflict: the shell is not orientable. The dual graph has a cycle with an odd number of
  same-direction edges.

Example: three quadrilateral faces in a strip, closed into a ring with a half twist (a Mobius
strip). Fix `s_1 = +1`. Edge `e12` forces `s_2`, edge `e23` forces `s_3`, and then edge `e31`
demands the opposite of `s_3`. For a seam with both uses in the same direction, the constraint is a
self-loop, `s_f (d1 + d2) = 0`, which no sign satisfies. Such a face is glued to itself with a twist
and can never be repaired by a flag. A closed non-orientable shell cannot be embedded in space
without self-intersection, so in a closed shell a conflict means wrong flags or a self-intersecting
model.

**Decoder obligation.** VOCABULARY.md gives `BrepShell` no per-face orientation and
`SolidWithVoids` no void orientation. STEP has both: `oriented_face`, `oriented_closed_shell`, and
void shells, which must have orientation FALSE so that their normals point into the void [2]. The
laws above assume `03-step` folds these in when it decodes. Reversing a face means flipping every
`FaceBound.Orientation` of the face and flipping its `SameSense`. A void shell is stored with every
face reversed.

### 2.4 The laws over the vocabulary

Proposed helpers for `02-topology`: `CoedgeAt { Face: BrepFaceIndex; Bound: Integer; Use: Integer }`,
`UseCount(m, s, e)`, `EffectiveDirection(m, c: CoedgeAt): Integer`, `CornerCycleCount(m, s, v)`,
`ReducedCellCounts(m, s): CellCounts`, and `CellCounts { V; E; F; L: Integer }`.

```plato
// Every edge of a shell declared closed has zero uses (not in the shell) or exactly two.
Law_EdgeUsedTwiceInClosedShell(m: BrepModel, s: ShellIndex, e: BrepEdgeIndex): Boolean
    => m.IsShellInRange(s) ? (m.IsEdgeInRange(e)
        ? (m.Shells[s.Value].DeclaredClosed ? (m.UseCount(s, e) == 0 || m.UseCount(s, e) == 2) : true)
        : true) : true;

// In an open shell no edge has more than two uses.
Law_EdgeUsedAtMostTwiceInOpenShell(m: BrepModel, s: ShellIndex, e: BrepEdgeIndex): Boolean;

// The two uses of an edge in a shell run in opposite effective directions.
Law_EdgeUsesRunOpposite(m: BrepModel, s: ShellIndex, e: BrepEdgeIndex): Boolean;   // sum of directions == 0

// Some assignment of face signs makes every edge's uses opposite (no odd cycle).
Law_ShellOrientable(m: BrepModel, s: ShellIndex): Boolean;

// The corner graph at a vertex is one cycle (closed shell) or one cycle or path (open shell).
Law_VertexLinkIsSingleCycle(m: BrepModel, s: ShellIndex, v: BrepVertexIndex): Boolean;

// A vertex-loop vertex is referenced by no other bound in the shell.
Law_VertexLoopVertexIsIsolated(m: BrepModel, s: ShellIndex, l: BrepLoopIndex): Boolean;

// The faces of a shell form one component when faces sharing an edge are joined.
Law_ShellIsConnected(m: BrepModel, s: ShellIndex): Boolean;

// Reduced chi of a closed shell is even and at most 2 (section 1.4).
Law_EulerPoincare(m: BrepModel, s: ShellIndex): Boolean;
```

`VOCABULARY.md` fixes the name `Law_EveryEdgeUsedTwiceWithOppositeOrientation`. That law states two
things, and `SPEC-DSL.md` requires one statement per law, so the topology author should record a
split into `Law_EdgeUsedTwiceInClosedShell` and `Law_EdgeUsesRunOpposite` under "Changes to this
contract".

## 3. Geometry-to-topology coupling

### 3.1 Vertices at curve ends

For edge `e` with curve `c` and domain `[t0, t1]` (with `t0 < t1`):

```
|P(Start) - c(SameSense ? t0 : t1)| <= epsL   and   |P(End) - c(SameSense ? t1 : t0)| <= epsL
```

STEP's `edge_curve` gives no parameters; the domain comes from inverse evaluation of the vertex
points on the curve. For a periodic curve, the representative is chosen so that
`0 < t1 - t0 <= period`. A closed edge (`Start == End`) then gets a full period, never zero.
`Law_EdgeDomainWithinPeriod` states this. A `trimmed_curve` with point trims must agree with the
vertex points under the same law.

### 3.2 An edge's curve lies on its faces' surfaces

**Sampled check.** At sample `t` in the domain, set `p = c(t)` and `uv = Project(surface, p)`, then
require `|sigma(uv) - p| <= epsL`. The check is pointwise, so `Law_EdgeLiesOnAdjacentSurfaces` takes
`t`, and the `Check_` samples it. Two caveats:

1. Sampling yields a lower bound on the true worst deviation. A failed sample proves the law false;
   a passing sample set proves nothing between the samples. Sample at least at the edge
   discretization's points and the midpoints between them.
2. Inverse evaluation can converge to the wrong branch. A result within `epsL` is sound, since any
   surface point that close proves the claim, but a failure may be the projection's fault. Seed
   Newton's method from the pcurve when there is one, and report a projection failure apart from a
   distance failure.

**Exact incidence predicates** are preferable for analytic pairs, which are most edges in
mechanical and building models. They take O(1) time and involve no sampling. Each angular condition
is scaled by a length, so that it compares against `epsL`:

| Curve on surface | Conditions (`n` normal, `a` axis direction, `c` centre, `r` circle radius, `l` edge length) |
|---|---|
| line on plane | `|n.(o - C)| <= epsL` and `l |n.dir| <= epsL` |
| circle on plane | `|n.(c - C)| <= epsL` and `r |n x n_circle| <= epsL` |
| line on cylinder | `l |a x dir| <= epsL` and `|dist(o, axis) - R| <= epsL` |
| circle on cylinder (only parallels exist) | `r |a x n_circle| <= epsL`, `dist(c, axis) <= epsL`, `|r - R| <= epsL` |
| circle on sphere | `|(c - C) x n_circle| <= epsL` and `| |c - C|^2 + r^2 - R^2 | <= 2 R epsL` |
| circle on cone or torus (parallels) | normal parallel to the axis, centre on the axis, `r` equal to the surface radius at the centre's height |

A seam edge needs the predicate only once, since both of its uses lie on the same surface.

### 3.3 A pcurve agrees with its 3D curve

A pcurve `q(s)` on surface `sigma` and the 3D curve `c(t)` describe the same arc, but their
parameterizations need not correspond: STEP has no same-parameter flag. Compare them as point sets,
in both directions, and add two conditions that point sets alone cannot express:

```
for every s:  dist(sigma(q(s)), image of c) <= epsL        (Law_PcurveAgreesWithCurve)
for every t:  dist(c(t), image of sigma o q) <= epsL       (Law_CurveAgreesWithPcurve)
end points:   sigma(q(s_start)), sigma(q(s_end)) are the edge's vertex points within epsL
direction:    the tangents of sigma o q and of c agree in sign at matched points  (Law_PcurveDirectionAgrees)
```

Both distance computations are one-dimensional projections, onto `c` or onto the space curve
`sigma o q`, so they are robust where surface projection is not. Without the direction condition, a
pcurve stored backwards would pass.

### 3.4 Loops in parameter space

Map each loop into the face's parameter plane, unwrapping across periods. Seam uses then lie on the
two sides `u = u0` and `u = u0 + period`. Then three laws apply:

- **Simple** (`Law_LoopSimpleInParameterSpace`). Non-adjacent segments of a loop polygon are
  separated by at least the parameter tolerance. This is a sweep in O(n log n), or a direct test of
  all pairs in O(n^2).
- **Nested correctly** (`Law_InnerBoundInsideOuter`). Every inner loop lies inside the outer loop,
  and no inner loop lies inside another. An island inside a hole is a separate face. Test one point
  of each inner loop, plus the absence of crossings between loops ("distinct loops of the same
  face shall not intersect", face IP3 of [1]). When the file
  marks no outer bound, the outer loop is the one whose region contains the others. A periodic band
  (a cylinder face between two circles) has no outer loop in the plane; its region lies between its
  loops.
- **Winding matches the face sense** (`Law_FaceWindingMatchesSameSense`). Let `A_uv` be the signed
  area of the region, `(1/2) * sum over all bounds of closed integral (u dv - v du)`, with each bound
  in its stated orientation. Then `A_uv > 0` when `SameSense` is true and `A_uv < 0` when it is
  false.

Proof of the winding law. Loops run counter-clockwise about the face's topological normal
`n_T = (SameSense ? +1 : -1) N` (definitions of `face_bound` and `face_surface` [1]). Section 5.1
shows that for every elementary surface, `sigma_u x sigma_v = h N` with `h > 0`, where `N` is the
normal ISO defines [3]. The map from parameters to the surface therefore preserves orientation with
respect to `N`, and counter-clockwise about `+N` means positive area in the parameter plane. Example:
the bottom face of a box at `z = 0` on a plane whose axis is `+z`. The outward normal is `-z`, so
`SameSense` must be false and the outer loop must run clockwise in `(u, v)`, for example
`(0,0) -> (0,1) -> (1,1) -> (1,0)`, signed area -1. This law catches the "one face flipped" defect
directly from the B-rep, before any meshing. The same sign test on the `UvRegion` that
`05-face-meshing` builds, after it has normalized the loops to counter-clockwise outer and clockwise
holes, is `Law_UvRegionWindingPositive`: it catches a region assembled with a loop reversed.

### 3.5 Normals point out of the solid

Which side of a face is "out" is not a local property. Near a face, both sides look alike. The
outside is the unbounded component of the complement of the whole shell (Jordan-Brouwer
separation). The local laws of section 2.3 make the faces of a connected shell agree with each other.
They cannot choose between the two orientations; only a global test can. There are two:

1. **Signed volume.** By the divergence theorem, the signed volume enclosed by a closed, coherently
   oriented, non-self-intersecting surface is `+vol` when the normals point out and `-vol` when they
   point in. Compute it over the exact faces (`Oracle_DivergenceVolume`, section 5.6) or over the
   mesh (section 4.7). The outer shell must give a positive value, and every void shell a negative
   one, since its normals point into the void and so away from the material. The test assumes the
   surface does not intersect itself. The B-rep satisfies that by ISO's informal propositions; a mesh
   satisfies it when `d` is below half the thinnest wall.
2. **Ray parity.** Take a point `Q` outside the bounding box and the centroid `T` of one element or
   face sample, and count crossings of the segment `QT` with the rest of the shell. An even count
   means the region just before `T` is outside, so the outward normal at `T` must satisfy
   `n . (Q - T) > 0`; an odd count means the opposite. When the ray passes within tolerance of an
   edge or a vertex, pick another `Q`. One test per connected shell suffices (section 2.3). CGAL
   offers the same predicate for closed meshes as `is_outward_oriented` [11].

The signed volume is cheaper and needs no special cases, so it is the primary test. Ray parity is
the independent second opinion, and it also works on a B-rep that cannot yet be meshed.

## 4. Mesh checks

### 4.1 The edge table and the combinatorial laws

For every element, list its directed sides: `(a,b), (b,c), (c,a)` for a triangle, and four sides
for a quad. Key each side by `(min, max)`. Record a count, and a direction sum that adds +1 when the
side runs from min to max and -1 otherwise. Build the table by sorting or hashing, in
O(F log F) time. This is `MeshEdgeTable` in `06-mesh`. Then:

| Property | Law | Holds when |
|---|---|---|
| manifold edges | `Law_MeshEdgeAtMostTwoElements` | `Count <= 2` for every entry |
| closed | `Law_MeshEdgeExactlyTwoElements` | `Count == 2` for every entry of a closed shell's component |
| consistently oriented | `Law_MeshEdgeOppositeTraversal` | `DirectionSum == 0` wherever `Count == 2` |
| manifold vertices | `Law_MeshVertexLinkIsSingleCycle` | the link at `v` (for each element at `v`, join its two neighbours of `v`) is one cycle, or one path on a boundary |

The edge test misses pinched vertices in a mesh, just as it does in the B-rep, so the link test is
needed as well.

### 4.2 Duplicate vertices and degenerate elements

- **No coincident vertices** (`Law_MeshNoCoincidentVertices`). No two distinct vertex indices of one
  shell's component lie within `epsL` of each other. Find candidate pairs with a spatial hash of cell
  size `epsL`, checking the 27 neighbouring cells. With one discretization per edge, a correct mesh
  has no legitimate coincidences inside a shell. A violation means a crack that the eye cannot see:
  geometrically closed, combinatorially open.
- **No degenerate element** (`Law_MeshElementNotDegenerate`). An element is degenerate when its
  smallest altitude is at most `epsL`, where the altitude is `2 * area / longest side` for a
  triangle. One test covers both a collapsed element (all sides short) and a needle (collinear
  corners). A quad is degenerate if either diagonal split yields a degenerate triangle.
- **Attributes at seams and sharp edges.** `ModelMesh` in VOCABULARY.md carries one normal and one
  `uv` per vertex. A vertex on a seam has two `uv` values, and a vertex on a sharp edge has one
  normal per adjacent face. Splitting such vertices would break both laws above and the closedness
  test. Corner attributes, or a separate attribute index, keep the topology index welded. This is
  open question 1 at the end.

### 4.3 Euler characteristic, components, genus

Find connected components with a union-find over element-vertex incidence. Per component:
`chi = V - E + T + Q`, where triangles and quads both count as faces and `E` counts distinct
undirected edges. For a closed orientable component, the genus is `g = (2 - chi) / 2`, which must be
a non-negative integer. With `B` boundary cycles (traced from the `Count == 1` edges),
`chi = 2 - 2g - B`.

### 4.4 The identity between mesh and B-rep

```
Law_MeshEulerMatchesBrep:  for every shell s,  chi(mesh component of s) == chi_s (reduced counts, section 1.4)
Law_MeshComponentPerShell: as many mesh components as shells, and no component mixes two shells
```

Why it holds for a correct mesh: the mesh refines the reduced cell decomposition. Each counted
vertex becomes one mesh vertex. Each counted edge, cut into `k` segments, gives `k` mesh edges and
`k - 1` interior vertices: net -1, as the edge alone contributes. Each open face with `r` holes is
triangulated, and the triangulation's interior vertices, interior edges, and elements have
`chi_c = 1 - r`, as the face does. So the sums agree, term by term.

A companion geometric law needs no counting. Every mesh vertex carries a provenance (`OnVertex`,
`OnEdge` with a parameter, `OnFace` with a `uv`), so re-evaluating the model there must reproduce its
position within `epsL` (`Law_MeshVertexOnProvenance`). It is the cheapest strong check in this
document: one evaluation per vertex, no sampling, no projection.

What `Law_MeshEulerMatchesBrep` catches:

- a fan of separate coincident vertices at a pole instead of one pole vertex
- a mesh edge emitted for a degenerate edge
- a face meshed from a reversed or missing loop
- two faces that discretized a shared edge differently (a crack, which also fails closedness)

### 4.5 Discrete Gauss-Bonnet

**Statement.** Let `M` be a closed triangle mesh: every edge belongs to exactly two triangles, and
no triangle is degenerate. Define the angle defect at vertex `i` as
`delta_i = 2 pi - (sum of the corner angles at i)`. Then

```
sum over vertices of delta_i = 2 pi chi(M)
```

This is Descartes' theorem on the total angular defect, generalized to any Euler characteristic, and
a special case of Gauss-Bonnet [15].

**Proof.** Summing the defects gives `2 pi V - (sum of all corner angles) = 2 pi V - pi T`, because
the angles of each flat triangle sum to `pi`. Closedness gives `3T = 2E`, so `T = 2(E - T)`. Hence
`2 pi V - pi T = 2 pi (V - E + T)`. QED.

**What it checks.** The proof uses only two facts: the angles of each triangle sum to `pi`, and
`3T = 2E`. The identity therefore holds for any vertex positions whatever. It cannot detect wrong
geometry, wrong `chi` relative to the model, or non-manifold vertices (it uses only edge
closedness). An unreferenced vertex adds `2 pi` to the sum and 1 to `V`, so it slips through as
well. What it does check:

- the per-triangle angle sums: a triangle with a zero-length side produces NaN, or angles that do not
  sum to `pi`
- the consistency between the element list and the counts used for `chi`
- the arithmetic of two independently written code paths

Its value is as a cross-check. The independent comparison is the one in section 4.4: the defect sum
against `2 pi chi_s`, where `chi_s` comes from B-rep counts (the useful reading of
`Oracle_AngleDefectSum`). Compute angles as `atan2(|e1 x e2|, e1 . e2)`, never with `acos`, which is
ill-conditioned near 0 and `pi`.

Example: an icosahedron inscribed in the unit sphere. Five triangles meet at each of 12 vertices,
each angle `pi/3`, so every defect is `pi/3` and the sum is `4 pi = 2 pi * 2`. Computed:
12.566370614359176.

**Mixed triangle and quad meshes.** For a quad with corner angles in `[0, pi]`, let its angle sum be
`A_q` and its defect `D_q = 2 pi - A_q`. Closedness gives `2E = 3T + 4Q`, so
`chi = V - T/2 - Q`, and

```
sum of delta_i  =  2 pi chi  +  sum over quads of D_q
```

Lemma: `D_q >= 0`, with equality exactly when the quad is planar and convex. Proof: split `abcd`
along `ac`. At `a`, the angle between rays `ab` and `ad` is at most the sum of the angles through
`ac` (the triangle inequality for angles), and likewise at `c`. So `A_q` is at most the angle sum of
the two triangles, `2 pi`. Equality forces `ac` to lie in the plane of `ab` and `ad` and between
them, and the same at `c`: the quad is planar, and the diagonal is interior at both ends, which
means convex. A planar non-convex quad measured with unsigned angles also falls short of `2 pi`.

In a mixed mesh, then, the identity measures total quad non-planarity and non-convexity. Per quad,
`D_q` is the quality metric (`Law_QuadAngleDefectWithinTolerance`, Info). Computed examples: the
skew quad `(0,0,0) (1,0,0) (1,1,0.3) (0,1,0)` has `A_q = 6.2005`, so `D_q = 0.083` rad, about 4.7
degrees. The planar dart `(0,0,0) (2,0,0) (0.5,0.5,0) (0,2,0)` has `D_q = 1.855` rad.

### 4.6 Vector area

For a closed, consistently oriented triangle mesh, `sum over triangles of (1/2)(b - a) x (c - a) = 0`
exactly in exact arithmetic. Each triangle contributes `(1/2)(a x b + b x c + c x a)`, and the twin
sides `a -> b` and `b -> a` cancel. Like Gauss-Bonnet, this is combinatorial. In floating point it
is a cheap arithmetic check of closedness and orientation (`Law_VectorAreaVanishes`, tolerance of
order `epsL * total area / typical side`), and it is the reason the signed volume below does not
depend on the origin.

### 4.7 Divergence-theorem volume

Apply the divergence theorem with the field `x/3`, whose divergence is 1:
`vol = (1/3) * closed surface integral of (x . n) dA`. On a flat triangle, `x . n` is constant, so

```
SignedVolume = (1/6) * sum over triangles (a, b, c) of  (a - O) . ((b - O) x (c - O))
```

Each term is the signed volume of the tetrahedron `(O, a, b, c)`. The sign convention: `(a, b, c)`
runs counter-clockwise seen from the side that `(b - a) x (c - a)` points to. For a closed mesh, the
sum does not depend on `O` (section 4.6) [10].

- **Orientation proof.** Given closed (4.1), coherent (4.1), and not self-intersecting, an outer
  shell's mesh must have `SignedVolume > 0` and a void shell's mesh `SignedVolume < 0`. The solid's
  volume is their sum. Hollow box with a 2 x 2 x 2 outer and a 1 x 1 x 1 void: `+8 - 1 = 7`.
- **Quads.** The two diagonal splits of a non-planar quad give different volumes. The difference is
  the volume of the tetrahedron `abcd`. The exact flux through the bilinear patch equals the average
  of the two splits. This was checked, not proved: on 1000 random quads, with a Gauss rule that is
  exact for the polynomial integrand, the largest relative difference was 6e-15. Example: flux
  0.143597116868, average of splits 0.143597116868, split difference 0.0734426, equal to the
  tetrahedron's volume. Use the average.
- **Origin.** The relative rounding error grows like `machine epsilon * (|p - O| / feature size)^2`.
  A building in millimetres can sit 10^6 units from the origin, with features of 10^2. That is a
  factor of 10^8: harmless in 64-bit arithmetic, fatal in 32-bit (README, "Number precision"). Take
  `O` at a vertex of the shell or at the centre of its bounding box.

### 4.8 Area

`Area = sum of |(b - a) x (c - a)| / 2` over triangles, plus the quad areas, with each quad split
the same way as for volume. Compare per face, using `ElementFace`, not only in total. A per-face
comparison localizes the error, and a total can hide compensating errors.

## 5. Oracles for analytic faces

### 5.1 Area elements in STEP's natural parameters

The parameterizations are those of ISO 10303-42 [3]. `x, y, z` is the placement frame, and
`e_r(u) = cos u x + sin u y`, `e_u(u) = -sin u x + cos u y`. Angles are in radians. STEP permits
degrees ("Numerical values for such angular parameters shall use the current units for
plane_angle_measure" [3]). The geometry layer converts on decode; if it did not, every `h` below
would gain a factor of `pi/180` per angular parameter.

| Surface | `sigma(u, v)` | `sigma_u x sigma_v` | `h = |sigma_u x sigma_v|` |
|---|---|---|---|
| plane | `C + u x + v y` | `z` | `1` |
| cylinder | `C + R e_r + v z` | `R e_r` | `R` |
| cone | `C + (R + v tan a) e_r + v z` | `rho (e_r - tan a z)`, with `rho = R + v tan a` | `|R + v tan a| / cos a` |
| sphere | `C + R cos v e_r + R sin v z` | `R^2 cos v (cos v e_r + sin v z)` | `R^2 cos v` |
| torus | `C + (R + r cos v) e_r + r sin v z` | `r (R + r cos v) (cos v e_r + sin v z)` | `r (R + r cos v)` |
| revolution of `lambda(v)` about the unit axis `V` through `C` | Rodrigues rotation of `lambda(v) - C` by `u` | `Rot_u( (V x (lambda - C)) x lambda' )` | `|(V x (lambda(v) - C)) x lambda'(v)|` |
| linear extrusion of `lambda(u)` along the vector `V` | `lambda(u) + v V` | `lambda'(u) x V` | `|lambda'(u) x V|` |

Derivations, for the rows that are not immediate:

- **Cone.** `sigma_u = rho e_u` and `sigma_v = tan a e_r + z`. Since `e_u x e_r = -z` and
  `e_u x z = e_r`, the cross product is `rho (e_r - tan a z)`, with length
  `|rho| sqrt(1 + tan^2 a) = |rho| / cos a`. Its direction matches ISO's cone normal for `rho > 0`
  [3]. Check: the frustum from `v = 0` to `v = H` has area
  `2 pi (R H + H^2 tan a / 2) / cos a = pi (r1 + r2) s`, the textbook frustum area, with slant height
  `s = H / cos a`.
- **Sphere and torus.** The cross product is a positive multiple of ISO's normal
  `cos v e_r + sin v z` [3]. For the torus, `h > 0` needs `R > r`. A spindle torus (`R <= r`,
  `degenerate_toroidal_surface`) changes the sign of `h`, so the oracle must integrate `|h|`, split
  where `R + r cos v = 0`.
- **Revolution.** Write `q = lambda(v) - C`. Then `sigma_u = Rot_u(V x q)` and
  `sigma_v = Rot_u(lambda')`, and rotation preserves cross products and lengths, so `h` does not
  depend on `u`. When the profile lies in a plane through the axis (the usual case), `V x q` is
  perpendicular to that plane and `h = rho(v) |lambda'(v)|`, the distance from the axis times the
  profile speed. For a space-curve profile, the general formula is needed.
- **Extrusion.** STEP's `extrusion_axis` is a vector with magnitude, and `v` multiplies it. When the
  profile lies in a plane perpendicular to `V`, `h = |lambda'(u)| |V|`.

In every elementary case `sigma_u x sigma_v = +h N`. This is the fact the winding law of section 3.4
rests on (`Law_SurfaceNormalIsCrossProductDirection` makes it a library test), and it is checked
against the evaluator's derivatives by `Law_AreaElementMatchesCrossProduct`.

### 5.2 Green's theorem turns the area into a boundary integral

The area of a face is `A = double integral over D of h(u, v) du dv`, where `D` is the face's region
in parameter space and `partial D` is positively oriented: outer loop counter-clockwise, holes
clockwise. Green's theorem says
`double integral over D of (dQ/du - dP/dv) = closed integral over partial D of (P du + Q dv)`. Every
density above depends on one parameter only, so choose:

```
h = h(v):  P = -G(v), Q = 0,  where G' = h   =>   A = - closed integral of G(v) du
h = h(u):  P = 0, Q = H(u),   where H' = h   =>   A =   closed integral of H(u) dv
```

Over a straight polygon edge from `(u0, v0)` to `(u1, v1)`, let `du = u1 - u0`, `dv = v1 - v0`,
`vm = (v0 + v1)/2`, and `sinc(x) = sin(x)/x` with `sinc(0) = 1` (use `1 - x^2/6` for small `x`).
The edge contributes `I = -du * (mean of G along the edge)`. The means follow from
`integral from 0 to 1 of sin(v0 + t dv) dt = sin(vm) sinc(dv/2)`, the same identity for `cos`,
`integral of v dt = vm`, and `integral of v^2 dt = (v0^2 + v0 v1 + v1^2)/3`:

| Surface | `G(v)` or `H(u)` | Contribution of one straight edge |
|---|---|---|
| plane | `v` | `-du * vm` (this is the shoelace formula) |
| cylinder | `R v` | `-du * R * vm` |
| cone (`rho > 0`) | `(R v + tan a v^2 / 2) / cos a` | `-du * (R vm + tan a (v0^2 + v0 v1 + v1^2)/6) / cos a` |
| sphere | `R^2 sin v` | `-du * R^2 * sin(vm) * sinc(dv/2)` |
| torus | `r (R v + r sin v)` | `-du * r * (R vm + r sin(vm) sinc(dv/2))` |
| revolution | `G(v) = integral of h(v)`, by quadrature | `-du * (mean of G)`, Gauss-Legendre along the edge |
| extrusion | `H(u) = integral of h(u)`, by quadrature | `+dv * (mean of H)`, Gauss-Legendre along the edge |

The oracle sums these over every edge of every loop. That gives one oracle, `Oracle_FaceAreaByGreen`,
which computes the area of any analytic face from its loops in parameter space, independent of any
triangulation. The per-surface oracles that VOCABULARY.md lists (`Oracle_PlanarFaceArea`,
`Oracle_CylinderPatchArea`, `Oracle_SphereArea`, `Oracle_TorusArea`, `Oracle_ConePatchArea`) become
its rows.

Worked checks, all computed:

| Region | Green | Exact |
|---|---|---|
| full sphere, `R = 2`, `[0, 2pi] x [-pi/2, pi/2]` | 50.26548245743669 | `4 pi R^2` = 50.26548245743669 |
| cap above latitude 30 degrees, `R = 2` | 12.566370614359174 | `2 pi R^2 (1 - sin 30)` = 12.566370614359172 |
| full torus, `R = 2`, `r = 0.5` | 39.47841760435743 | `4 pi^2 R r` = 39.47841760435743 |
| frustum, `R = 2`, `a = 25` degrees, `H = 3` | 56.14389613489163 | `pi (r1 + r2) s` = 56.14389613489163 |
| random star 7-gon on a sphere, `R = 2` | 1.83046 | brute force 1.83040 (grid error) |

On the full sphere, the whole area comes from the two **pole sides**, `v = -pi/2` and `v = +pi/2`,
which contribute `2 pi R^2` each. The seam sides contribute nothing, because `du = 0` there. The pole
sides have zero length in space and correspond to no edge (or to a degenerate edge). An oracle that
walks only the coedges returns zero for a sphere.

### 5.3 Closing the region: poles, apexes, wrap-around

Green's theorem needs closed polygons in the plane. The boundary must therefore include, beyond the
image of every coedge:

1. **Collapsed sides**: the segment at a pole (sphere) or an apex (cone), at constant `v`, from the
   `u` where the loop arrives to the `u` where it leaves. `DegenerateSides` in `01-geometry` names
   them.
2. **Cut segments** for a region that wraps around a periodic direction without a seam edge. A
   cylinder band between two circles is the example: its loops lift to open curves.

For a `v`-only density, every segment at constant `u` contributes zero. Segments at constant `u`,
seam images and cuts alike, can therefore be omitted, and a band's open lifted curves can be
integrated as they are.
Segments at constant `v` contribute `-du G(v)` and must be present. A torus band that wraps in `v`
needs its cut at `v = v0` and `v = v0 + 2pi`, which contributes
`du (G(v0 + 2pi) - G(v0)) = du * 2 pi r R`. For the extrusion density `H(u)`, the roles of `u` and `v` swap.

### 5.4 When the oracle is exact, and the error when it is not

It is exact, up to rounding, when every loop edge is straight in parameter space:

- lines on planes
- rulings and parallels on cylinders and cones
- meridians and parallels on spheres and tori
- helices on cylinders and cones, since `v` is linear in `u`

It is also exact on a plane when the line integral `(1/2) closed integral (x dy - y dx)` is taken
over the exact edge curves. A circular arc of radius `rho`, centre `(cx, cy)`, from angle `t0` to
angle `t1` contributes

```
(1/2) [ rho^2 (t1 - t0) + cx rho (sin t1 - sin t0) - cy rho (cos t1 - cos t0) ]
```

A polynomial B-spline edge of degree `p` contributes exactly under Gauss-Legendre quadrature with
`p` points per knot span, because `x y'` is a polynomial of degree `2p - 1`. A planar face bounded
by lines, arcs, and polynomial B-splines, which covers most planar faces in building models,
therefore has an exact area.

Otherwise, a curved parameter-space edge is replaced by chords. A chord of length `c` with
parameter-space sagitta `s` cuts off a lune of area `(2/3) c s + O(c s^2)`, the parabolic-segment
area. The area error is about `(2/3) h * L_uv * s_max`: first order in the parameter-space sagitta,
and second order in the chord length. The oracle should discretize at its own resolution, finer than
the mesher's, or Richardson-extrapolate two of its own resolutions (section 5.7).

### 5.5 What the oracle cannot do

- **B-spline and NURBS surfaces** have no closed-form `G`, since `h` is the square root of a
  polynomial or rational function. The Green reduction still works with a nested quadrature,
  `A = closed integral of Q dv` with `Q(u, v) = integral from u* to u of h(s, v) ds`, splitting at
  knots. That is accurate and still independent of the mesh, but it is not exact.
- **Offset surfaces** reduce to their basis surface only when the offset of an analytic surface is
  analytic again: a plane stays a plane, a cylinder becomes a cylinder of radius `R + d`, a sphere a
  sphere. Otherwise they need quadrature.
- **Independence depends on where the loops come from.** If the oracle takes `UvRegion` from
  `05-face-meshing`, it checks triangulation and lifting but not `LoopToUv`. Build the oracle's loops
  from the file's pcurves where they exist, and otherwise from its own projection of a finer
  sampling of the 3D edges.

### 5.6 Volume

**Divergence theorem over the exact faces** (`Oracle_DivergenceVolume`):

```
V = (1/3) * sum over faces f of  s_f * double integral over D_f of (sigma - O) . (sigma_u x sigma_v) du dv
s_f = SameSense ? +1 : -1
```

- A **planar** face contributes `(1/3) (n_f . (C_f - O)) A_f`. So a solid with planar faces has an
  exact volume once its face areas are exact.
- For the **other elementary surfaces**, the integrand is a trigonometric polynomial in `u` and a
  polynomial or trigonometric polynomial in `v`. `Q = integral of f du` has a closed form, and each
  straight edge's integral of `Q dv` is computed exactly for the polynomial parts and with
  exponential convergence for the trigonometric parts by Gauss-Legendre.
- Worked example, a **cylinder** with `O = C`: on the side, `f = R(c_x cos u + c_y sin u + R)` with
  `c = C - O = 0`, so `Q = R^2 u`, and the rectangle's two vertical sides give
  `(1/3) H (Q(2pi) - Q(0)) = (2/3) pi R^2 H`. The bottom cap gives 0, since `n . (C - O) = 0`. The
  top cap gives `(1/3) H pi R^2`. Total `pi R^2 H`.
- Worked example, a **sphere** with `O = C`: `f = R^3 cos v`, so `V = (1/3) R^3 4 pi`.

**Pappus' theorems** [16] give a second route for faces of revolution swept through an angle
`phi`: area = `phi` times the profile length times the centroid's distance from the axis; volume =
`phi` times the profile region's area times its centroid's distance.

**Closed forms for witnesses** are in section 7.2. One deserves comment: a solid whose top is a
non-rational B-spline height field `z(u, v) = sum z_ij N_i(u) N_j(v)` with `(x, y) = (u, v)`. That
holds when the control points sit at the Greville abscissae, by the linear precision of B-splines
[17]. Its volume over the base `z = 0` is

```
V = sum over i, j of  z_ij * w_i * w_j,   w_i = (t_{i+p+1} - t_i) / (p + 1)
```

since the integral of `N_{i,p}` is `(t_{i+p+1} - t_i)/(p+1)` [17]. A side face at `y = y0` has area
`sum over i of z_i0 * w_i`. The B-spline witness therefore has an exact volume and exact side areas,
and only its top area needs quadrature.

### 5.7 Convergence oracle: Richardson extrapolation

Where no exact oracle exists, mesh at two or three levels and extrapolate. For a uniform `n`-gon
style discretization the area error is `c/n^2 + O(1/n^4)`, so
`A* = (4 A(2n) - A(n)) / 3` has error `O(1/n^4)`. In terms of the chordal criterion, the error is
about `c d`. Because segment counts are integers, use the realized maximum deviation, not the
requested `d`. Two useful outputs:

- the extrapolated value, compared with the exact oracle where one exists
- the observed order `p = log_4( |A(d) - A(d/4)| / |A(d/4) - A(d/16)| )`, which should be near 1

These are evidence, not laws. Severity Info: a convergence anomaly points to a bug, but no threshold
on it is a theorem.

### 5.8 Exact deviation oracles

For a triangle whose vertices lie on the surface:

- **Sphere** (centre `c`, radius `R`). The triangle lies in the ball, so the distance from any of
  its points `p` to the sphere is `R - |p - c|`. The maximum deviation is `R - dist(c, triangle)`,
  computed by a closest-point-on-triangle routine.
- **Cylinder** (axis line `l`, radius `R`). The solid cylinder is convex, so the maximum deviation is
  `R - dist(l, triangle)`. That distance equals the 2D distance from the axis point to the triangle's
  projection onto a plane perpendicular to the axis.
- **Plane.** The deviation is the largest vertex distance, which must be at most `epsL`.

These make `Law_ElementDeviationWithinChordal` exact on the commonest curved faces. On cones and tori
the maximum is a small concave maximization, or sampled.

## 6. Convergence and metamorphic properties

### 6.1 How counts grow as the criterion shrinks

A chord spanning angle `phi` on a circle of radius `R` has sagitta `R (1 - cos(phi/2))`. Keeping the
sagitta at most `d` needs `phi <= 2 arccos(1 - d/R)`, which is about `2 sqrt(2 d / R)`. An arc of
angle `T` therefore needs at least

```
n_min = ceil( T / (2 arccos(1 - d/R)) )  ~  T sqrt(R / (8 d))
```

segments. That is **O(d^(-1/2)) per curved direction, not O(1/d)**. For `R = 1` and a full circle:
71 segments at `d = 1e-3`, 223 at `1e-4`, and 2222 at `1e-6`. A factor of 100 in `d` is a factor of
10 in `n`. A face curved in `k` directions has `O(d^(-k/2))` vertices: O(1/d) on a sphere or torus,
O(d^(-1/2)) on a cylinder or cone (the straight direction is governed by `MaxLength` and
`MinSegments`, not by `d`), and O(1) on a plane. An angular criterion `theta` adds `n >= T/theta`,
independent of `d`. For circular edges, `n_min` is a law: fewer segments prove a chordal violation
(`Law_ArcSegmentCountAtLeastMinimal`).

### 6.2 Area converges only if normals do

The claim that "mesh area tends to the exact area with error O(d)" is false as stated. The Schwarz
lantern [9, 18] is a counterexample. It inscribes `m` layers of triangles in a cylinder, `n`
vertices per ring. Its maximum deviation depends on `n` alone, so setting `m = n^2` drives
the deviation to zero while the area tends to `2 pi sqrt(1 + pi^4/4)`, about 31.6 [18]. Letting `m`
grow faster makes the area diverge. Computed for the unit cylinder, whose exact side area is
`2 pi = 6.283`, with `n = 64` (deviation about 1.2e-3 in every row):

| Layers `m` | Area |
|---|---|
| 64 | 6.299 |
| 4096 (`= n^2`) | 31.618 |
| 262144 (`= n^3`) | 1983.2 |

Hildebrandt, Polthier, and Wardetzky prove that, for polyhedral surfaces that converge in Hausdorff
distance and lie over the smooth surface as normal graphs, convergence of area is equivalent to
convergence of the normals [9].

The convergence law must therefore bound normals as well. With every element's normal within
`theta` of the surface normal, and deviation at most `d`, the first-order envelope per face is

```
|A_mesh(f) - A(f)|  <=  A(f) (2 kappa_max d + (1 - cos theta)/cos theta)  +  d P(f)
```

Here `P(f)` is the face perimeter. The first term comes from the parallel-surface area element
`(1 - 2Hd + Kd^2)` and the projection factor `cos theta`. The second covers the lunes between
boundary chords and curved boundary edges, which are `(2/3) d` per unit length. `kappa_max` is `1/R`
for a cylinder or sphere, `cos a / rho_min` for a cone, and `max(1/r, 1/(R - r))` for a torus.
`Law_FaceAreaWithinEnvelope` is geometric: Warning below ten times the envelope, Error above. The
actual constants are smaller. Computed: a cylinder strip mesh errs by `(2 pi / 3) H d` (ratio
2.0944 at `n = 128`), and a polygonal hole errs by `(2/3) d P` (1.2615e-3 against 1.2616e-3 at
`n = 128`).

**Two exact brackets for witnesses.**

- **Convex inscribed meshes.** If `K` is convex and `K'` is the convex polytope spanned by points on
  its boundary, then `area(K') <= area(K)` and `vol(K') <= vol(K)`. The nearest-point projection onto
  the convex set `K'` does not increase distances, and it maps the boundary of `K` onto the
  boundary of `K'`.
- **Sphere** of radius `R`, with a convex inscribed mesh that contains the centre, and `hmin` the
  smallest distance from the centre to an element's plane:
  `A_mesh <= 4 pi R^2 <= A_mesh (R/hmin)^2` and `V_mesh <= (4/3) pi R^3 <= V_mesh (R/hmin)^3`. The
  upper bounds follow by projecting radially from the centre, whose area density on a facet is at
  most `R^2/hmin^2`. Computed for the icosahedron: `9.574 <= 12.566 <= 15.162` and
  `2.536 <= 4.189 <= 5.054`.

**Volume.** If the mesh and the surface are within `d` of each other in both directions, the
symmetric difference of the two solids lies in the tube of radius `d` around the surface. By Weyl's
tube formula [19], for `d` below the reach, that tube has volume `2 d A + (4 pi / 3) chi d^3`. So
`|V_mesh - V| <= 2 d A + (4 pi/3) chi d^3` (`Law_SolidVolumeWithinTube`). For convex inscribed
meshes, `0 <= V - V_mesh <= d A`.

### 6.3 Bounds by construction, and monotonicity

- **"Deviation at most `d` by construction"** holds only where the discretizer measures deviation
  exactly or conservatively. On circles, lines, and the analytic surfaces of section 5.8 it can be
  exact. On a polynomial or positive-weight rational Bezier span, the convex hull property gives a
  guaranteed bound: the curve lies in the hull of its control points, so its distance from the
  chord is at most the largest control-point distance (`Law_BezierSagittaBoundedByControlHull`). A
  sampled sagitta only estimates from below, and a design that relies on one does not have the bound
  by construction.
- **"Tightening a criterion never loosens a bound."** The guaranteed bound is the criterion itself,
  so a mesh made at `d' <= d` satisfies `d`. Monotonicity of realized quantities is a stronger
  property, and holds only for nested refinement. With bisection-based edge subdivision, every
  interval split at `d` is also split at `d'`, so the partition at `d'` refines the one at `d`
  (`Law_DiscretizationNestsUnderTighterChordal`). An inscribed polyline's length can only grow under
  refinement, by the triangle inequality, so edge length errors are monotone. Inscribed surface area
  is not monotone under refinement in general (6.2), so no area monotonicity law is proposed.

### 6.4 Metamorphic relations

| Relation | Status | Condition |
|---|---|---|
| A rotation in the cube group (axis permutations and sign flips, determinant +1) gives the rotated mesh, connectivity identical, positions exactly rotated | **law** | no pipeline decision depends on world axis directions; make this a design rule |
| Scaling the model, its tolerances, and every length criterion by `2^k` gives identical connectivity and exactly scaled positions | **law** | IEEE scaling by `2^k` is exact (no overflow), `sqrt(4x) = 2 sqrt(x)` exactly, and angles are invariant |
| A general rigid motion gives the moved mesh: connectivity identical, positions within `epsL` | witnesses only | floating-point ties (cocircular points, equal sagittas) can resolve differently |
| Scaling by a general `lambda` (a unit change, mm to m) gives identical connectivity | witnesses only | as above |
| Reversing an edge (swap `Start` and `End`, flip `SameSense`, flip every use's `Orientation`) gives an identical mesh | **law** | discretization runs in the curve's own parameter direction (VOCABULARY.md defines `Parameters` that way), and loops are unchanged |
| Reversing a face (flip `SameSense` and every bound's `Orientation`) gives the same triangles with reversed winding and negated normals | **law** at face level (`MeshFace`) | the face mesher takes its region from the loops as a point set; orientation decides only the winding |
| Flipping `SameSense` alone makes the face invalid | **law** (negative test) | `Law_FaceWindingMatchesSameSense` must fail |
| Reversing every face of a shell reverses every element and negates `SignedVolume` | **law** | as for one face |
| `Trimmed(b, t1, t2, false)` equals `Trimmed(b, t2, t1, true)` traversed backwards, as oriented point sets | **law** (`01-geometry`) | by ISO's definition of `sense_agreement` [3]. Note that it is not "the same arc reversed": on a circle, `Trimmed(c, 0, 90, false)` is the 270 degree arc |
| Meshing the same input twice gives identical output | **law** | determinism |
| Renumbering STEP instances gives the same mesh up to a permutation; counts and `chi` equal, area and volume equal up to summation order | **law** | |
| Splitting a face by a new edge leaves `chi` (`E + 1`, `F + 1`), area, and volume unchanged | witnesses only | building the split model needs geometry |

## 7. Property-based testing strategy

### 7.1 Why random instances do not work

A law of the form `pre ? claim : true` is vacuously true wherever `pre` fails. Random values of a
constrained type almost never satisfy the precondition. Simulated during this research, 20,000
trials each, with vertices uniform in the unit square and joined in order:

| Vertices | Fraction of random polygons that are simple |
|---|---|
| 4 | 53% |
| 5 | 28% |
| 6 | 13% |
| 8 | 2.2% |
| 12 | 0.03% |
| 16 | 0 in 20,000 |

A random `BrepModel` has a vanishing chance that its index arrays even chain into loops. A runner
that reports "1000 passed" for a law whose guard rejected 998 instances is misleading, so **the law
runner must report the vacuity rate per law and fail a law whose rate is 100%**. Pseudorandom values
remain useful for total laws over unconstrained inputs, such as the trimmed-curve reversal at random
parameters or the area element at random `(u, v)`, and as random transforms and parameters applied
to witnesses.

### 7.2 The witness set

Exact counts (section 1.5) and closed-form oracles:

| Witness | V | E | F | L | R | S | G | chi | Area | Volume |
|---|---|---|---|---|---|---|---|---|---|---|
| `Witness_UnitBox` (`a = b = c = 1`), `Witness_Box(a, b, c)` | 8 | 12 | 6 | 6 | 0 | 1 | 0 | 2 | `2(ab+bc+ca)` | `abc` |
| `Witness_Cylinder` (`R, H`), one seam | 2 | 3 | 3 | 3 | 0 | 1 | 0 | 2 | `2 pi R (R + H)` | `pi R^2 H` |
| `Witness_Sphere` (`R`), seam, poles at its ends | 2 | 1 | 1 | 1 | 0 | 1 | 0 | 2 | `4 pi R^2` | `4 pi R^3 / 3` |
| `Witness_Torus` (`R > r`), two seams | 1 | 2 | 1 | 1 | 0 | 1 | 1 | 0 | `4 pi^2 R r` | `2 pi^2 R r^2` |
| `Witness_Cone` (`R, H`), apex vertex, seam | 2 | 2 | 2 | 2 | 0 | 1 | 0 | 2 | `pi R (R + s)`, `s = sqrt(R^2 + H^2)` | `pi R^2 H / 3` |
| `Witness_BlockWithThroughHole` (`a, b, c`, square hole `w`) | 16 | 24 | 10 | 12 | 2 | 1 | 1 | 0 | `2(ab+bc+ca) - 2w^2 + 4wc` | `(ab - w^2) c` |
| `Witness_HollowBox` (outer `a, b, c`; inner `a', b', c'`) | 16 | 24 | 12 | 12 | 0 | 2 | 0 | 4 | sum of both box areas | `abc - a'b'c'` |
| `Witness_BSplinePatchSolid` (box with a B-spline top) | 8 | 12 | 6 | 6 | 0 | 1 | 0 | 2 | sides and bottom exact (5.6); top by quadrature | `sum z_ij w_i w_j` (5.6) |

Each witness should also exist in its **variant encodings**, built as separate witnesses that share
the oracle: sphere B through E, the seamless cylinder, and the three cone variants of section 1.5.
They test the counting rule, the corner graph, and the parameter-space closure of 5.3, which is
where implementations differ. **Negative witnesses** with known failures:

- the box with an extra sheet (edge condition)
- two boxes sharing a corner (vertex condition and odd `chi`)
- two L-blocks touching at two corners (vertex condition only)
- a three-face Mobius strip (orientability)
- a box with one face's `SameSense` flipped (winding law and signed volume)

### 7.3 Parameterized witnesses and generators

Laws can still quantify over continuous parameters within a valid range:

- **Shape parameters.** `Witness_Box(a, b, c)`, `Witness_Cylinder(R, H)`,
  `Witness_Torus(R, r)` for `R > r`, and `Witness_CylinderSector(R, H, sweep)` for sweep angles in
  `[s_min, 2 pi - s_min]`. The sector has prism topology, `V = 6, E = 9, F = 5`, area
  `sweep R^2 + sweep R H + 2 R H`, and volume `sweep R^2 H / 2`. The full turn is the seamed
  `Witness_Cylinder`, a different topology.
- **Extruded star polygons**, `Witness_ExtrudedStar(seed, n, height)`. Sort `n` random angles and
  give each a radius in `[r_min, r_max]`. A star-shaped polygon is always simple, so every seed gives
  a valid prism with `V = 2n, E = 3n, F = n + 2, G = 0`. Add a star-shaped hole of `m` vertices whose
  radii stay below `r_min cos(gap_max / 2)`, which keeps it inside the outer polygon for angular gaps
  below `pi`: `V = 2(n + m), E = 3(n + m), F = n + m + 2, R = 2, G = 1`. Area and volume are exact by
  the shoelace formula.
- **Revolved profiles.** A random simple polygon in the half-plane `x > 0`, revolved a full turn,
  gives a genus-1 solid of conical, cylindrical, and planar annular bands. With one seam per band:
  `V = k, E = 2k, F = k, chi = 0`. Pappus gives exact area and volume.
- **Euler-operator sequences** [5] build random valid topologies for the topology-only laws (counts,
  chaining, corner graph), where geometry does not matter.
- **Transforms** wrap any witness: cube-group rotations, `2^k` scalings, random rigid motions, edge
  reversals, face splits (section 6.4).

### 7.4 Differential testing against a reference tessellator

**Reference: Open CASCADE.** Read with `STEPControl_Reader`, mesh with `BRepMesh_IncrementalMesh`
with an absolute linear deflection and an angular deflection [12], and compute exact-surface
properties with `BRepGProp` (surface and volume integrals over the B-rep). OCCT's integrators are an
independent implementation of the integrals in 5.2 and 5.6, which makes them the best available
reference for B-spline faces. Match faces through the STEP instance ids. Compare:

1. `chi` per shell and closedness. OCCT's per-face triangulations share edge polygons, so weld them
   through the edge polygons, not by coincidence.
2. Per-face area: ours, OCCT's mesh, and `BRepGProp` against `Oracle_FaceAreaByGreen`, within the
   envelope of 6.2.
3. Volume: ours, OCCT's, and `BRepGProp`, within the tube bound.
4. Symmetric Hausdorff distance between the two meshes, estimated by surface sampling as in Metro
   [14]. If each mesh is within its own deviation of the exact surface in both directions, the
   triangle inequality gives `H(ours, OCCT) <= d_ours + d_occt` (`Law_HausdorffToReferenceWithinSum`).
   The surface-to-mesh direction is not automatic: `Law_SurfaceCoveredByMesh` samples the face and
   measures the distance to its mesh.

Gmsh and FreeCAD mesh through OCCT, so they are not independent of it or of each other. For a
corpus, the ABC dataset [13] provides about a million STEP files exported from Onshape. Use it as
inputs, and do not treat any meshes shipped with a corpus as an independent reference without
checking how they were made.

### 7.5 Golden files

Acceptable:

- exact integer outputs: counts, `chi`, the connectivity of structured quad grids
- parse results of Part 21 text, which are deterministic data with no computed floating point
- regression snapshots of meshes, compared with tolerance, run only after the invariant laws pass,
  and regenerated only in a commit that names the cause

Not acceptable:

- as the primary evidence for any geometric claim, since a golden file freezes whatever the code did
  when it was recorded
- bitwise floating-point positions across platforms, since fused multiply-add contraction and libm
  differences change last bits, unless the backend guarantees bitwise reproducibility

## 8. Catalogue of laws

Kind: **model** laws run on user data in validation, and their severity applies. **Library** laws
run in the test suite on witnesses; failing one is a defect in the library, and the severity column
reads "test". Severity per SPEC-DSL.md section 4. Topological or structural: Error. Geometric: Warning
below ten times the tolerance, Error above ("W/E"). Quality: Info.

| Law | Layer | Parameters | Tolerance | Kind, severity | Section |
|---|---|---|---|---|---|
| `Law_TrimmedSenseFlipIsReversal` | 01 | trimmed curve data, `t` | `epsL` | library, test | 6.4 |
| `Law_AreaElementMatchesCrossProduct` | 01 | `g, s, uv` | relative, `Parameter` | library, test | 5.1 |
| `Law_SurfaceNormalIsCrossProductDirection` | 01 | `g, s, uv` | `Angle` | library, test | 5.1, 3.4 |
| `Law_IndicesInRange` | 02 | `m` | exact | model, Error | 2.4 |
| `Law_LoopsChainEndToStart` | 02 | `m, l` | exact | model, Error | 1.4 |
| `Law_EdgeHasPositiveExtent` | 02 | `m, e` | `epsL` | model, Error | 1.3 |
| `Law_FaceBoundsShareNoVertex` | 02 | `m, f` | exact | model, Error | 1.3 |
| `Law_AtMostOneOuterBound` | 02 | `m, f` | exact | model, Error | 3.4 |
| `Law_EdgeUsedTwiceInClosedShell` | 02 | `m, s, e` | exact | model, Error | 2.1 |
| `Law_EdgeUsedAtMostTwiceInOpenShell` | 02 | `m, s, e` | exact | model, Error | 2.1 |
| `Law_EdgeUsesRunOpposite` | 02 | `m, s, e` | exact | model, Error | 2.3 |
| `Law_ShellOrientable` | 02 | `m, s` | exact | model, Error | 2.3 |
| `Law_VertexLinkIsSingleCycle` | 02 | `m, s, v` | exact | model, Error | 2.2 |
| `Law_VertexLoopVertexIsIsolated` | 02 | `m, s, l` | exact | model, Error | 2.2 |
| `Law_ShellIsConnected` | 02 | `m, s` | exact | model, Error | 1.4 |
| `Law_EulerPoincare` | 02 | `m, s` (closed) | exact: reduced `chi` even and at most 2 | model, Error | 1.4 |
| `Law_EulerPoincareOpenShell` | 02 | `m, s` (open) | exact: `chi + B` even and at most 2 | model, Error | 1.1, 1.4 |
| `Law_EulerPoincareMatchesGenus` | 02 | `m, s, g` | exact | library, test | 1.5, 7.2 |
| `Law_VertexCoincidesWithCurveEnd` | 02 | `m, e` | `epsL` | model, W/E | 3.1 |
| `Law_EdgeDomainWithinPeriod` | 02 | `m, e` | `Parameter` | model, Error | 3.1 |
| `Law_EdgeLiesOnAdjacentSurfaces` | 02 | `m, use, t` | `epsL` | model, W/E | 3.2 |
| `Law_PcurveAgreesWithCurve` | 02 | `m, use, s` | `epsL` | model, W/E | 3.3 |
| `Law_CurveAgreesWithPcurve` | 02 | `m, use, t` | `epsL` | model, W/E | 3.3 |
| `Law_PcurveDirectionAgrees` | 02 | `m, use, s` | exact sign | model, Error | 3.3 |
| `Law_LoopSimpleInParameterSpace` | 02 | `m, f, l` | `Parameter` | model, Error | 3.4 |
| `Law_InnerBoundInsideOuter` | 02 | `m, f, l` | `Parameter` | model, Error | 3.4 |
| `Law_FaceWindingMatchesSameSense` | 02 | `m, f` | exact sign | model, Error | 3.4 |
| `Law_ParametersStrictlyIncreasing` | 04 | `d` | exact | model, Error | 6.3 |
| `Law_DiscretizationEndsAtVertices` | 04 | `m, d` | exact (bitwise) | model, Error | 4.4 |
| `Law_PointsLieOnCurve` | 04 | `m, d, i` | `epsL` | model, Error | 3.1 |
| `Law_SagittaWithinChordal` | 04 | `m, d, i, c` | chordal `d` | model, W/E | 6.1 |
| `Law_TurningAngleWithinAngular` | 04 | `m, d, i, c` | angular `theta` | model, W/E | 6.1 |
| `Law_ArcSegmentCountAtLeastMinimal` | 04 | `m, d, c` (circular edges) | exact integer | model, Error | 6.1 |
| `Law_BezierSagittaBoundedByControlHull` | 04 | Bezier span, chord | exact inequality | library, test | 6.3 |
| `Law_DiscretizationNestsUnderTighterChordal` | 04 | `m, e, c, c'` | exact | library, test | 6.3 |
| `Law_UvRegionWindingPositive` | 05 | `m, f, region` | exact sign | model, Error | 3.4, 5.3 |
| `Law_FaceFlipReversesWinding` | 05 | `m, f, c` | exact | library, test | 6.4 |
| `Law_MeshEdgeAtMostTwoElements` | 06 | `mesh` | exact | model, Error | 4.1 |
| `Law_MeshEdgeExactlyTwoElements` | 06 | `mesh`, component | exact | model, Error | 4.1 |
| `Law_MeshEdgeOppositeTraversal` | 06 | `mesh` | exact | model, Error | 4.1 |
| `Law_MeshVertexLinkIsSingleCycle` | 06 | `mesh, v` | exact | model, Error | 4.1 |
| `Law_MeshNoCoincidentVertices` | 06 | `mesh` | `epsL` | model, Error | 4.2 |
| `Law_MeshElementNotDegenerate` | 06 | `mesh, element` | `epsL` (minimum altitude) | model, Error | 4.2 |
| `Law_MeshComponentEulerEvenAtMostTwo` | 06 | `mesh`, component | exact | model, Error | 4.3 |
| `Law_TriangleAngleSumIsPi` | 06 | `mesh, element` | `Angle` | model, Error | 4.5 |
| `Law_AngleDefectSumIdentity` | 06 | `mesh`, component | corner count times `Angle` | model, Error | 4.5 |
| `Law_VectorAreaVanishes` | 06 | `mesh`, component | of order `epsL` times area over side | model, Error | 4.6 |
| `Law_QuadAngleDefectWithinTolerance` | 06 | `mesh, quad` | quality angle | model, Info | 4.5 |
| `Law_MeshEulerMatchesBrep` | 07 | `m, mesh, s` | exact | model, Error | 4.4 |
| `Law_MeshComponentPerShell` | 07 | `m, mesh` | exact | model, Error | 4.4 |
| `Law_AngleDefectMatchesBrepEuler` | 07 | `m, mesh, s` | corner count times `Angle` | model, Error | 4.5 |
| `Law_MeshVertexOnProvenance` | 07 | `m, mesh, v` | `epsL` | model, W/E | 4.4 |
| `Law_ElementDeviationWithinChordal` | 07 | `m, mesh, element, c` | chordal `d` (exact on plane, cylinder, sphere) | model, W/E | 5.8 |
| `Law_ElementNormalWithinAngular` | 07 | `m, mesh, element, c` | angular `theta`; above 90 degrees is an orientation Error | model, W/E | 3.5, 6.2 |
| `Law_SurfaceCoveredByMesh` | 07 | `m, mesh, f, uv` | chordal `d` | model, W/E | 7.4 |
| `Law_FaceAreaWithinEnvelope` | 07 | `m, mesh, f, c` | the 6.2 envelope | model, W/E | 5.2, 6.2 |
| `Law_SolidVolumeWithinTube` | 07 | `m, mesh, body, c` | `2 d A + (4 pi/3) chi d^3` | model, W/E | 6.2 |
| `Law_ShellSignedVolumeSign` | 07 | `m, s` (exact faces) | `|V|` above `2 epsL A` | model, Error | 3.5, 5.6 |
| `Law_MeshShellSignedVolumeSign` | 07 | `m, mesh, s` | `|V|` above `2 d A` | model, Error | 3.5, 4.7 |
| `Law_RayParityAgreesWithNormal` | 07 | `mesh, s, Q` | exact (generic ray) | model, Error | 3.5 |
| `Law_SphereBracketsInscribedMesh` | 07 | sphere witness mesh | exact inequalities | library, test | 6.2 |
| `Law_HausdorffToReferenceWithinSum` | 07 | `mesh`, reference mesh, `d, d_ref` | `d + d_ref` | library, test | 7.4 |
| `Law_ConvergenceOrderNearOne` | 07 | witness, `d` | heuristic band | library, Info | 5.7 |
| `Law_MeshingIsDeterministic` | 08 | `text, options` | exact | library, test | 6.4 |
| `Law_CubeRotationCommutes` | 08 | witness, rotation | exact | library, test | 6.4 |
| `Law_PowerOfTwoScalingCommutes` | 08 | witness, `k` | exact | library, test | 6.4 |
| `Law_RigidMotionCommutesWithinTolerance` | 08 | witness, frame | `epsL` | library, test | 6.4 |
| `Law_EdgeReversalPreservesMesh` | 08 | `m, e, options` | exact | library, test | 6.4 |
| `Law_ShellReversalNegatesVolume` | 08 | `m, s, options` | exact | library, test | 6.4 |
| `Law_RenumberingPermutesMesh` | 08 | `file`, permutation | exact | library, test | 6.4 |
| `Law_FaceSplitPreservesAreaVolumeEuler` | 08 | witness pair | `chi` exact; area and volume within the envelope | library, test | 6.4 |

## Open questions for the design authors

1. **Per-vertex attributes at seams and sharp edges** (`06-mesh`). `ModelMesh` has one `uv` and one
   normal per vertex. Welded topology needs corner attributes or a separate attribute index;
   splitting vertices breaks closedness and `Law_MeshNoCoincidentVertices`.
2. **Orientation flags with no home** (`02-topology`, `03-step`). `oriented_face`,
   `oriented_closed_shell`, and void orientation are not in the vocabulary. This document assumes the
   decoder folds them into `FaceBound.Orientation` and `SameSense` (section 2.3). If it does not, the
   orientation laws need the flags as inputs.
3. **The edge index in `BrepEdgeUse`.** The stdlib's `BrepEdgeUse.Edge` is an
   `UndirectedEdgeIndex`, which VOCABULARY.md reserves for mesh edges. Kernel edges are
   `BrepEdgeIndex`. Reusing `BrepEdgeUse` unchanged mixes the two index spaces.
4. **Severity of a repaired defect.** A redundant vertex loop or a degenerate edge breaks an ISO rule
   but is harmless once the counting rule reduces it. Error, as SPEC-DSL implies, or Warning?
5. **Parameter-space tolerance.** Laws in parameter space need a tolerance that agrees with `epsL`
   through `|sigma_u|` and `|sigma_v|`. Those vanish at poles. Is `Tolerances.Parameter` one number
   per model, or should the laws derive one per face and point?
6. **Correction to the brief.** The vertex count grows as O(d^(-1/2)) per curved direction, not
   O(1/d) (6.1). And area converges at O(d) only when the normals also converge (6.2), so area laws
   must take the angular criterion as a parameter.

## Sources

1. ISO 10303-42:2021, clause 5 (topology schema): loop, vertex_loop, edge, face, and shell
   definitions, Euler equations 2 to 9, face and closed_shell informal propositions. Mirror:
   https://downloads.steptools.com/stds/smrl/data/resource_docs/geometric_and_topological_representation/sys/5_schema.htm
2. ISO 10303-42:2021, clause 6 (geometric model schema): `manifold_solid_brep` Euler formula and
   informal propositions; `brep_with_voids` void orientation FALSE.
   https://downloads.steptools.com/stds/smrl/data/resource_docs/geometric_and_topological_representation/sys/6_schema.htm
3. ISO 10303-42:2021, clause 4 (geometry schema): parameterizations and normals of `plane`,
   `cylindrical_surface`, `conical_surface`, `spherical_surface`, `toroidal_surface`,
   `surface_of_revolution`, `surface_of_linear_extrusion`; angular parameter units; `trimmed_curve`
   `sense_agreement`.
   https://downloads.steptools.com/stds/smrl/data/resource_docs/geometric_and_topological_representation/sys/4_schema.htm
4. ISO 10303-42:2021, clause 3 (definitions): Euler equations, genus of a graph and of a surface.
   https://downloads.steptools.com/stds/smrl/data/resource_docs/geometric_and_topological_representation/sys/3_defs.htm
5. M. Mantyla, *An Introduction to Solid Modeling*, Computer Science Press, 1988. The
   Euler-Poincare formula with rings, and Euler operators.
6. I. C. Braid, R. C. Hillyard, I. A. Stroud, "Stepwise construction of polyhedra in geometric
   modelling", in K. W. Brodlie (ed.), *Mathematical Methods in Computer Graphics and Design*,
   Academic Press, 1980. The letters for each term vary between later reproductions.
7. C.-K. Shene, "The Euler-Poincare Formula", CS3621 course notes, Michigan Technological
   University. Worked examples, and the box-with-sheet counterexample.
   https://pages.mtu.edu/~shene/COURSES/cs3621/NOTES/model/euler.html
8. A. Bowyer, Final-year Geometric Modelling Course, 1996. Rings "floating" in faces.
   https://homepages.inf.ed.ac.uk/rbf/CVonline/LOCAL_COPIES/BOWYER1/c2.htm
9. K. Hildebrandt, K. Polthier, M. Wardetzky, "On the convergence of metric and geometric properties
   of polyhedral surfaces", *Geometriae Dedicata* 123 (2006) 89-112. Area converges if and only if
   normals do; the Schwarz lantern.
   https://page.mi.fu-berlin.de/polthier/articles/convergence/convergence.pdf
10. C. Zhang, T. Chen, "Efficient feature extraction for 2D/3D objects in mesh representation",
    IEEE ICIP 2001, 935-938. Volume as a sum of signed tetrahedra.
    https://www.microsoft.com/en-us/research/wp-content/uploads/2016/11/icip01_ChaZhang.pdf
11. CGAL Polygon Mesh Processing, orientation functions (`is_outward_oriented`).
    https://doc.cgal.org/5.2/Polygon_mesh_processing/group__PMP__orientation__grp.html
12. Open CASCADE Technology, mesh user guide and `BRepMesh_IncrementalMesh` (linear and angular
    deflection). https://dev.opencascade.org/doc/overview/html/occt_user_guides__mesh.html
13. S. Koch et al., "ABC: A Big CAD Model Dataset for Geometric Deep Learning", CVPR 2019.
    https://openaccess.thecvf.com/content_CVPR_2019/html/Koch_ABC_A_Big_CAD_Model_Dataset_for_Geometric_Deep_Learning_CVPR_2019_paper.html
14. P. Cignoni, C. Rocchini, R. Scopigno, "Metro: measuring error on simplified surfaces",
    *Computer Graphics Forum* 17(2), 1998.
15. "Angular defect", Wikipedia: Descartes' theorem, total defect `2 pi chi`.
    https://en.wikipedia.org/wiki/Angular_defect
16. "Pappus's centroid theorem", Wikipedia. https://en.wikipedia.org/wiki/Pappus%27s_centroid_theorem
17. L. Piegl, W. Tiller, *The NURBS Book*, 2nd ed., Springer, 1997. Integral of a B-spline basis
    function; linear precision at the Greville abscissae.
18. "Schwarz lantern", Wikipedia: construction, area formula, divergence.
    https://en.wikipedia.org/wiki/Schwarz_lantern
19. H. Weyl, "On the volume of tubes", *American Journal of Mathematics* 61 (1939) 461-472.
