# Meshing requirements: what a B-rep tessellation must satisfy, and how kernels do it

Phase 1 research for TKT-299 (the STEP B-rep to mesh design), written 2026-10-17 for the authors of
`04-discretization`, `05-face-meshing`, and `06-mesh`. It states the constraints a CAD tessellation is
commonly held to, the parameters existing kernels expose for them, the formulas and algorithms that
satisfy them, and what this design should fix, expose, and merely report. The names used are those of
[VOCABULARY.md](../VOCABULARY.md); "the README" means the sandbox's [README.md](../README.md).

Conventions. A bracketed number such as [3] cites the numbered source list at the end. "Read" sources
were opened during this research (documentation pages, specifications, or source code at the master
branch on 2026-10-17); sources marked "not opened" are cited from the literature for a standard result.
A statement marked **(unconfirmed)** rests on inference or on a secondary source. Formulas are in plain
text: `R` a radius, `d` a chordal deviation, `alpha` an angle, `theta` an angle subtended at a centre,
`S(u,v)` a surface, `S_u` and `S_v` its partial derivatives, `C(t)` a curve.

## 0. The findings that matter most

1. Every kernel that produces a conforming mesh does it the way the README fixed: edges first, one
   polygon per edge, both faces consume it, face refinement never splits a boundary segment
   (OpenCascade [3][8], gmsh [18], Parasolid's default "topology matching" [11]). The decision is
   right.
2. The edge polygon must be fine enough in **each adjacent face's parameter space**, not only in 3D.
   OpenCascade refines an edge until the straight uv segment between consecutive samples, mapped onto
   each non-planar adjacent surface, stays within the deflection of the 3D chord [6], and re-discretizes
   an edge with a third of its deflection (up to five times) when its uv polygon self-intersects [9].
   So `Discretize` must see the edge's pcurves, and the pipeline needs a bounded feedback loop from face
   meshing to edge discretization.
3. All five kernels studied agree on the meaning of the two main criteria once reduced to a circle:
   the chordal deviation is the sagitta `R(1 - cos(theta/2))`, and the angular criterion is the
   central angle `theta` per segment. The closed form `n = ceil(Theta / min(2 acos(1 - d/R), alpha))`
   governs every conic edge and the spacing of interior nodes on cylinders, cones, spheres, and tori.
4. The README's surface angle ("the angle between an element's normal and the surface normal") is not
   the quantity OpenCascade and ACIS bound (the angle between surface normals at the two ends of an
   element edge). On a sphere the second is about `sqrt(3)` times the first for equilateral
   triangles; on a cylinder strip it is exactly twice. The design must define its angle precisely and
   state the conversion.
5. A face's parameter region is often not closed by its loops in uv: a STEP face may cover a whole
   period, may lack a seam edge, and may have a pole with no edge (ISO 10303-42 allows a face that
   "cover[s] an entire sphere or torus" [40]). Face meshing must synthesize seam and pole boundary
   pieces; `BoundarySource` has no case for a pole that is not a model vertex.
6. Per-vertex `Normals` and `Uvs` in `ModelMesh` cannot hold what a B-rep mesh needs: a vertex on a model
   edge has a different uv in each adjacent face, a seam vertex has two uv values in the same face, a
   crease vertex has two normals, and a cone apex has a different normal in every adjacent triangle.
   These attributes must be per element corner. Parasolid's default instead gives every facet its own
   vertex at a degeneracy, giving up topology for correct normals [11].
7. Quads are natural and exactly planar on structured grids of planes, extrusions, and surfaces of
   revolution (cylinder, cone, sphere, torus), but a grid needs equal sample counts on opposite sides.
   Independent edge discretization gives that only by coincidence. Elsewhere it needs an
   interval-assignment pass [34], and any all-quad region needs an even number of boundary segments.
8. With the boundary locked, Delaunay refinement loses its angle guarantee. Triangle's manual warns:
   "you will probably sacrifice much of the quality of the mesh" [23]. So minimum angle and aspect
   ratio must be reported, not promised. Long thin triangles along cylinder rulings are what
   OpenCascade produces by design [7], and Shewchuk shows that large angles, not small ones, spoil
   interpolated gradients (and so normals) [25].

## 1. Requirements

Who requires each constraint: 3MF and STL (3D printing) [20][22], glTF [19], USD [21], finite-element
meshers (gmsh, Cubit) [18][35], the kernels' own tessellators [3][11][13], and this library's oracles
(area, volume, Euler characteristic). "Enforcement" says how this design should hold the constraint:
**construction** (true by the way the mesh is built, then checked), **refinement** (approached by
inserting interior points until a test passes, then measured), or **report** (measured and listed as a
diagnostic, never promised).

### 1.1 Topological constraints

| Constraint | Required by | How measured | Typical default | Enforcement |
|---|---|---|---|---|
| Closed: no boundary mesh edge on a closed shell | 3MF "Manifold Edges" (MUST) [20]; STL: every edge belongs to exactly two faces [22]; volume oracles | Count elements per undirected mesh edge; a closed shell has none with count 1 | Always required for solids | Construction (shared edge polylines), checked |
| Manifold edges: each mesh edge in exactly two elements of the shell | 3MF (MUST) [20]; CGAL simplification and remeshing need oriented 2-manifolds [17] | Same edge table; count 2 everywhere | Always, when the model is manifold | Construction; a non-manifold model (a `ShellSet` touching at an edge) legitimately yields count above 2, reported |
| Manifold vertices: the elements around a vertex form one fan | 3MF implicitly [20]; half-edge structures | Link of each vertex is a single cycle (closed shell) or path | Always, when the model is | Construction; model vertices shared by two shells reported |
| Consistently oriented: a shared edge is traversed in opposite directions by its two elements | 3MF "Consistent Triangle Orientation" (MUST) [20] | Orientation parity in `MeshEdgeTable` | Always | Construction (winding rule of section 6), checked |
| Outward orientation | 3MF (MUST; negative volume is a void) [20]; STL right-hand rule [22]; glTF front faces counter-clockwise [19]; USD `rightHanded` [21] | Signed volume by the divergence theorem is positive | Always for solids | Construction (face `SameSense`), checked by `SignedVolume` |
| Same Euler characteristic and genus as the model | This library's oracle; any downstream topology use | `V - E + F` per closed shell equals `2 - 2g` from the B-rep's Euler-Poincare | Always | Construction (each face meshed as its own region), checked |
| No T-junctions: no vertex lies in the interior of another element's edge | FEM conformity [18]; renderers (cracks); earcut notes its output may contain T-junctions [29] | Every mesh vertex on a model edge belongs to that edge's polyline; no element edge contains another vertex | Always for conforming meshes; Parasolid "geometry matching" violates it on purpose [11] | Construction (boundary locked), checked |
| No duplicate vertices | 3MF "SHOULD NOT include duplicate vertices" [20] | No two vertices with the same provenance; geometric coincidence within the file tolerance reported separately | Always | Construction (`VertexLayout` numbering by provenance); geometric near-duplicates reported, never merged |
| No degenerate element: an element never repeats a vertex index | glTF "SHOULD NOT contain degenerate ... triangles" [19]; 3MF "v1, v2 and v3 MUST be distinct" [20] | Index equality | Always | Construction (drop pole-collapsed elements, section 4.4) |
| No zero-area element with distinct indices | 3MF "SHOULD have a non-zero area" [20]; normal computation | Area below `LengthTolerance^2` | Warning | Report (slivers can come from the B-rep itself, section 7) |
| No self-intersection | 3MF SHOULD [20]; STL [22] | Pairwise triangle intersection (CGAL `does_self_intersect` [17]) | Not guaranteed by any kernel studied | Report, at the `Oracle` conformance level |

### 1.2 Geometric constraints

| Constraint | Required by | How measured | Typical default | Enforcement |
|---|---|---|---|---|
| Vertices on the model | All kernels; README group 2 | Re-evaluate the surface at the vertex's uv (or the curve at its parameter); distance to the stored position | The file's `LengthTolerance` | Construction (positions are evaluations), checked |
| Edge chordal deviation | OpenCascade `Deflection` [1]; Parasolid `curve_chord_tol` [11]; CGAL `edge_distance` [15] | Distance from the curve to the chord, per segment (sagitta) | No universal default; OCCT struct default 0.001 model units [1] | Construction for conics (closed form), refinement for other curves |
| Edge angular deviation | OCCT `Angle` [1]; Parasolid `curve_chord_ang` [11]; gmsh curvature sizing [18] | Per segment: sum of the two angles between the chord and the curve tangents at its ends | OCCT 0.5 rad [1]; OCCT guide suggests 12 to 20 degrees [3]; gmsh STL export 0.3 rad [18] | Construction or refinement, as above |
| Surface chordal deviation | OCCT `DeflectionInterior` [1]; Parasolid `surface_plane_tol` [11]; ACIS surface tolerance [13]; CGAL `facet_distance` [15]; Cubit "Deviation" [35] | Distance from points of the element to the surface; sampled at the element centroid and interior edge midpoints (section 4.7) | OCCT: equal to `Deflection` [2]; ACIS: -1, meaning relative to entity size [13] | Refinement; the measured maximum is reported, since sampling gives a lower bound |
| Surface angular (normal) deviation | OCCT `AngleInterior` [1]; Parasolid `surface_plane_ang` [11]; ACIS normal tolerance [13] | Varies by kernel; see section 2.3 | OCCT: twice `Angle` [2]; ACIS 15 degrees [13] | Refinement, measured |
| Maximum element size | Parasolid `max_facet_width`, `curve_chord_max` [11]; ACIS max facet edge length [13]; CGAL `facet_size`, `edge_size` [15]; gmsh `MeshSizeMax` [18] | Longest element edge in 3D | Off by default in every kernel | Construction (edges), refinement (interior) |
| Minimum element size | OCCT `MinSize` [1]; Parasolid `min_facet_width` [11]; CGAL `min_radius_bound` [15]; gmsh `MeshSizeMin` [18] | Shortest edge produced by refinement | OCCT: `max(1e-7, 0.1 * min(Deflection, DeflectionInterior))` [2] | A stop rule for refinement, not a guarantee: boundary edges from the model can be shorter. Parasolid states that below it "Parasolid may disregard supplied curve, surface and planarity tolerance values" [11] |
| Relative versus absolute deviation | OCCT `Relative` [1]; ACIS negative surface tolerance [13]; gmsh `StlLinearDeflectionRelative` [18] | A parameter interpretation, not a test | Absolute in OCCT, Parasolid, CGAL; relative in ACIS | Resolve to an absolute length once, before meshing (section 2.4) |
| Vertex normals equal surface normals | glTF `NORMAL` "Normalized XYZ vertex normals" [19]; USD normals only for `subdivisionScheme = "none"` [21] | Angle between the stored normal and the surface normal at the vertex's uv, times the face's sense | Exact up to evaluation error | Construction, per element corner (finding 6) |

### 1.3 Quality constraints

Ranges are Cubit's "acceptable" values [35], given only as a common reference. They are finite-element
conventions, not requirements of any exchange format.

| Constraint | Required by | How measured | Typical default | Enforcement |
|---|---|---|---|---|
| Minimum angle | FEM; Triangle `-q` (20 degrees default, termination proved up to 28.6) [23]; CGAL `facet_angle` (termination proved at 30 degrees or less) [15][16] | Smallest interior angle | Cubit acceptable 30 to 60 degrees [35] | Report; an optional interior-refinement target. With the boundary locked no guarantee exists [23] |
| Maximum angle | Interpolated gradients and normals: "The enemy is large angles" [25] | Largest interior angle | Cubit acceptable 60 to 90 degrees [35] | Report |
| Radius ratio | Frey and George [36]; Cubit "Aspect Ratio" (circumradius over inradius, normalized) [35] | `R_circ / (2 r_in)`, 1 for an equilateral triangle | Cubit acceptable 1 to 3 [35] | Report |
| Aspect ratio | Frey and George [36]; Cubit "Aspect Ratio Alpha" [35] | `(sqrt(3)/6) * h_max / r_in`, 1 for equilateral (normalizing constant derived here) | Same | Report |
| Circumradius to shortest edge | Delaunay refinement's test [23][24]; Botsch et al. [37] | `B = R_circ / l_min = 1 / (2 sin(angle_min))` by the law of sines; `B = sqrt(2)` gives 20.7 degrees (Ruppert's bound [26]) | | Report; this is the test a refinement target would use |
| Quad skew | Cubit [35] | Maximum `abs(cos A)`, `A` the angle between the lines joining opposite edge midpoints | Cubit acceptable 0 to 0.5 | Report |
| Quad planarity (warp) | Parasolid `facet_plane_tol` and the facet mid-plane [11]; Cubit warpage [35] | Distance of the corners from the mid-plane, or equivalently the gap between the two diagonals; Cubit uses the cosine of the dihedral angle between the two triangles of a diagonal split | Cubit acceptable 0.9 to 1.0 [35] | Construction: a quad is emitted only if it passes, otherwise it is split (section 5.4) |
| Quad convexity | Parasolid `PK_facet_shape_convex_c`, the default [11] | All four corner cross products, projected on the mid-plane, have the same sign | Required | Construction, as planarity |
| Jacobian ratio, scaled Jacobian | FEM; Cubit [35]; gmsh `QualityType` [18] | Scaled Jacobian: minimum corner Jacobian over the product of the two adjacent edge lengths; negative means inverted | Cubit acceptable 0.5 to 1 (quads), 0.2 to 1 (triangles) [35] | Report; a negative value is an Error (a fold, section 6.4) |

