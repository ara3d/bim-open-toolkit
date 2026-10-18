# STEP B-rep to mesh: a library design in Plato

Started 2026-10-17 under TKT-299. A design, not an implementation: the types, concepts, function
signatures, laws, and checks that a library needs to read the exact boundary representation in a
STEP file (ISO 10303) and produce triangle or quadrilateral meshes that satisfy stated constraints,
together with the means to prove that they do. Algorithm bodies are deferred on purpose. The aim is
that when implementation starts, every rule is already written down, in Plato where Plato can say
it, and in the small specification DSL of [SPEC-DSL.md](SPEC-DSL.md) where it cannot.

The library is comparable to the read-and-tessellate half of a B-rep kernel. Editing geometry is out
of scope for now; the design keeps the door open by never baking "read-only" into a type.

## How to read this folder

| Document | What it holds |
|---|---|
| [PLAN.md](PLAN.md) | How this design pass was run: phases, agents, their inputs and outputs, and what "done" means for a design |
| [SPEC-DSL.md](SPEC-DSL.md) | The specification language: what is real Plato, what is invented, and the exact meaning of every invented construct |
| [SPEC-EXECUTION.md](SPEC-EXECUTION.md) | How the specification language becomes executable: validate, prove, generate tests; the architectures weighed (new Plato syntax, a separate language, convention plus tooling) and the staged path recommended |
| [PLATO-SPEC-EXTENSIONS.md](PLATO-SPEC-EXTENSIONS.md) | The language extension proposal distilled from SPEC-EXECUTION.md: each construct (invariants, sealing, contracts, laws, theorems, witnesses, generators, the new expression forms) with what it is, why it exists, and how the library uses it |
| [TARGET-LANGUAGE.md](TARGET-LANGUAGE.md) | Which Plato backend to implement on first (C#, C++, TypeScript, Rust), with the state of each backend measured, and what `Number`'s width should be |
| [VOCABULARY.md](VOCABULARY.md) | The shared contract between layers: layer order, the names each layer exports, the stdlib names reused, and the naming rules |
| [PLATO-PRIMER.md](PLATO-PRIMER.md) | Plato as the design needs it: declaration forms, the law convention, the stdlib vocabulary to reuse, and the language limits that shape the design |
| `research/` | Distilled source material: the STEP entity model, meshing requirements, validation mathematics, lessons from the existing IFC mesher |
| `NN-<layer>/` | One folder per layer, bottom up. Each has a `README.md` stating the layer's mathematics and decisions, then `.plato` files |
| [TASKS.md](TASKS.md) | The implementation order that falls out of the design: chunks, dependencies, and the laws each chunk must make pass |

Inside a layer folder, file kinds follow the Plato stdlib convention plus two of our own:

| File | Content | Checked by |
|---|---|---|
| `*.concepts.plato` | interfaces (type classes) | the real Plato front end, in principle |
| `*.types.plato` | product and sum types | the real Plato front end, in principle |
| `*.library.plato` | functions: a body where the body is the specification, bodiless with a `// deferred:` note where an algorithm is still to be written | the real Plato front end, in principle |
| `*.laws.plato` | `Law_*` Boolean functions (universally quantified statements), `Witness_*` example builders, `Oracle_*` independent reference computations | the real Plato front end, in principle; the law runner once bodies exist |
| `*.spec.plato` | the invented constructs: type invariants, function contracts, theorems with their justification | reading, until a checker exists |

"In principle" means: the files are written to parse and resolve against the Plato stdlib at the
commit named in [VOCABULARY.md](VOCABULARY.md). Whether the design pass actually ran the front end
over them is recorded in [PLAN.md](PLAN.md) under Phase 3.

## The problem, from first principles

A solid is a bounded region of space whose boundary is a closed, oriented 2-manifold. A STEP file
describes that boundary exactly: as faces, each the image of a region of a two-dimensional parameter
domain under a smooth surface map; the region bounded by loops of edges, each edge the image of an
interval under a curve; adjacent faces sharing edges as point sets, edges sharing vertices. Nothing
in the file is approximate except the coordinates themselves, and the file states how approximate
those are (its `uncertainty_measure_with_unit`).

A mesh is a piecewise-linear approximation of that boundary: vertices with positions, elements
(triangles, quadrilaterals) that are flat, and a map back to the exact model saying which face each
element approximates and where on the model each vertex sits. "Commonly expected constraints" split
into three groups, and the design keeps them separate because they are checked by different means:

1. **Topological.** The mesh is a closed, oriented 2-manifold when the model is; it has the same
   Euler characteristic; mesh edges along model edges are shared by both adjacent faces, so there
   are no T-junctions and no duplicated boundary vertices. These are exact, integer statements, and
   the design arranges for them to hold by construction (one discretization per model edge,
   consumed by both faces) and then checks them anyway.
2. **Geometric.** Every mesh vertex lies on the model within the model's own tolerance; the chordal
   deviation between an element and the surface is below a stated length; the angle between an
   element's normal and the surface normal is below a stated angle; no element is longer than a
   stated length. These are approximate statements and every one of them names its tolerance.
3. **Quality.** No degenerate or near-degenerate elements (a minimum angle, a maximum aspect
   ratio), quadrilaterals planar and convex within tolerance. These are preferences with thresholds,
   reported rather than enforced, except where a degenerate element would break group 1.

Validation then has three sources of truth that are independent of the meshing code: the file's own
structure (ISO 10303-42 WHERE rules, Euler-Poincare), the exact geometry (a vertex can be re-evaluated
on its surface; a planar or analytic face has a closed-form area), and theorems about closed
triangulated surfaces (the sum of angle defects of a closed mesh is 2 pi times its Euler
characteristic). A meshing result is accepted when all three agree.

## The layers

Bottom up; a layer may name only itself and the layers above it in this table. Details and the
exported names are in [VOCABULARY.md](VOCABULARY.md).

| Layer | Folder | Holds |
|---|---|---|
| 0 | `00-foundation` | tolerances as types, parameter ranges and periodic domains, typed indices, diagnostics and reports |
| 1 | `01-geometry` | the exact curve and surface zoo of ISO 10303-42 as closed sum types, their natural parameterizations, evaluation, derivatives, inverse evaluation, and the laws that bind them |
| 2 | `02-topology` | vertices, edges, coedges, loops, faces, shells, solids as flat tables with typed indices; the well-formedness, manifold, orientation, and Euler-Poincare laws; the geometry-to-topology coupling laws |
| 3 | `03-step` | the Part 21 file as data, the EXPRESS subset as a schema model, decoding into kernel types, units and the file's tolerance |
| 4 | `04-discretization` | one polyline per model edge under chordal, angular, and length criteria; the sharing principle |
| 5 | `05-face-meshing` | loops into parameter space with seams and poles, the trimmed region, constrained triangulation, surface-driven refinement, structured quads where the region is a rectangle, lifting back to space |
| 6 | `06-mesh` | the assembled mesh with provenance, its topology queries, quality metrics, conversions to the stdlib mesh types |
| 7 | `07-validation` | the checker: per-layer validators, cross-layer checks, oracles, conformance levels, the test corpus and generators |
| 8 | `08-pipeline` | the stages as pure functions with result records, the options, the end-to-end function, and the pipeline laws |

## Decisions made before the layers were written

These were fixed in Phase 0 so that parallel authors would not diverge. Each is argued in the layer
README that owns it; this list exists so a reader can see the shape at once.

- **Closed sums for geometry, interfaces for operations.** Plato interfaces are type classes with
  no heterogeneous collections, and the STEP geometry zoo is finite. So `BrepCurve` and
  `BrepSurface` are sum types, and every algorithm is an exhaustive `match`: adding a surface kind
  is a compile error in every function that forgot it. Interfaces describe what an operation needs
  (evaluate, differentiate, project), and the sum types implement them.
- **Flat tables and typed indices, never nesting.** A STEP file is a flat table of instances that
  reference each other by number. The kernel keeps that shape: `BrepModel` holds arrays of
  vertices, edges, coedges, loops, faces, shells, solids, curves, and surfaces, and every reference
  is a typed index. Composite and trimmed curves reference their basis curve by index. This avoids
  recursive types, makes STEP decoding a near-isomorphism, and makes "every index in range" the
  first law of every layer.
- **Natural parameterization, not the unit square.** STEP trims, pcurves, and seams are expressed
  in each surface's natural parameters (an angle in radians around a cylinder, a length along it).
  The kernel evaluates in those parameters. Conversion to the stdlib's unit-square surfaces is an
  explicit `To*` function, never implicit.
- **The file's tolerance is the tolerance.** The `uncertainty_measure_with_unit` of the geometric
  context is the model's notion of coincidence. Every "equal" between points in the model reads it.
  Meshing criteria (chordal, angular, length) are separate and user-supplied.
- **One discretization per edge.** Watertightness is not repaired after the fact; it holds because
  both faces adjacent to an edge consume the same polyline, one of them reversed. Vertices are
  indexed in the order model vertices, then edge interiors, then face interiors, so provenance is
  recoverable from the index alone.
- **Every law names its tolerance; exact equality only on integers, indices, and tags.**
- **Nothing is a flag that could be a proof.** "Closed shell" is a checked property, following
  the stdlib's `brep.concepts.plato`; a type that promises an invariant lists it in a `spec` block
  and is produced only by a function whose contract ensures it.
- **Diagnostics, never exceptions.** Every stage returns a record with a validity field and an
  array of diagnostics, each carrying a provenance (a STEP instance number, a kernel index, a mesh
  element). A STEP file that uses an entity the design does not cover produces a diagnostic and
  the rest of the model is still meshed.
- **No OpenCascade, in the library or its tests** (owner, 2026-10-17). The STEP reader is this
  library's own, and validation rests on the mathematical oracles (closed-form and Green's-theorem
  areas, Euler-Poincare, signed volume, re-evaluation from provenance), on witnesses with known
  counts and measures, and on public files with published properties. The research documents cite
  OpenCascade's reader and mesher only as information about how an existing importer behaves.