## 2. How kernels parameterize meshing

### 2.1 Side by side

| Concept | OpenCascade BRepMesh [1][2][3] | Parasolid `PK_TOPOL_facet_mesh_o_t` [11] | ACIS faceter [13][14] | CGAL Mesh_3 / Surface_mesher [15][16] | gmsh [18] |
|---|---|---|---|---|---|
| Edge chordal | `Deflection` (edges are discretized with half of it [6]) | `curve_chord_tol`: "maximum permitted distance from a chord ... to the curve" | Surface tolerance applies **(unconfirmed for edges)** | `edge_distance` (`distance_bound`) | No direct option; `StlLinearDeflection` only for STL export of OCC shapes |
| Edge angular | `Angle`: angle between successive segments (half used internally [6]) | `curve_chord_ang`: sum of the two angles between chord and curve tangents at the chord ends | Normal tolerance **(unconfirmed for edges)** | none | `MeshSizeFromCurvature = N`: N elements per 2 pi radians |
| Edge max length | none | `curve_chord_max` | `max_edge_length` | `edge_size` | `MeshSizeMax` |
| Surface chordal | `DeflectionInterior` | `surface_plane_tol`: "an upper bound on the distance from a facet to the surface" | `SPASURFACETOL`: "maximum distance between a facet edge and the true surface"; negative is relative to entity size | `facet_distance`: distance between facet circumcentre and its surface Delaunay ball centre | none (size fields) |
| Surface angular | `AngleInterior`: angle between surface normals at a link's two ends (B-spline faces only, per the guide [3]) | `surface_plane_ang`: "sum of the angular deviation between the surface normal and facet planar normal at any two positions within the facet" | `SPANORMALTOL`: "maximum deviation ... between two normals on two adjacent facet nodes, in degrees" | none (`facet_angle` is a shape bound, not a normal bound) | Curvature sizing as above |
| Max element size | none | `max_facet_width` | `max_edge_length` (bounds the grid cell diagonal) | `facet_size` (radius of surface Delaunay balls) | `MeshSizeMax` |
| Min element size | `MinSize` | `min_facet_width`; tolerances may be disregarded below it | none public | `min_radius_bound`, `edge_min_size` | `MeshSizeMin` |
| Shape quality | none | `shape` (convex facets) | `grid_aspect_ratio` (grid cells only, not triangles) | `facet_angle` | algorithm choice, `Optimize`, `Smoothing` |
| Relative mode | `Relative`: edge deflection scales with edge size; face deflection from its edges | none; unset tolerances computed internally from the face box | Negative surface tolerance | none | `StlLinearDeflectionRelative`, `MeshSizeFactor` |
| Elements | triangles | `max_facet_sides` (default 3), `facet_plane_tol` for polygons | grid-based triangles **(quads unconfirmed)** | triangles | `RecombineAll`, `RecombinationAlgorithm`, `SubdivisionAlgorithm`, `Transfinite Surface` |
| Conformity across edges | one polygon per edge, shared through pcurves [3] | `match`: topology (default), geometry (gaps), trimmed | `SPAGRIDMODE` 2 inserts grid-edge intersections into the edge [13] | protecting balls on 1D features [15] | bottom-up: curves, then surfaces, "conformal mesh" [18] |
| Degeneracies | degenerated edges added by shape healing [10] | `degen`: multiple vertices (default), single vertex, averaged parameter | not public | not applicable | not documented |
| Model tolerance | "if a given value of linear deflection is less than shape tolerance then the algorithm will ... take into account the shape tolerance" [3]; face deflection at least `2 * MaxFaceTolerance` unless `ForceFaceDeflection` [4] | `min_facet_width` override | not public | not applicable | `Geometry.Tolerance` 1e-8 for geometry operations |

### 2.2 Defaults