## Relation to the Plato stdlib

`stdlib/geometry/brep.*.plato` already holds a faceted B-rep v1 (`Brep3D` with `BrepEdgeUse`,
`BrepLoop`, `BrepFace`, line edges, planar and bilinear faces, a `Validate`, and a full-grid
`Tessellate`). Its comments anticipate curved cases as new sum cases and a proof-carrying closed
subtype. This design is the v2 that those comments point at. Where a v1 name has the same meaning it
is kept (`EdgeOrientation`, `BrepEdgeUse`, `BrepLoop`); where v2 needs more (a face's `SameSense`,
pcurves on coedges, vertex loops, shells and solids) the type grows or a sibling appears. The exact
reconciliation is a task in [TASKS.md](TASKS.md), not something this sandbox does to the stdlib.

## Risks found while designing

- **Number precision.** `docs/SEMANTICS.md` in the Plato repository says `Number` is 32-bit in every
  current backend; `primitives.plato` says 64-bit. A B-rep kernel needs 64-bit: coordinates of a
  building in millimetres already exceed the 24-bit mantissa, and B-spline knot arithmetic is worse.
  The design is written for a real-number `Number`; the first implementation task confirms what the
  C# backend emits and, if it is `float`, the owner decides between a `Double` primitive and a wider
  `Number`. See the open questions in [PLAN.md](PLAN.md).