| Kernel | Defaults |
|---|---|
| OpenCascade | `Deflection 0.001`, `Angle 0.5` rad (28.6 degrees), `DeflectionInterior` and `AngleInterior` `-1` then filled as `Deflection` and `2 * Angle`, `MinSize` filled as `max(1e-7, 0.1 * min(Deflection, DeflectionInterior))`, `Relative false`, `ControlSurfaceDeflection true`, `InternalVerticesMode true` [1][2]. Edges use `0.5 * Deflection` and `0.5 * Angle` and at least 4 points (3 segments) on conics [6] |
| Parasolid | All tolerances off; "Parasolid calculates appropriate tolerance values internally" from the face box; `max_facet_sides 3`; `shape convex`; `match topol`; `degen multiple_vxs` [11] |
| ACIS (BricsCAD) | `SPASURFACETOL -1.0` (relative), `SPANORMALTOL 15.0` degrees, `SPAMAXFACETEDGELENGTH 0.0` (off), `SPAGRIDASPECTRATIO 0.0` (off), `SPAGRIDMODE 1` (grid, no edge insertion) [13] |
| CGAL | Every criterion 0, meaning ignored; `facet_topology` vertices on surface [15] |
| gmsh | `MeshSizeMin 0`, `MeshSizeMax 1e22`, `MeshSizeFromCurvature 0` (off), `MinLineNodes 2`, `MinCircleNodes 7`, `MinCurveNodes 3`, `Algorithm 6` (Frontal-Delaunay), `RecombinationAlgorithm 1` (Blossom), `StlLinearDeflection 0.001` relative, `StlAngularDeflection 0.3` rad [18] |
| Triangle | `-q` minimum angle 20 degrees; guaranteed to terminate at 28.6 degrees or less; "often succeeds for minimum angles up to 34 degrees" [23] |

### 2.3 Mapping the angular criteria

On a circle of radius `R` cut into chords of central angle `theta`:

- OpenCascade's `Angle` (between successive segments) is `theta`. Its marching test compares the angle
  between the two half-chords at the parameter midpoint, which is `theta/2`, against `Angle/2` [5].
- Parasolid's `curve_chord_ang` (sum of the angles between chord and tangents at both ends) is
  `theta/2 + theta/2 = theta` [11].
- gmsh's `MeshSizeFromCurvature = N` gives `theta = 2 pi / N` [18].

So the edge criteria agree on circles. The surface criteria do not:

- OpenCascade `AngleInterior` and ACIS `SPANORMALTOL` bound the angle between the surface normals at
  the two ends of an element edge [8][13]. For an edge of length `h` on a sphere of radius `rho` that is
  `2 asin(h / (2 rho))`, about `h / rho`.
- Parasolid `surface_plane_ang` sums the deviation between the surface normal and the facet normal at
  two positions [11]. The README's group 2 bounds the angle between an element's normal and the surface
  normal. At a corner of a triangle with circumradius `r_c` on a sphere, that is `asin(r_c / rho)`. For an
  equilateral triangle, `r_c = h / sqrt(3)`, so the corner angle is about `0.577 h / rho`.
- So the end-normal angle is about `sqrt(3)` times the corner angle for equilateral triangles on a
  sphere. For a strip between two rulings of a cylinder, where the facet normal bisects the end
  normals, it is exactly `2` times.

### 2.4 Relative and absolute

OpenCascade's relative mode multiplies the deflection by a size derived from each edge's bounding box,
with a coefficient clamped to [0.5, 2] against the shape size. Each face then takes the mean of its
wires' deflections, raised to at least `2 * MaxFaceTolerance` [4]. The OCCT guide describes this as a
level-of-detail factor for viewers that load models of very different sizes [3]. ACIS's negative surface
tolerance is relative to the entity's scale, so a sphere gets the same number of facets whatever its
size [13]. Per-entity
relative deviation behaves like an angular criterion: small features get proportionally finer chords.
This library already has an angular criterion for that. A single model-wide absolute length is one
number a law can check, and it is what a downstream user means by "within 0.1 mm".

### 2.5 Recommended parameter set

Against the fixed `DiscretizationCriteria` and `FaceMeshingCriteria` of VOCABULARY.md:

| Field | Meaning to fix | Default to recommend | Reason |
|---|---|---|---|
| `Chordal: Number` | Maximum distance from the curve to each chord, in model units | Required from the caller; a helper converts a fraction of the model's bounding-box diagonal (0.001, as gmsh's relative STL default [18]) once per model | Absolute is checkable and unit-safe; the per-entity relative mode is replaced by `Angular` |
| `Angular: Angle` | Per segment: the sum of the angles between the chord and the curve tangents at its two ends (Parasolid's definition [11]) | 15 degrees (0.26 rad): ACIS 15 [13], OCCT suggests 12 to 20 [3], gmsh 0.3 rad [18] | A per-segment quantity makes each law range over segments, and it equals the turning angle on circles |
| `MaxLength: Limit` | Longest chord or element edge | `Unlimited` | All kernels default it off |
| `MinSegments: Integer` | A floor for conics, below which the kernel will not go | 1, with the structural floor of section 3.8 always applied | gmsh's 7 per circle is a finite-element choice [18] |
| proposed `MinLength: Number` | Refinement never creates an element edge shorter than this; it is a stop rule, reported when it wins | `max(0.1 * Chordal, LengthTolerance)` (OCCT's rule [2], floored at the file tolerance) | Without it adaptive refinement need not terminate near poles, cusps, and nearly coincident knots |
| `SurfaceChordal: Number` | Maximum distance from an element to its surface | Equal to `Chordal` (OCCT [2]) | |
| `SurfaceAngular: Angle` | The README's: maximum angle between the element normal and the surface normal at each corner | 15 degrees, documented with the conversion of section 2.3 | Keeps the README's definition but makes the factor to OCCT/ACIS settings explicit |
| `PreferQuads: Boolean` | Emit quads where section 5 allows | `false` | Triangles are what every exchange format accepts [19][20][22] |

Two rules that are not parameters. First, the effective chordal values are `max(Chordal,
LengthTolerance)`, with a diagnostic when the floor wins (OCCT does the same [3]). Second, quads
use no separate planarity tolerance: a quad is kept only if both of its diagonal splits satisfy
`SurfaceChordal` and `SurfaceAngular` (section 5.4).

## 3. Curve discretization

### 3.1 The sagitta and its inverse

A chord of a circle of radius `R` subtending a central angle `theta` has

    chord length  c = 2 R sin(theta/2)
    sagitta       s = R (1 - cos(theta/2))          ~ R theta^2 / 8 ~ c^2 / (8 R)

For a deviation bound `d`, the largest admissible angle and chord are

    theta_d = 2 acos(1 - d/R)          (for d < 2R; cap theta at 2 pi / 3, section 3.8)
    c_d     = 2 sqrt(d (2R - d))       ~ sqrt(8 R d)

The angular and length criteria give `theta_alpha = alpha` and `theta_L = 2 asin(min(1, L / (2R)))`.
Each of the three tests is monotone in `theta`. So the segment count for an arc of sweep `Theta` is

    n = max(n_floor, ceil(Theta / min(theta_d, theta_alpha, theta_L)))

with uniform spacing `Theta / n`. This is OpenCascade's `ArcAngularStep` (`2 acos(1 - d/R)` capped by the
angular deflection and floored by the minimum size [5]). It also sets OCCT's interior node spacing on
cylinders, cones (using the larger radius), spheres (times 0.7, in staggered rows), and tori [7].

Worked numbers, with `d = 0.1 mm` and `alpha = 15 degrees`:

| R | theta_d | segments per full circle (chordal) | (angular) | governs |
|---|---|---|---|---|
| 50 mm | 7.25 deg | 50 | 24 | chordal |
| 5 mm | 22.96 deg | 16 | 24 | angular |

The two criteria cross at `R* = d / (1 - cos(alpha/2))`, which is 11.7 mm here. Chordal deviation
governs large radii, angle governs small ones, so the two are complements, not alternatives.

An ellipse with semi-axes `a > b` has its smallest radius of curvature `b^2 / a` at the ends of the
major axis. Using it in the formula gives a safe uniform count. Adaptive sampling (3.3) spends fewer
points.

### 3.2 General curves: local step from curvature

For a curve with curvature `kappa(t) = |C' x C''| / |C'|^3` and radius `rho = 1/kappa`, the admissible
3D step is `h = min(2 sqrt(d (2 rho - d)), 2 rho sin(alpha/2), L)`. The parameter step is
`h / |C'(t)|`. OpenCascade's estimate is `Du = sqrt(8 d / Ln)` with `Ln = |C'' x C'| / |C'|`, which is
`sqrt(8 d rho) / |C'|` [5].

A rigorous bound replaces sampling. For a twice-differentiable curve on `[t0, t1]`, the distance from
`C(t)` to its linear interpolant, and so to the chord, is at most `(t1 - t0)^2 / 8 * max |C''|`. This is
the standard interpolation remainder; Filip, Magedson and Markot built surface algorithms on such
derivative bounds [41]. For a degree-`n` Bezier on [0, 1] with control points `P_i`,
`|C''| <= n (n-1) M` with `M = max_i |P_{i+2} - 2 P_{i+1} + P_i|`. That gives Wang's formula for the
number of uniform segments [39]:

    N = ceil( sqrt( n (n-1) M / (8 d) ) )

A second, cheaper certificate is the convex hull property. If every control point of a Bezier span
lies within `d` of the chord `P_0 P_n`, the span lies within `d` of the chord. This is the flatness test
for recursive de Casteljau subdivision.

### 3.3 Uniform, adaptive, and curvature-marching

| Method | How | Strength | Weakness |
|---|---|---|---|
| Uniform in parameter | `n` from a closed form (3.1) or a bound (Wang) | Deterministic, symmetric, provable | Over-samples where parameter speed or curvature varies |
| Adaptive bisection | Split `[t0, t1]` at its midpoint while a test fails | Fewer points; symmetric when the test is | Needs a conservative test or it can stop early (3.5) |
| Curvature marching | Step forward by `h(t) / |C'(t)|`, correcting the step at each point (OCCT `GCPnts_TangentialDeflection` [5]) | Few points, good spacing | Direction-dependent: reversing the curve gives a different polyline |

Recommendation: closed form for `Line`, `Circle`, and `Ellipse` (and their `Trimmed` forms). For
everything else, adaptive bisection inside each knot span, from a seed of `degree + 1` samples per span,
capped by the Wang or derivative bound when the span is polynomial.

### 3.4 B-spline curves

- **Knot spans first.** Seed with every distinct knot inside the edge's range. Knots of multiplicity
  `>= degree` are mandatory samples, since the curve may have a tangent discontinuity there. OCCT works
  span by span through `NbIntervals(GeomAbs_CN)` and seeds `max(degree + 1, 3)` test points per
  interval [5].
- **Per span**, the curve is a polynomial (or rational) Bezier. Polynomial spans can use Wang's count
  or control-polygon flatness after converting to Bezier form by knot insertion.
- **Rational spans** have no simple closed bound **(unconfirmed that a practical tight bound exists;
  none was found)**. Use adaptive bisection on the evaluated curve with the multi-point test of 3.5, and
  report the measured maximum.
- **Nearly coincident knots** (spans shorter than `ParameterTolerance`) produce huge derivatives and
  tiny parameter steps. Treat such a span as zero-length (merge the knots for sampling) and report it.
  `MinLength` then stops refinement.

### 3.5 Varying parameter speed and the midpoint trap

A test at the parameter midpoint is a sample, not a bound. Two failures:

1. **Non-uniform speed.** When `|C'|` varies within a step, the point of maximum deviation is not at
   the parameter midpoint, so the measured sagitta underestimates.
2. **Inflection.** An S-shaped span can pass through the chord at its midpoint, so the midpoint
   sagitta is zero while the curve deviates on both sides.

OCCT guards against the second with an angle test at the midpoint and a seeded check of
`degree + 1` points per interval before declaring a curve straight [5]. Recommendation: test at the
quarter points as well as the midpoint (three samples per candidate segment), accept a segment only
when all pass, and use the derivative bound of 3.2 wherever it is available, since it is a true
certificate.

### 3.6 Structural minimum counts

- A closed edge (start vertex equals end vertex, such as a full circle) needs at least **3 segments**.
  With 1 segment its polyline is a point; with 2 it is a digon of zero area. Either makes the adjacent
  faces degenerate and the solid flat. OCCT forces 4 points on every conic [6]; gmsh forces 7 on circles
  [18].
- A conic arc needs at least `ceil(3 * Theta / (2 pi))` segments, so that no chord spans more than a
  third of a turn and no element on a periodic face spans half a period (section 6.4).
- A loop must have **at least 3 distinct 3D points**. A loop of two edges with one segment each is a
  digon. OCCT adds a point when a face's outer wire has two edges or fewer [9]. Because edges are shared,
  this rule is applied at discretization time, from the loops that use each edge.

### 3.7 Face-aware edge refinement

The face mesher joins consecutive edge samples by straight segments **in uv**. The 3D chord is the same
for both faces, so watertightness does not depend on uv. Validity does: the uv polygon must not
self-intersect or cross another loop, and interior points placed near it must lie inside the true
region. OpenCascade therefore refines each edge against every adjacent non-planar face. It evaluates
the surface at the uv midpoint of each segment and splits the edge (at the curve-parameter midpoint)
when that point is farther than the deflection from the 3D chord, to a depth of 10 [6]. When a face's
discretized wires still self-intersect in uv, the healer divides that edge's deflection by 3 and
re-discretizes, up to 5 times, then re-meshes the affected faces [9]. Parasolid reduces its chordal
tolerance locally when inner loops lie close to the outer boundary [11].

Consequences for this design:

- `Discretize(m, e, c)` reads the pcurves of `e` in both adjacent faces and applies the same uv-chord
  test. It sits in layer 4, which may see layers 1 and 2, so the dependency rule allows this.
- `MeshFace` can still find crossing loops. The pipeline needs a bounded loop: face meshing reports the
  offending edges as diagnostics, those edges are re-discretized with tighter criteria, and both
  adjacent faces are re-meshed. OCCT's bound of 5 rounds is a reasonable default. This is a pure
  fixpoint with a counter, not a repair after the fact, so "one discretization per edge" still holds in
  the final result.

### 3.8 Symmetry under reversal

Both faces must agree on the polyline. With one discretization per edge and `Reversed(d)` reversing the
arrays, agreement holds by construction. Two cases still need the polyline to be a function of the
point set rather than of the traversal direction:

1. An edge whose `SameSense` is false runs against its curve's parameter.
2. Two distinct edges with the same geometry, from an exporter that duplicated edges, or bodies in a
   `ShellSet` that touch.

Rule: always discretize in the curve's increasing parameter, then orient by reversing the arrays.
Never recompute from the reversed curve. Prefer bisection or closed-form uniform splitting, which are
symmetric as point sets, over forward marching, which is not [5]. Compute parameters as
`t_i = t0 + (t1 - t0) * i / n` in one direction only, since recomputing from the other end differs by
rounding.

### 3.9 End points and the file tolerance

VOCABULARY.md fixes that the first and last points are the vertex points exactly. A vertex may lie up to
the file's tolerance from the curve's end. OCCT raises an edge's deflection to at least the
vertex-to-curve-end distance for that reason [4]. The edge chordal law must therefore read
`deviation <= Chordal + LengthTolerance` on the first and last segments, or the law will fail on valid
files.

## 4. Face meshing

### 4.1 The parameter region

A face's region in its surface's natural parameters is the set bounded by the uv images of its loops:

- **Outer loop and holes.** ISO 10303-42: "For a loop bounding a face with defined geometry, the cross
  product n x t points toward the interior of the face. That is, each loop runs counter-clockwise around
  the face when viewed from above, if we consider the normal n to point up" [40].
- **Periodic directions.** On a cylinder, cone, sphere (u), and torus (u and v) the region lives on a
  cylinder or torus of parameters, not in the plane.
- **Whole-period faces.** A face may wrap all the way around: "the union of the face with the edges and
  vertices of its bounding loops need not be embeddable in the plane. It may, for example, cover an
  entire sphere or torus" [40]. The region is then the full strip or rectangle.
- **Seams.** A seam edge is used twice in one loop with opposite orientations. Its two uses map to
  `u = u0` and `u = u0 + P` (`P` the period).
- **Degenerate sides.** A side of the domain that the surface collapses to a point: sphere poles, cone
  apex, a B-spline with a collapsed row of control points (`DegenerateSides` in layer 1).

### 4.2 Loops into parameter space

- **From pcurves** (`Pcurve` on the coedge's edge for this face's surface). Evaluate the pcurve at the
  edge discretization's parameters. Requires the pcurve to share the edge curve's parameterization
  ("same parameter"); OCCT checks the same-range and same-parameter flags and skips its uv refinement
  when they are false [6]. When the pcurve and curve parameters differ, map by projection or arc
  length **(the STEP practice for this is for research/STEP-BREP-MODEL.md)**.
- **By inverse evaluation** (`Project`) when pcurves are missing. Failure modes:
  - near a seam the answer jumps by a period;
  - at a pole, `u` is undefined (any `u` is correct);
  - near a singular point or a tangency, Newton iteration converges slowly or to the wrong root;
  - on a self-overlapping surface, the nearest point may be on the wrong sheet.
- **Cures**:
  - seed each projection with the previous point's uv, so the curve's continuity chooses the root;
  - unwrap periods (4.3);
  - at a pole, take `u` from the neighbouring boundary point, not from `Project`;
  - verify every result by re-evaluating `S(uv)` against the 3D point within the file tolerance.
- OCCT's shape healing lists the repairs real files need: missing pcurves (`FixAddPCurve`), 2D gaps
  (`FixGap2d`, `FixLacking`), pcurves "shifted at an integer number of periods" (`FixShifted`), missing
  seams, and 2D self-intersections [10]. Each is a case the face mesher will meet.

### 4.3 Seam unwrapping

For a loop with uv points `p_0 .. p_m` on a surface periodic in `u` with period `P`:

1. Unwrap: set `u'_0 = u_0`, then `u'_i = u_i + k_i P` with `k_i = round((u'_{i-1} - u_i) / P)`, so
   consecutive points are within half a period.
2. Winding number: `w = (u'_m - u'_0) / P` after following the loop back to its start. `w = 0` for a
   loop that does not go around; `w = +1` or `-1` for one that does, such as a circle on a cylinder
   with no seam edge.
3. Shift the whole loop by one common multiple of `P` so all loops of the face lie in one window
   `[u_s, u_s + P]`, `u_s` the face's smallest unwrapped `u`.
4. A face whose loops have nonzero winding has a region bounded by two such loops (or by one and a
   degenerate side). Its uv boundary is open at `u_s` and `u_s + P`. If the loop contains a seam edge
   (used twice), the seam closes it, and its two uses become the left and right sides of the region with
   the same sample points. If there is no seam edge, which OCCT treats as invalid and repairs by
   inserting a seam [10], the mesher synthesizes one. It is a straight uv segment at a chosen `u`
   between existing boundary points of the two loops. It is not a model edge, so vertices on it are face
   interior vertices, emitted once and used with both `u` and `u + P`.
5. A face covering both periods of a torus is the full rectangle, with each seam appearing twice.

Any uv point on `u = u_s` and the matching one on `u = u_s + P` are one mesh vertex. Face meshing must
merge them by `BoundarySource` (seam edge points) or by an explicit pairing (synthetic seam points).

### 4.4 Poles and degenerate sides

- A pole appears in uv as a segment (a degenerate side, `v = v_max` on a sphere) or as a point repeated
  in the loop. Every uv point on it maps to the same 3D point and the same mesh vertex. In STEP the pole
  may be a model vertex (the end of a seam edge) or not a vertex at all (a hemisphere bounded only by its
  equator) **(verify against research/STEP-BREP-MODEL.md)**. In the second case `BoundarySource` has no
  case for it.
- **How many uv points on a degenerate side** is free, since they cost nothing in 3D. Match them to the
  `u` values of the adjacent row of interior points, so the fan around the pole is regular.
- **Triangles with two corners on the degenerate side** collapse to a repeated index after mapping and
  are dropped. Those with one corner there form a fan around the pole. Quads in a row touching the pole
  become triangles (the UV-sphere pattern).
- **Normals.** At a sphere pole the limit normal is unique, but `NormalOr` needs a fallback because
  `S_u x S_v = 0`. At a cone apex no normal exists: each adjacent triangle needs the normal at its own
  corner's `u`. Parasolid's default creates a separate vertex for each facet at a degeneracy so that
  normals are right, and says this does not preserve topology; its single-vertex option preserves
  topology with wrong normals [11]. Per-corner normals keep both.
- **Interior singular points** (a revolution profile touching its axis inside the region, or an
  interior collapsed row of a B-spline net) are not on a domain side. Split the region along the
  singular line, or report the face **(no kernel documentation found for this case; unconfirmed)**.

### 4.5 Anisotropy

Parameter space distorts the surface metric. The length of a uv displacement `(du, dv)` is
`sqrt(E du^2 + 2F du dv + G dv^2)`, the first fundamental form, with `E = S_u . S_u`, `F = S_u . S_v`,
`G = S_v . S_v` [38]:

| Surface | E | F | G | Isometric chart |
|---|---|---|---|---|
| Plane (unit frame) | 1 | 0 | 1 | Exact |
| Cylinder, radius R | R^2 | 0 | 1 | `(R u, v)`, exact |
| Cone | `r(v)^2` (radius at `v`) | 0 | constant | Unrolled sector, exact (developable) |
| Sphere, latitude v | `R^2 cos^2 v` | 0 | R^2 | None (Gaussian curvature not zero) |
| Torus, major R, minor r | `(R + r cos v)^2` | 0 | r^2 | None |
| B-spline | general | general | general | None |

A cylinder of radius 500 mm has `u` in radians against `v` in millimetres. A triangle that is
equilateral in raw uv is about 500 times longer around the axis than along it in 3D. Remedies, in order
of cost:

1. **Global affine scaling.** Divide `u` and `v` by the mean lengths of their iso-lines over the face.
   OCCT measures the mean polygon length of three iso-lines of 20 steps each and scales uv by it before
   its Delaunay triangulation [7].
2. **Exact charts for developable surfaces.** Plane, cylinder, cone, and linear extrusion of a straight
   profile.
3. **Metric (Riemannian) meshing.** The 3D size field `M3` is pulled back to uv as
   `M2 = [S_u S_v]^T M3 [S_u S_v]`; an isotropic size `h` gives `M2 = (1/h^2) [E F; F G]`. Laug and
   Borouchaki generate a unit mesh for it "completely inside the parametric space" with an advancing
   front and a generalized Delaunay criterion [38].
4. **Judge in 3D.** Whatever chart is used, measure deviation, lengths, and angles on the lifted
   elements, as OCCT's deflection control does [8].

Recommendation: 1, 2, and 4 for the first version; 3 when B-spline quality matters.

### 4.6 Triangulation families

| Family | Input it needs | Output | Decision points | Use here |
|---|---|---|---|---|
| Structured grid | A four-sided region, no holes, matching counts on opposite sides | Quads (or triangles by splitting) | Corner choice, count matching (section 5) | Untrimmed analytic patches |
| Ear clipping with hole bridging (earcut) | A simple polygon with holes | Triangles, no Steiner points | Bridge choice, ear order; O(n^2) worst case. earcut "does not guarantee a correct triangulation on arbitrary input" and may emit T-junctions [29] | Not recommended; CDT covers its cases |
| Constrained Delaunay (CDT library, poly2tri, Triangle `-p`) | Points and non-crossing constraint segments; holes by flood fill | Triangles honouring every segment | Robust predicates; duplicate points and crossing constraints are errors (CDT [27]; poly2tri: "does not support repeat points", holes must not touch [28]) | The base triangulation of every face |
| Delaunay refinement (Ruppert, Chew; Triangle `-q`) | A CDT | Triangles with a minimum-angle guarantee | Needs Steiner points on boundary segments for its guarantee; with `-Y` "you will probably sacrifice much of the quality" [23] | Interior insertion only, with the boundary locked |
| Advancing front (paving-like, gmsh Frontal-Delaunay) | Boundary discretization and a size field | Well-shaped, boundary-aligned elements | Front collision handling; robustness on complex trims. gmsh falls back to MeshAdapt when Delaunay or Frontal-Delaunay fail [18] | A later quality option |

Recommendation: a constrained Delaunay triangulation of the uv region in the scaled chart of 4.5. Use
robust orientation and in-circle predicates (CDT uses Lenthe's [27]; Triangle Shewchuk's [24]),
CCW output, and holes removed by depth (even-odd) peeling. Then insert interior points (4.7) by Delaunay
insertion with every boundary segment locked. This is OCCT's structure (a base Delaunay, node
insertion from a range splitter, deflection control [3][8]) and Triangle's `-Y` mode [23].