- **`&&` and `||` do not short-circuit** in Plato. Laws that guard an index before using it are
  written with the conditional expression, never with `&&`. SPEC-DSL.md states the rule once.
- **No generic sums**, so no `Option<T>`. Partial results use the stdlib's three sanctioned styles
  (`CONVENTIONS.md`, "Partial operations"). The pipeline's result records follow style 2.

## Status

Design pass complete, 2026-10-17. All nine layers are written, reviewed by a fresh mathematical
reviewer (layers 0 to 6) and by the authors of layers 7 and 8 reading downward, fixed in a wave of
125 commits, and name-reviewed: every name declared once, no upward reference, no stand-in left.
The Plato front end over the whole folder, stdlib `brep.*` excluded, reports
`PASS: 0 error(s) in scope; 6710 functions type-checked`. [TASKS.md](TASKS.md) orders the
implementation into eight chunks; seven of its eight test modules need no STEP parser. The C#
parser is `Ara3D.IO.StepParser` in a separate effort (`docs/plans/step-reader.md`); it meets this
design through the adapter specified in [adapter/ADAPTER-SPEC.md](adapter/ADAPTER-SPEC.md), with
five text fixtures and their expected `Part21File` values.

Open: `reviews/FINDINGS.md` F-1 (string-typed STEP, on hold by the owner), F-45 to F-48 (what the
adapter spec and the reviews left to the first implementation chunks), and the owner's questions in
[PLAN.md](PLAN.md) (`Number` width, the v1 stdlib reconciliation, where the library and gate
driver live). See [PLAN.md](PLAN.md) for the phase log, and each layer's README for what it
decided and what it left open.