### 4.7 Interior points and the deviation test

- **Seeding.**
  - Plane: none needed for deviation; points only for `MaxLength`.
  - Cylinder: columns at the closed-form `u` step of 3.1 and **no interior rows**. OCCT leaves
    `nbV = 0` because rulings are straight [7].
  - Cone: columns from the larger radius, plus a few rows whose count is the slant length over the
    column spacing, damped by a logarithm [7].
  - Sphere: rows and columns at 0.7 times the closed-form step, alternate rows shifted by half a step
    [7].
  - Torus: steps from the two radii.
  - B-spline: knot lines, then iso-line samples filtered by deflection [7]. OCCT keeps at least one
    interior parameter per direction "to prevent movement of triangle body outside the surface in case of
    highly curved ones, e.g. BSpline springs" [7].
- **Size targets on curved surfaces.** On a sphere of radius `rho`, an equilateral triangle of side
  `h` deviates at its centre by `rho - sqrt(rho^2 - h^2/3)`, about `h^2 / (6 rho)`. That is 4/3 of an
  edge's midpoint sagitta `h^2 / (8 rho)`. So interior spacing for a deviation `d` is `sqrt(6 rho d)`,
  0.87 of the edge spacing `sqrt(8 rho d)`. OCCT's 0.7 factor on spheres is in line with this.
- **Tests per element** (OCCT [8]). These sample the deviation, so they give a lower bound on it:
  - Centroid: evaluate `S` at the **uv centroid** and measure its distance to the element's plane,
    `|n_T . (S(c_uv) - a)|`. Measuring along the plane normal removes the tangential offset between
    `S(c_uv)` and the 3D centroid, which a non-uniform parameterization introduces.
  - Interior edges: evaluate `S` at the **uv midpoint** of each non-boundary edge and measure its
    distance to the 3D segment. Boundary ("frontier") links are skipped.
  - Normals: compare the surface normals at the edge's two ends against `AngleInterior`.
  - Insert the failing uv points, reject those closer than `MinLength` to existing nodes, and repeat,
    up to 11 passes. OCCT then records the measured maximum as the face's achieved deflection [8].
- **Validation needs more** than the refinement test. A one-sided Hausdorff distance from mesh to
  surface: sample each element barycentrically, project with `Project`, take the maximum (CGAL
  `approximate_Hausdorff_distance` [17]). Or a curvature or derivative bound for a certificate.
  Report the measured value in `Check.Worst`; do not claim more.

### 4.8 The boundary is locked

Refinement may add vertices only strictly inside the uv region, never on a boundary segment, and may not
move a boundary vertex. Encroached boundary segments, which Ruppert's algorithm would split, stay whole.
This is the price of the shared-edge principle, and it is why section 1.3 reports quality instead of
promising it. When a face's quality is unacceptable because its boundary is too coarse, the remedy is
upstream: tighter criteria for that edge, through the loop of 3.7. Parasolid's topology matching allows
the other choice, splitting the neighbour's facets to match [11], which this design rules out.

## 5. Quadrilaterals

### 5.1 Where structured quads are natural

A structured grid needs a region with four sides (a periodic face counts its seam twice), no holes, and
a parameterization in which the grid lines are good element edges:

| Region | Grid lines | Planar quads? |
|---|---|---|
| Planar rectangle (straight sides) | The rectangle's frame | Yes |
| Untrimmed cylinder, cone, torus patch; full-period bands | Rulings or meridians, and circles | Yes: two meridians and two parallels of a surface of revolution give an isosceles trapezoid, because the two parallel chords are both perpendicular to the bisecting meridian plane |
| Sphere patch | Meridians and parallels | Yes, same argument; the row at a pole becomes triangles |
| Surface of revolution, linear extrusion | Profile copies and rulings or circles | Yes (trapezoids, parallelograms) |
| B-spline patch, untrimmed | Iso-lines | In general no; split when the test of 5.4 fails |

So for the analytic families in `BrepSurface`, a structured grid gives exactly planar, convex quads
(up to rounding), which is the cleanest case for `QuadGridIfRectangular`.

### 5.2 Sizing the grid

The column count around a circle comes from 3.1 on the largest radius the patch reaches. The row count
along a ruling is 1 unless `MaxLength` asks for more. On a sphere or torus, rows come from the same
formula on the meridian radius. On a B-spline, use iso-line deviation as in 4.7. These counts are the
**edge** sample counts too: the grid's side rows are edge polylines.

### 5.3 The boundary must be the edge polylines

The grid's four sides are, exactly, the discretizations of the edges on those sides (via their
pcurves). Interior nodes come from transfinite (Coons) interpolation in uv:

    P(s,t) = (1-t) B(s) + t T(s) + (1-s) L(t) + s R(t)
             - [(1-s)(1-t) P00 + s(1-t) P10 + (1-s) t P01 + s t P11]

`B`, `T`, `L`, and `R` are the four side polylines and `P00` through `P11` the corners. On an analytic
patch whose sides were sampled uniformly this reduces to the tensor grid. gmsh's `Transfinite Surface`
does this on three- or four-cornered surfaces [18].

This forces **equal counts on opposite sides**:

- On a periodic face the seam edge is both side columns, so its counts match automatically.
- On a planar rectangle or an untrimmed cylinder patch, opposite sides have equal length and sweep. A
  count that is a deterministic function of curve kind, size, and sweep makes them equal.
- On a cone frustum (circles of different radius) or most B-spline patches, they differ.

What to do when they differ:

1. **Triangles** (CDT) for that face. The simplest choice and always valid.
2. **Interval assignment** before discretization: treat "opposite sides equal" as constraints across
   chains of structured faces and solve for per-edge counts near their criteria targets. Mitchell frames
   this as an integer program and adds the parity constraint that all-quad meshing needs [34]. A simple
   version takes the maximum count in each class of edges linked by "opposite side of a structured face"
   (union-find). Either way the count becomes a per-edge floor fed to `Discretize`, so the edge still
   has one discretization.
3. **Quasi-transfinite** meshing with non-matching sides (gmsh `Mesh.QuasiTransfinite` [18]), or a
   transition row of triangles. Quad-dominant, more code.

**Parity.** An all-quad mesh of a region satisfies `4Q = 2E_int + E_bnd`, so its boundary segment count
`E_bnd` must be even. A face whose boundary has an odd count needs at least one triangle.

### 5.4 Quad quality and when to split

A quad is emitted only if:

- it is convex in its mid-plane, the plane through the corner centroid with the mean corner normal
  (Parasolid's construction [11]);
- both diagonal splits satisfy `SurfaceChordal` and `SurfaceAngular`. Then it does not matter which
  split a renderer chooses, and the non-planarity is within budget with no new parameter;
- its scaled Jacobian is positive at all four corners (no fold).

Otherwise it is split. Use the diagonal whose two triangles have the larger minimum angle, or, on a
curved surface, the one whose midpoint is nearer the surface. Report skew, taper, warpage, and the
corner angles against Cubit's ranges [35].

### 5.5 Unstructured quads

| Method | Idea | Notes |
|---|---|---|
| Paving (Blacker and Stephenson, 1991) [31] | Advancing front of quad rows from the boundary | Good boundary alignment; complex front-closure rules |
| Q-Morph (Owen et al., 1999) [30] | Triangulate, then convert triangles to quads with an advancing front, recovering quad edges like Delaunay boundary recovery | "well-aligned rows of quadrilaterals parallel to the boundary" with few irregular nodes; avoids front intersection calculations |
| Recombination (Blossom-Quad, Remacle et al., 2012) [32] | Pair triangles into quads by a minimum-cost perfect matching | gmsh's default recombination [18]; full-quad variants need even boundary counts |
| Subdivision (Catmull and Clark, 1978 [33]; gmsh `SubdivisionAlgorithm 1` [18]) | Split each triangle into 3 quads and each quad into 4 | All-quad, but adds boundary vertices: every edge gains its midpoint |

Subdivision changes the edge discretizations, so for this design it is an edge-level decision (double
every edge's count), never a per-face one. Recommendation for version 1: structured grids where 5.1 and
5.3 hold, triangles elsewhere, `PreferQuads` off by default. A later version can add Blossom
recombination inside faces. It needs no boundary changes, but only gives a full quad mesh when the
boundary count is even.

## 6. Orientation

### 6.1 Conventions

- The face's normal is the surface normal `N_s` times `sigma`, where `sigma = +1` if `SameSense` is true
  and `-1` if it is false. IFC's copy of ISO 10303-42: "a BOOLEAN flag ... is used to indicate whether
  the surface normal agrees with (TRUE) or is opposed to (FALSE) the face normal direction" [40].
- Each loop runs with the face on its left, viewed from the face normal [40].
- A `FaceBound` with `Orientation` false reverses every oriented edge of its loop: "the senses of all its
  component oriented edges are implicitly reversed when used in the face" [40].
- For the natural parameterizations, take `N_s = S_u x S_v / |S_u x S_v|`. For the cylinder and the
  sphere this points away from the axis or centre. Whether ISO 10303-42's stated normal equals
  `S_u x S_v` for every surface kind must be checked case by case in `01-geometry`, and `NormalOr` is
  the one function both layers use.

### 6.2 The sign test in uv

For a small triangle `(a, b, c)` in uv:

    (b - a) x (c - a)  ~  (S_u du1 + S_v dv1) x (S_u du2 + S_v dv2)  =  (du1 dv2 - dv1 du2) (S_u x S_v)

So its 3D normal has the sign of its uv signed area
`A_uv = ((u_b - u_a)(v_c - v_a) - (u_c - u_a)(v_b - v_a)) / 2` along `N_s`. Use an exact orientation
predicate for the sign. Consequences:

- The uv triangulator emits every triangle counter-clockwise (`A_uv > 0`).
- The face emits `(a, b, c)` when `sigma = +1` and `(a, c, b)` when `sigma = -1`. Quads likewise.
- The expected signed uv area of the outer loop, after applying `FaceBound.Orientation` and the
  coedge senses, is positive when `sigma = +1` and negative when `sigma = -1`. Holes have the opposite
  sign. A planar face with surface normal `+z` and `SameSense` false must have a clockwise outer loop in
  uv.
- The triangulator can always be given counter-clockwise outer loops and clockwise holes. The region
  does not change, since the triangulator only needs the set; `sigma` alone decides the output winding.

### 6.3 Mirrored parameterizations and transforms

`axis2_placement_3d` frames are right-handed by construction (`y = z x x`) **(unconfirmed for every
placement entity; see research/STEP-BREP-MODEL.md)**. A B-spline may be parameterized either way, and
`SameSense` records the relation, so no extra rule is needed inside a model. A mirroring transform
(determinant below zero, as in an assembly placement) reverses every element's winding. glTF handles
this at the node: "if the determinant is a negative value, the front-facing triangles use the clockwise
order" [19]. USD likewise: "one must apply the opposite handedness rule" [21]. 3MF requires that such a
transform "MUST NOT change the sign of its volume" [20]. When transforms are baked into positions, flip
the winding where the determinant is negative.

### 6.4 Checks

- For each element, `((b - a) x (c - a)) . (sigma * N_s(uv_centroid)) > 0`. Zero or negative is a
  **fold**: the uv element maps to an inverted 3D element. Causes: an element too large for the
  curvature (spanning half a period, prevented by 3.6), a non-injective surface region, or a pole.
- For each closed shell, `SignedVolume > 0` and every mesh edge appears once in each direction
  (`MeshEdgeTable` parity).
- The loop-area test of 6.2 detects inverted loops on non-periodic surfaces only (section 7).

## 7. Hard cases

| Case | What goes wrong | What kernels do | Recommendation |
|---|---|---|---|
| Slivers from tiny trims | A trim curve close to another loop or edge leaves a strip narrower than the boundary spacing; with the boundary locked, triangles in it are needles | OCCT: refine edges by deflection/3 if wires self-intersect [9]; Parasolid: reduce chordal tolerance locally near close inner loops [11] | Report minimum angle; tighten the involved edges through the loop of 3.7 when the strip width is below the local boundary spacing |
| Faces smaller than the tolerance | Region of near-zero uv area; loops may touch; triangles of zero area | Parasolid `min_facet_width` disregards tolerances below it [11]; OCCT treats a wire of two tiny edges as "a kind of degenerated face" [9] | Never drop the face (its edges would become open boundaries); emit its elements, report zero-area ones as warnings |
| B-spline with degenerate control net | A collapsed row is a pole (handle as 4.4); an interior collapse is an interior singularity; normals undefined where `S_u x S_v = 0` | OCCT splits CN intervals where a normal cannot be computed [7] | `DegenerateSides` with the file tolerance; `NormalOr` fallback; report interior singularities |
| Nearly coincident knots | Tiny spans, huge derivatives, stalled refinement | OCCT works per continuity interval [5] | Merge spans shorter than `ParameterTolerance` for sampling; `MinLength` stops refinement |
| Near-tangent faces | Normals nearly continuous across the edge, harmless for topology; thin gaps between near-parallel faces can make the two meshes cross when chordal deviation exceeds half the gap | No kernel studied guarantees freedom from self-intersection; 3MF accepts self-intersecting meshes with a fill rule [20] | Report self-intersections at the `Oracle` level; document that `Chordal` must be below half the thinnest wall |
| Loops self-intersecting in uv from projection error | Zig-zag at seams and poles, wrong roots near tangencies | OCCT `FixSelfIntersection`, `FixShifted`, `FixGap2d` [10]; healer refinement [9] | Continuity-seeded projection, unwrapping, pole `u` from neighbours (4.2, 4.3); then the 3.7 loop; report what remains |
| Non-planar poly loops (faceted B-rep) | No surface to parameterize; projection to a plane may self-intersect | Not documented in the sources read | Project on the Newell-normal plane, triangulate with CDT, report the maximum distance from that plane; report failure when the projection self-intersects |
| Exporter-inverted loops | A loop's direction contradicts the face sense | OCCT orients wires "to border a limited square" [10] | On a non-periodic surface, detect with the uv area sign (6.2) and report. On a sphere or torus a loop's direction is the only thing that chooses which of two regions is the face, so it cannot be inferred locally: rely on the shell parity check (6.4) |
| Revolution profile crossing the axis | The surface self-intersects; normals flip across the axis; a pole at the crossing, possibly inside the region | Not documented in the sources read | Treat the crossing as a degenerate side when on the boundary; report and refuse when interior |
| Very large coordinates | glTF positions are float32 [19], STL REAL32 [22]: at 10^6 mm from the origin the float32 spacing is 0.0625 mm. In 32-bit `Number` (README risk) the file tolerance itself is unrepresentable. Large uv values also degrade Delaunay predicates | OCCT rescales uv to the face's range before triangulating [7] | 64-bit throughout; normalize uv to the face's box before triangulation; export positions relative to a model origin with the offset in a node transform |
| Faces with hundreds of holes | Ear clipping's bridges are O(holes * n); loop-crossing checks are O(n^2) naively; close holes give slivers | CDT handles holes by flood fill [23][27] | CDT; loop validity by a sweep or spatial hash; close-hole slivers as in the first row |
| Whole-period face with no seam edge | uv boundary open on both sides | OCCT adds the seam [10] | Synthetic seam (4.3) |

## 8. Recommendations for this design

1. Keep "one discretization per edge" and make `Discretize` read both adjacent pcurves, applying
   OCCT's uv-chord test [6], because watertightness is free but uv validity is not.
2. Give the pipeline a bounded loop (5 rounds, as OCCT [9]) in which face meshing returns edges to
   re-discretize, because some uv crossings appear only when a whole face is assembled.
3. Fix `Angular` as Parasolid's per-segment chord-tangent sum [11], because it equals the turning angle on
   circles and makes each edge law range over segments.
4. Keep the README's `SurfaceAngular` (element normal against surface normal at corners) and document its
   factor of about 1.7 to 2 against OCCT `AngleInterior` and ACIS normal tolerance, because users will
   copy values between kernels.
5. Add `MinLength` to the criteria with default `max(0.1 * Chordal, LengthTolerance)`, because adaptive
   refinement needs a stop rule near poles, cusps, and close knots (OCCT `MinSize` [2]).
6. Floor every chordal criterion at the file's `LengthTolerance` and report when the floor wins, because
   a deviation below the model's own uncertainty is meaningless (OCCT does the same [3]).
7. Allow `Chordal + LengthTolerance` on an edge's first and last segments, because vertex points are
   snapped and may sit up to the tolerance off the curve [4].
8. Expose only absolute lengths in the criteria and convert a relative request once per model, because
   one number is checkable and the angular criterion already covers small features.
9. Discretize conics in closed form with `n = max(n_floor, ceil(Theta / min(2 acos(1 - d/R), alpha,
   2 asin(L/2R))))`, because it is exact, symmetric, and the same formula sizes analytic face grids.
10. Discretize B-splines span by span with mandatory samples at knots of multiplicity at least the
    degree, adaptive bisection with three-point tests, and Wang's bound where polynomial, because
    midpoint-only tests miss inflections [5][39].
11. Apply the structural floors (3 segments per closed curve, at least a third of a turn per conic
    segment, at least 3 points per loop), because below them faces collapse.
12. Discretize in the curve's increasing parameter and orient by `Reversed`, never by recomputing,
    because only array reversal is exactly symmetric.
13. Extend `BoundarySource` with a case for a pole that is not a model vertex (for example
    `FromSingularity(Side: DomainSide)`), because STEP faces can contain poles with no vertex.
14. Make `ModelMesh.Normals` and `Uvs` per element corner, or add a corner-attribute table, because one
    vertex can carry two uv values (seam), several uv values (faces meeting at an edge), and several
    normals (crease, cone apex).
15. Triangulate every face with a constrained Delaunay triangulation in a uv chart scaled by mean
    iso-line lengths (exact charts for plane, cylinder, cone), then insert interior points with the
    boundary locked, because this is OCCT's proven structure and keeps the shared-edge principle.
16. Test each element at its uv centroid (distance to the element plane) and each interior edge at its uv
    midpoint, with spacing `sqrt(6 rho d)` on curved interiors, because centroid deviation exceeds edge
    sagitta by 4/3 [8].
17. Report minimum angle, maximum angle, radius ratio, and scaled Jacobian rather than enforcing them,
    because no guarantee survives a locked boundary [23].
18. Emit a structured quad grid only when the region has four sides, opposite counts match, and every
    quad passes the both-diagonals test of 5.4, because count mismatch and non-planarity are common
    outside analytic patches.
19. Defer interval assignment and recombination to a second version, but keep a per-edge count floor in
    `Discretize`'s inputs now, because that is where both will plug in [32][34].
20. Decide winding only from `A_uv > 0` and `SameSense`, and check folds and shell parity separately,
    because loop direction cannot be repaired locally on closed surfaces.
21. Synthesize seam and pole boundary pieces in `RegionOf`, not in decoding, because they are not model
    topology and must not appear as edges in provenance.
22. Export with `subdivisionScheme = "none"` to USD, and flip winding for negative-determinant
    transforms, because USD meshes default to Catmull-Clark [21] and mirrors invert faces [19][20].
23. Implement surface kinds in this order: plane with line and circle edges (CDT, holes, no seams);
    cylinder (seam, anisotropy, closed-form spacing, structured quads); cone (apex pole); sphere (two
    poles); torus (two seams, whole-period regions); revolution and extrusion; B-spline (adaptive
    refinement, knots); offset and rectangular-trimmed last. Each step adds exactly one new difficulty,
    and the witnesses in VOCABULARY.md already follow this order.

## 9. Open questions

1. Does the design accept the face-to-edge feedback loop (recommendation 2) as part of the pure
   pipeline, or must `DiscretizeAll` anticipate every uv conflict itself? The second has no known
   algorithm.
2. Who owns pole and seam synthesis when the STEP file has neither a seam edge nor a pole vertex:
   `05-face-meshing` alone (recommended), or a topology-repair step in `03-step` like OCCT's healing?
3. Are per-corner attributes acceptable in `ModelMesh`, given that the stdlib conversions
   (`ToTriangleMesh3D`) may expect per-vertex attributes? If not, the render export must split vertices,
   and the watertight mesh and the render mesh become two outputs.
4. What precision do rational B-spline edges need to certify, given that no closed-form deviation bound
   for rational spans was found?
5. Should `MeshingOptions` carry an optional minimum-angle refinement target, given that it cannot be
   guaranteed with a locked boundary?

## Sources

Read during this research unless marked "not opened".

1. OpenCascade, `IMeshTools_Parameters` reference and header (field defaults).
   https://occt3d.com/dev/doc/refman/html/struct_i_mesh_tools___parameters.html ;
   https://github.com/Open-Cascade-SAS/OCCT/blob/master/src/ModelingAlgorithms/TKMesh/IMeshTools/IMeshTools_Parameters.hxx
2. OpenCascade, `BRepMesh_IncrementalMesh.hxx` (`initParameters`: interior defaults, `MinSize`).
   https://github.com/Open-Cascade-SAS/OCCT/blob/master/src/ModelingAlgorithms/TKMesh/BRepMesh/BRepMesh_IncrementalMesh.hxx
3. OpenCascade user guide, Mesh. https://occt3d.com/dev/doc/overview/html/occt_user_guides__mesh.html
4. OpenCascade, `BRepMesh_Deflection.cxx` (relative deflection, face deflection, vertex mismatch).
   Same repository, `src/ModelingAlgorithms/TKMesh/BRepMesh/`.
5. OpenCascade, `GCPnts_TangentialDeflection.cxx` (`ArcAngularStep`, `EvaluateDu`, `PerformCurve`).
   `src/ModelingData/TKGeomBase/GCPnts/`.
6. OpenCascade, `BRepMesh_CurveTessellator.cxx` (half deflection, conic minimum, `splitByDeflection2d`).
7. OpenCascade, `BRepMesh_DefaultRangeSplitter.cxx`, `BRepMesh_CylinderRangeSplitter.cxx`,
   `BRepMesh_ConeRangeSplitter.cxx`, `BRepMesh_SphereRangeSplitter.cxx`,
   `BRepMesh_NURBSRangeSplitter.cxx` (uv scaling, interior node seeding).
8. OpenCascade, `BRepMesh_DelaunayDeflectionControlMeshAlgo.hxx` (centroid and link tests, frontier
   links skipped, 11 passes).
9. OpenCascade, `BRepMesh_ModelHealer.cxx` (deflection divided by 3, 5 iterations, two-edge wires).
10. OpenCascade user guide, Shape Healing.
    https://occt3d.com/dev/doc/overview/html/occt_user_guides__shape_healing.html
11. Parasolid v12.0 Functional Description, chapter 54, "Facet Mesh Generation"
    (`PK_TOPOL_facet_mesh_o_t`). http://www.q-solid.com/Parasolid_Docs/chapters/fd_chap.55.html .
    Field names are confirmed by the HOOPS wrapper:
    https://ccoderun.ca/programming/doxygen/hoops_visualize_hps/classHPS_1_1Parasolid_1_1Facet_1_1Tolerance.html .
    Newer Parasolid versions may add fields; this is the v12 text.
12. RecurDyn help, Patch Road options (Parasolid faceting settings as a UI).
    https://functionbay.com/documentation/onlinehelp/Documents/properties12.htm
13. BricsCAD system variables for the ACIS faceter: SPASURFACETOL, SPANORMALTOL,
    SPAMAXFACETEDGELENGTH, SPAGRIDASPECTRATIO, SPAGRIDMODE.
    https://help.bricsys.com/en-us/document/system-variable-reference/s/spasurfacetol-system-variable
    (and the sibling pages). ACIS's own documentation (doc.spatial.com) was not reachable.
14. TurboCAD 2018 user guide, ACIS settings (normal tolerance, surface tolerance, max edge length, grid
    lines, grid aspect ratio).
    https://docs.imsidesign.com/projects/Turbocad-2018-User-Guide-Publication/TurboCAD-2018-User-Guide-Publication/User-Interface/Drawing-Setup/ACIS/
15. CGAL 3D Mesh Generation user manual and `Mesh_facet_criteria_3`, `Mesh_edge_criteria_3`.
    https://doc.cgal.org/latest/Mesh_3/index.html
16. CGAL 3D Surface Mesh Generation (Boissonnat-Oudot guarantees, 30-degree bound).
    https://doc.cgal.org/latest/Surface_mesher/index.html
17. CGAL Polygon Mesh Processing and Surface Mesh Simplification.
    https://doc.cgal.org/latest/Polygon_mesh_processing/index.html ;
    https://doc.cgal.org/latest/Surface_mesh_simplification/index.html
18. gmsh reference manual (options, algorithms, transfinite, conformity). https://gmsh.info/doc/texinfo/gmsh.html
19. Khronos, glTF 2.0 specification (meshes, winding, degenerate triangles, float32 positions).
    https://registry.khronos.org/glTF/specs/2.0/glTF-2.0.html
20. 3MF Consortium, 3MF Core Specification, section 4.1 Meshes and section on transforms.
    https://github.com/3MFConsortium/spec_core/blob/master/3MF%20Core%20Specification.md
21. OpenUSD, `UsdGeomMesh`, `UsdGeomGprim`, and the UsdGeom overview (orientation, subdivision
    default). https://openusd.org/release/api/class_usd_geom_mesh.html
22. Wikipedia, "STL (file format)". https://en.wikipedia.org/wiki/STL_(file_format)
23. J. R. Shewchuk, Triangle instructions (`-q`, `-Y`, `-p`, holes).
    https://www.cs.cmu.edu/afs/cs.cmu.edu/project/quake/public/www/triangle.help.html ; source header
    crediting Ruppert (1995) and Chew (1993).
24. J. R. Shewchuk, "Delaunay refinement algorithms for triangular mesh generation", Computational
    Geometry 22 (2002) 21-74; and his robust predicates. Not opened.
25. J. R. Shewchuk, "What Is a Good Linear Finite Element? Interpolation, Conditioning, Anisotropy, and
    Quality Measures" (2002). https://people.eecs.berkeley.edu/~jrs/papers/elemj.pdf
26. J. Ruppert, "A Delaunay refinement algorithm for quality 2-dimensional mesh generation", Journal of
    Algorithms 18(3) (1995) 548-585; L. P. Chew, "Guaranteed-quality mesh generation for curved
    surfaces", Symposium on Computational Geometry (1993). Not opened; credited in Triangle's source
    header as the basis of its refinement.
27. A. Ogre, CDT: constrained Delaunay triangulation library. https://github.com/artem-ogre/CDT
28. poly2tri (sweep-line CDT after Domiter and Zalik, 2008). https://github.com/jhasse/poly2tri
29. Mapbox earcut README (robustness, T-junctions). https://github.com/mapbox/earcut
30. S. J. Owen, M. L. Staten, S. A. Canann, S. Saigal, "Q-Morph: an indirect approach to advancing front
    quad meshing", IJNME 44(9) (1999) 1317-1340. Abstract read via
    https://researchwith.njit.edu/en/publications/q-morph-an-indirect-approach-to-advancing-front-quad-meshing/
31. T. D. Blacker, M. B. Stephenson, "Paving: a new approach to automated quadrilateral mesh
    generation", IJNME 32 (1991) 811-847. Not opened.
32. J.-F. Remacle et al., "Blossom-Quad: a non-uniform quadrilateral mesh generator using a minimum cost
    perfect matching algorithm", IJNME 89 (2012) 1102-1119. https://www.gmsh.info/doc/preprints/gmsh_quad_preprint.pdf
33. E. Catmull, J. Clark, "Recursively generated B-spline surfaces on arbitrary topological meshes",
    Computer-Aided Design 10(6) (1978). Not opened.
34. S. A. Mitchell, "High Fidelity Interval Assignment", IJCGA (2000), and Cubit's interval matching
    documentation. https://www.sandia.gov/files/samitch/files/interval_journal.pdf
35. Sandia Cubit 16.14, "Metrics for Triangular Elements" and "Metrics for Quadrilateral Elements".
    https://cubit.sandia.gov/files/cubit/16.14/help_manual/WebHelp/mesh_generation/mesh_quality_assessment/triangular_metrics.htm
36. P. J. Frey, P.-L. George, Mesh Generation: Application to Finite Elements, 2nd ed., ISTE/Wiley,
    2008 (quality measures, parametric surface meshing). Not opened; the normalizing constant
    `sqrt(3)/6` in 1.3 is derived here so that the equilateral value is 1.
37. M. Botsch, L. Kobbelt, M. Pauly, P. Alliez, B. Levy, Polygon Mesh Processing, AK Peters, 2010
    (remeshing, triangle quality). Not opened.
38. P. Laug, H. Borouchaki, "Geometric mesh generation for composite parametric surfaces" (ECT 2012),
    https://webapp.tudelft.nl/proceedings/ect2012/pdf/laug.pdf (geometric metrics, induced metric,
    first fundamental form); H. Borouchaki, P. Laug, P.-L. George, IJNME 49 (2000) 233-259, not opened.
39. Wang's formula as implemented and documented in Skia (`WangsFormula.h`), attributed to
    R. Goldman, Pyramid Algorithms (2003).
    https://skia.googlesource.com/skia/+/c9c86fef729d/src/gpu/tessellate/WangsFormula.h
40. ISO 10303-42 definitions of face, face bound, and face surface, as reproduced in the IFC 4.3 schema
    documentation (`IfcFace`, `IfcFaceBound`, `IfcFaceSurface`).
    https://github.com/buildingSMART/IFC4.3.x-development/tree/master/docs/schemas/resource/IfcTopologyResource/Entities
41. G. Filip, R. Magedson, R. Markot, "Surface algorithms using bounds on derivatives", Computer Aided
    Geometric Design 3 (1986) 295-311. Not opened; cited for the derivative-bound approach. Related:
    L. Piegl, W. Tiller, "Geometry-based triangulation of trimmed NURBS surfaces", CAD 30(1) (1998)
    11-18, and Cripps and Parwana, CAD (2011), not opened.
