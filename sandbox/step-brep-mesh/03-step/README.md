# Layer 3: reading STEP (`03-step`)

Written 2026-10-17 for TKT-299 (the STEP B-rep to mesh design, [../README.md](../README.md)). This
layer turns the text of a STEP file (ISO 10303-21, "Part 21") into one `BrepModel` of layer 2,
in two stages:

1. `ParseStep(text): ParsedFile`: the file as data, knowing no entity.
2. `DecodeBrep(file): DecodedModel`: the data read through a schema model of the supported
   EXPRESS subset into kernel types, with a provenance map back to the file and every problem
   as a diagnostic.

Everything here follows from [research/STEP-BREP-MODEL.md](../research/STEP-BREP-MODEL.md)
("the research" below); section numbers like "research 3.8" point into it. Clause keys: P21,
P41, P42, P43 are ISO 10303-21, -41, -42, -43; AIM is the AP242 integrated schema; AIC 511 and
514 are the interpreted constructs that define `advanced_face` and
`advanced_brep_shape_representation`.

## Files

| File | Kind | Block | Holds |
|---|---|---|---|
| `step-part21.types.plato` | types | | `StepHeader`, `StepAttribute`, `StepSimpleRecord`, `StepInstanceBody`, `StepInstance`, `Part21File`, `ParsedFile` |
| `step-schema.types.plato` | types | | `AggregateForm`, `AggregateBound`, `AttributeKind`, `ValueRule`, `AttributeDefinition`, `EntityTreatment`, `EntityDefinition`, `RecordSlot`, `StepKnotSpec` |
| `step-decode.types.plato` | types | | `StepOccurrenceIndex`, `StepSource`, `StepOccurrence`, `KernelSources`, `KernelElement`, `FoldCause`, `FoldRecord`, `StepRepair`, `RepairRecord`, `ProvenanceMap`, `ContextUncertainty`, `ContextUnits`, `DecodePolicy`, `DecodedModel` |
| `step-diagnostics.types.plato` | types | | `StepDiagnosticCode`: every finding the layer emits |
| `step-part21.library.plato` | library | `Part21Reading` | `ParseStep`, `PrintStep`, `InstancePosition`, total attribute readers, structural equality `IsSameFile` |
| `step-schema.library.plato` | library | `StepSchemaModel` | table builders, entity lookup, `IsKindOf`, `FlatRecord`, `SlotOf`, field readers, conformance, `ReachableOfKind` |
| `step-schema-table.library.plato` | library | `StepSchemaTable` | `SupportedSchema`: the entity table, 225 entries (121 Decoded, 60 Ignored, 44 Unsupported) |
| `step-where.library.plato` | library | `StepWhereRules` | the EXPRESS functions WHERE rules call, restated over a `Part21File` |
| `step-diagnostics.library.plato` | library | `StepDiagnostics` | `Diagnose` (severity, code, message per code), `CodeOf`, `HasCode` |
| `step.library.plato` | library | `StepReading` | `DecodeBrep`, `DecodeBrepWith`, the policy, units and tolerance, occurrences, provenance queries |
| `step-part21.laws.plato` | laws | `Part21ReadingLaws` | the file as data |
| `step-schema.laws.plato` | laws | `StepSchemaModelLaws` | the table and a file's conformance to it |
| `step-where.laws.plato` | laws | `StepWhereRulesLaws` | one law per WHERE rule |
| `step.laws.plato` | laws | `StepReadingLaws` | the decode |
| `step.spec.plato` | spec | | type invariants, a contract for each of the 19 deferred functions and for `DecodeBrep`, 3 theorems |

Counts: 31 types; 182 library functions, 163 with bodies and 19 deferred; 162 laws; 26 `spec`
blocks (6 on types, 20 on functions) and 3 theorems. The library was split from the
`step.library.plato` the brief names into six blocks because the schema table and the WHERE
helpers are subjects of their own; the laws follow the same split.

## The file as data

The grammar, as the parser reads it (P21 5 to 7, 11, 12; edition 3 sections are skipped with a
diagnostic, research 1.4):

```
file     = "ISO-10303-21;" header data "END-ISO-10303-21;"
header   = "HEADER;" record ";" record ";" record ";" "ENDSEC;"
data     = "DATA;" { "#" digits "=" body ";" } "ENDSEC;"
body     = record | "(" record { record } ")"
record   = KEYWORD "(" [ param { "," param } ] ")"
param    = INTEGER | REAL | STRING | "." NAME "." | BINARY | "#" digits | "$" | "*"
         | KEYWORD "(" param ")" | "(" [ param { "," param } ] ")"
```

A `Part21File` is a header and two flat arenas. `Instances` holds every `#n = ...` in ascending
order of n; `Attributes` holds every parameter value, and a record holds `StepAttributeIndex`es
into it. A list or a typed parameter (`LENGTH_MEASURE(1.E-07)`) holds the indices of its items,
each smaller than its own (`Law_ChildrenPrecedeParent`). Why this shape:

- **No recursive type.** A list of lists would make `StepAttribute` contain itself, which the C#
  backend cannot lay out (PLATO-PRIMER.md D.2). Indices into one arena avoid it, as the kernel's
  flat tables do.
- **Children first.** Every reader that descends into a value (`RealOr` through a typed
  parameter, `SatisfiesBounds` through a list of lists) terminates, and the measure is the index.
- **Instances sorted by name.** Names are unique and their order in the data section carries no
  meaning (P21 11.2), so the parser sorts them; `InstancePosition` is then a binary search, and
  printing then parsing gives back the same data (`Law_ParsePrintParseIsIdentity`).
- **What is normalized, and what is kept.** Keywords are stored upper case; strings hold decoded
  text (escape directives resolved, line breaks dropped, P21 5.6). Short names, complex parts in
  the wrong order, and dangling references are kept as written: they are facts about the file,
  diagnosed, and the decoder copes with them by name, not by position.

Printing (`PrintStep`) exists so the round trip can be stated. It writes reals in the shortest
form that reads back to the same `Number`, so the round trip compares numbers exactly.

### Host obligations

The owner decided on 2026-10-17 (PLAN.md, "Decided by the owner during the pass") that STEP
parsing stays in C#: the host produces the `Part21File`, and Plato decodes it. `ParseStep`,
`PrintStep` and `NameOctetsPrecede` are therefore host obligations: bodiless declarations met
through Plato's foreign-function interface, with the signatures above unchanged. Their contracts
(`step.spec.plato`) and the laws of the file as data (`Law_ParsePrintParseIsIdentity`,
`Law_ParseOkIffNoError`, `Law_ReferencesResolve`, `Law_HeaderNamesASchema`, and the
`Part21File` invariants) stay stated here, and the host's own tests execute them: a host parser
that breaks one is wrong, whichever language it is written in. The schema model, the decode, and
every other law of this layer stay in Plato. The TypeScript backend will need the same service.

## The schema model

`SupportedSchema` is the EXPRESS subset as data: per entity its long and short names, its ISO
clause, its supertypes in SUBTYPE OF order, the explicit attributes it declares
(`AttributeDefinition`: name, element kind, aggregation levels outermost first, optional, the
defined type's rule), the inherited attributes it redeclares as DERIVE, and its treatment. Two
record shapes come out of one table: a complex instance's part holds its entity's own attributes
(`OwnRecord`, P21 12.2.5.3); a simple instance holds the flattened record, supertypes first, each
once (`FlatRecord`, P21 12.2.5.2). The research computed the flattened records of every catalogue
entity from three long-form schemas and found them equal; the first test of `FlatRecord` is to
reproduce them.

Supertypes precede subtypes in the table (`Law_SchemaSupertypesPrecede`), which makes the
supertype graph acyclic by construction. The table laws take two `Integer` positions, so the law
runner, which can only generate scalars (PLATO-PRIMER.md B.2), can run them.

`AttributeKind` is the element kind only; aggregation is a list of `AggregateBound`s on the
attribute. A recursive kind (`Aggregate(Element: AttributeKind)`) was rejected for the same
reason as a recursive attribute.

### Decision: no typed `StepEntity` sum

Decoding goes straight from `Part21File` to kernel types; WHERE rules are laws over a
`Part21File` and an instance position, reading attributes by name through the schema
(`f.FieldReal(i, "VECTOR", "magnitude", ...)`). A sum with one case per supported entity was
considered and rejected:

1. **It would restate the kernel.** About 60 typed records, one per entity, would hold the same
   data as `BrepCurve`, `BrepSurface`, `BrepEdge` and the rest, in file form. Two near-identical
   representations of every entity is the duplication Principle 4 forbids, and every new entity
   would cost a record, a case, a table entry, and a decode arm instead of a table entry and a
   decode arm.
2. **WHERE rules are not local anyway.** `axis2_placement_3d` WR4 reads two directions through
   references; `advanced_face` WR3 reads every edge's geometry. A typed record of references
   still needs the file to resolve them.
3. **Typed records buy no law-runner reach.** The WHERE laws are validity laws: a random
   `StepDirection` with zero ratios breaks direction WR1, so they run on witness files and real
   files, never on random values. A typed record holding arrays cannot be generated anyway.
4. **Complex instances have no single type.** A rational B-spline curve is five records at once;
   a typed sum would need synthetic cases for each combination the files use.

The cost is that a WHERE law names attributes as strings. `SlotOf` resolves a name through the
table, and `Law_AttributeCountMatchesSchema` and `Law_AttributeKindsMatchSchema` check every
decoded record against the same table, so a misspelled attribute name in a law makes that law
vacuous rather than wrong. A test that every name a law uses is in the table belongs with
`FlatRecord`'s tests.

## The decode as a partial function

Let **F** be the `Part21File`s that satisfy the invariants `ParseStep` ensures (names positive,
ascending and unique; every attribute index in range; children before parents). Let **D** be the
files in F in which every instance reached from a shape representation is Decoded, conforms to
the table (arity, kinds, bounds, defined-type rules), satisfies every WHERE rule, and resolves
every reference. On D, decoding is exact: one kernel element per reached instance of a kernel
kind and the provenance map a bijection; the only repairs left are for informal propositions no
WHERE rule states (a zero-length edge, a closed edge with two distinct vertices at one point,
research 6.6). `DecodeBrep` extends this to a total
function on F: an instance outside D's conditions is repaired (`StepRepair`) or skipped, and a
diagnostic names it (`Law_DecodeIsTotal`, `Law_RepairsAreDiagnosed`). No input makes it fail.

What "reached" means: the decoder follows references down from each occurrence's representation
(below), entering `definitional_representation`s (which define pcurves) and stopping at
`representation_map`s (whose target is another occurrence). Instances no occurrence reaches are
not decoded; one Info per type reports them (`InstancesUnreferenced`).

### The classification table

The table in `step-schema-table.library.plato` is the data; this is its summary. An instance is
Unsupported when any of its records is unknown or Unsupported, otherwise Ignored when any record
is Ignored, otherwise Decoded (`InstanceTreatment`). Ignored and Unsupported produce one
diagnostic per type, with the instance count as its measure, not one per instance.

| Entities | Treatment | Becomes |
|---|---|---|
| `representation_item`, `geometric_representation_item`, `topological_representation_item`, `founded_item`; `curve`, `bounded_curve`, `conic`, `surface`, `elementary_surface`, `swept_surface`, `bounded_surface`, `point`, `placement`, `vertex`, `edge`, `path`, `loop`, `face`, `connected_face_set`, `solid_model` | Decoded | supertypes: records of complex instances, and the slots their subtypes inherit |
| `representation_context`, `geometric_representation_context`, `parametric_representation_context`, `global_uncertainty_assigned_context`, `global_unit_assigned_context` | Decoded | `ContextUnits`; then `BrepModel.Unit` and `Tolerances` |
| `named_unit`, `si_unit`, `conversion_based_unit`, `length_unit`, `plane_angle_unit`, `solid_angle_unit`, `dimensional_exponents`, `measure_with_unit`, `length_measure_with_unit`, `plane_angle_measure_with_unit`, `uncertainty_measure_with_unit` | Decoded | unit factors, the length uncertainty |
| `cartesian_point`, `direction`, `vector`, `axis1_placement`, `axis2_placement_2d`, `axis2_placement_3d`, `cartesian_transformation_operator(_3d)`, `functionally_defined_transformation` | Decoded | `Point3D`, `Direction3D`, `Vector3D`, `InfiniteLine3D`, `Frame3D`, `AffineTransform3D` values inside other elements |
| `line`, `circle`, `ellipse`, `hyperbola`, `parabola`, `polyline`, `b_spline_curve` and its knot subtypes `b_spline_curve_with_knots`, `uniform_curve`, `quasi_uniform_curve`, `bezier_curve`, `rational_b_spline_curve`, `trimmed_curve`, `composite_curve`, `composite_curve_segment`, `reparametrised_composite_curve_segment`, `offset_curve_3d` | Decoded | one `BrepCurve` each (3D), or one `BrepCurve2D` inside a pcurve's definition; segments are consumed by their composite |
| `pcurve`, `bounded_pcurve`; `surface_curve`, `seam_curve`, `intersection_curve`, `bounded_surface_curve`; `definitional_representation` | Decoded | one `Pcurve` per pcurve; one `BrepCurve.OnSurface` per surface curve |
| `plane`, `cylindrical_surface`, `conical_surface`, `spherical_surface`, `toroidal_surface`, `degenerate_toroidal_surface`, `surface_of_linear_extrusion`, `surface_of_revolution`, `b_spline_surface` and its knot subtypes, `rational_b_spline_surface`, `rectangular_trimmed_surface`, `offset_surface` | Decoded | one `BrepSurface` each |
| `vertex_point`; `edge_curve`; `oriented_edge`, `seam_edge`; `edge_loop`, `vertex_loop`, `poly_loop`; `face_bound`, `face_outer_bound` | Decoded | `BrepVertex`; `BrepEdge`; `Coedge` inside a loop; `BrepLoop`; `FaceBound` inside a face |
| `face_surface`, `advanced_face`; `oriented_face` | Decoded | `BrepFace`; an orientation fold |
| `open_shell`, `closed_shell`; `oriented_open_shell`, `oriented_closed_shell` | Decoded | `BrepShell`; an orientation fold |
| `manifold_solid_brep`, `brep_with_voids`, `faceted_brep`, `shell_based_surface_model` | Decoded | `BrepBody.ManifoldSolid`, `SolidWithVoids`, `ManifoldSolid` over poly loops, `ShellSet` |
| `representation`, `shape_representation`, `advanced_brep_shape_representation`, `manifold_surface_shape_representation`, `faceted_brep_shape_representation`, `representation_relationship`, `shape_representation_relationship`, `representation_relationship_with_transformation`, `item_defined_transformation`, `representation_map`, `mapped_item` | Decoded | occurrences and their placements |
| `product_definition`, `product_definition_shape`, `shape_definition_representation`, `next_assembly_usage_occurrence`, `context_dependent_shape_representation` | Decoded | assembly placement (which component, where) |
| `product`, `product_definition_formation(_with_specified_source)`, `property_definition`, `property_definition_representation`, `product_definition_relationship`, `product_definition_usage`, `assembly_component_usage`, contexts and categories (`application_context`, `product_context`, `design_context`, ...) | Ignored, Info | nothing (the decoded subtypes inherit attributes of some) |
| presentation (`styled_item`, `presentation_style_assignment`, `colour_rgb`, layers, ...), PMI and properties (`shape_aspect`, `measure_representation_item`, `datum`, `geometric_tolerance`, ...), AP203 configuration management (`approval`, `person_and_organization`, `date_and_time`, ...) | Ignored, Info | nothing; the list is a starter, see "Left open" |
| `curve_bounded_surface`, `oriented_surface`, `surface_replica`, `curve_replica`, `offset_curve_2d`, `clothoid`, `circular_involute`, `degenerate_pcurve`, `evaluated_degenerate_pcurve`, `point_on_curve`, `point_on_surface`, `cylindrical_point`, `spherical_point`, `polar_point`, `open_path`, `oriented_path`, `vertex_shell`, `wire_shell`, `geometric_set`, `geometric_curve_set`, `geometrically_bounded_surface_shape_representation` | Unsupported, Warning | nothing; a reached one is skipped with its dependants |
| AP242 tessellated geometry: `tessellated_shape_representation` and every `tessellated_*`, `triangulated_*`, `cubic_bezier_*`, `coordinates_list`, `repositioned_tessellated_item` | Unsupported, Warning | nothing (it is a mesh, not exact geometry; the research suggested Info, the brief Warning) |
| any other keyword | Unsupported, Warning | nothing |

## Units and uncertainty

**Angles become radians once.** `ToRadians(value, radiansPerUnit)` is the one place a file angle
becomes an `Angle`; circle and ellipse parameters and their trims, cone semi-angles, every angle
of a placement-based surface, and pcurve coordinates along an angular surface direction pass
through it (research 5.1). A plane-angle factor within a relative 1e-8 of pi / 180 is snapped to
it (`SnapAngleFactor`), because files write the degree with 10 to 15 digits. Every used context's
angle unit is reported at Info, found (`AngleUnitFound`) or defaulted (`AngleUnitDefaulted`), with
radians per unit as the measure (`Law_AngleUnitIsReported`). `Law_CirclePeriodIsTwoPi` states the
outcome: a circle from a degree file has period 2 pi.

**The default plane-angle unit is the radian**, with an Info diagnostic. The standard gives no
default (research 3.1, unconfirmed); OpenCascade assumes degrees. The radian is the SI unit, every
degree file the survey saw states its unit, and a wrong guess either way would scale every angle,
so the decoder takes the coherent unit, says so, and the policy (`DecodePolicy`) lets a caller
choose degrees.

**Lengths stay in the file's unit.** `BrepModel.Unit` is the length unit of occurrence 0's
context (`Law_ModelUnitIsRootUnit`); a unit within a relative 1e-9 of 1, 1e-3, 1e-2, 0.0254 or
0.3048 metres is named, any other is `Scaled` (`ClassifyLengthUnit`). A context that names no
length unit gets the millimetre, with a Warning.

**The length tolerance** is, in order:

1. the largest stated length uncertainty among the contexts the occurrences use, each converted
   through its own unit (not the context's, research 3.1) and then to the model unit. The
   largest honours every exporter's own claim that two points coincide; a smaller one would
   judge a part exported at 0.01 mm by another part's 1e-5 mm. When the used contexts disagree,
   a Warning (`UncertaintiesDiffer`) gives largest over smallest;
2. when no used context states one, 1e-6 of the model size (the diagonal of the bounding box of
   every reached cartesian point, placed), with a Warning (`UncertaintyDefaulted`): 1e-4 mm for
   a 100 mm part, OpenCascade's default at that size. A model of one point gets 1e-7 m. The
   default is applied exactly when no used context states an uncertainty
   (`Law_UncertaintyDefaultExactlyWhenAbsent`);
3. never below `ResolutionAt(model size)` (layer 0), the smallest difference the arithmetic can
   resolve there; a Theorem file's 1e-13 mm is raised to it with a Warning.

`ModelLengthTolerance` is that rule as a body. `Tolerances.Angle` is the policy's 1e-9 rad (no
surveyed file states an angle uncertainty); `Tolerances.Parameter` is layer 0's
`ParameterFloor(length, model size)`. Uncertainties from 1e-13 mm to 0.67 mm are accepted as
written; the meshing tolerances stay separate (research 6.5).

## Closure at decode

Layer 0's `Periodicity` has a third case, `Closed(Period)`: the formula does not wrap, but the two
ends of the range are one point, so seam reasoning (wrap, unwrap, winding, edge domains) treats the
direction like a periodic one with the range's length as the period. Layer 1 decided not to
decide closure because `Domain` has no tolerance; this layer has one, so it decides here, once.

**The rule.** After the tolerances are set, every decoded curve whose formula does not wrap
(`IsPeriodic` false) and whose range is bounded gets `Closed(End - Start)` exactly when
`Eval(Start)` and `Eval(End)` coincide within `Tolerances.Length`, and stays `Aperiodic`
otherwise; every surface direction likewise, with the two opposite sides compared by layer 1's
`SidesCoincide`. An unbounded direction is never closed. Conics and angle parameters keep
`Periodic`. The laws are `Law_CurveClosureDecidedByEnds` and `Law_SurfaceClosureDecidedBySides`;
layer 0's `Law_ClosedPeriodIsRangeLength` holds by construction.

**The file's flags do not decide.** `closed_curve`, `u_closed` and `v_closed` are information
only (P42 4.5.34 NOTE 10). Taking a `.T.` at its word would wrap a curve whose ends are apart, and
every loop unwrapped across that seam would carry a jump the size of the gap; ignoring a `.F.`
on ends that coincide is what lets a closed B-spline face get its seam. A disagreement is a
diagnostic with the gap as its measure: `ClosedFlagWithoutClosure` (Warning: the face may not
mesh, and the gap says whether the tolerance is too tight) and `ClosureWithoutClosedFlag`
(Info). `.U.` never disagrees.

**Where the decision is stored** is layer 1's: the aperiodic record cases (B-spline, polyline,
trimmed, composite, and their surface forms) carry the closure the decoder decided, and `Domain`
reports it. Pcurves' 2D curves are not decided: a pcurve's range follows from its edge's (review
F4b), and its closure from its surface's periodicity.

## Assemblies

**Decision: one `BrepModel` per file, in the root occurrence's units, every placed copy of a
part decoded and placed.** An *occurrence* (`StepOccurrence`) is one placed copy of a
representation that holds B-rep items. `FindOccurrences` builds them as research 3.8 lays out:
follow `shape_definition_representation` and `shape_representation_relationship`s without a
transformation to the B-rep-bearing representation; place each `next_assembly_usage_occurrence`
through its `context_dependent_shape_representation`, deciding which side is the component from
the NAUO and which placement is which from membership, never from attribute position (exporters
swap them; `PlacementItemsSwapped` at Info); compose `mapped_item`s origin to target, to any
depth, cutting a cycle with an Error. Occurrence 0 is the first root in ascending instance order;
its context's unit is the model unit, and every occurrence's `Placement` includes the conversion
from its own unit. A placement whose linear part has a negative determinant (only a
`cartesian_transformation_operator` target can make one) is folded into orientation like an
oriented face.

The provenance key is therefore (occurrence, instance), `StepSource`: a part placed twice is
decoded twice and has two sets of kernel elements. `DecodedModel` keeps its fixed shape;
`ProvenanceMap.Occurrences` carries the placements.

The cost is meshing every copy: an assembly with 1,218 occurrences of a few parts meshes 1,218
times. The alternative, one copy per part plus a `Placements` table that the mesher instantiates,
needs a field in `DecodedModel`, `DecodeOutcome`, and `ModelMesh`; it is recorded under "Left
open" for layers 6 and 8 to decide.

## Orientation folding

The kernel has no oriented face or oriented shell. The decoder folds them, and mirroring
placements, into flags: for a face reached through an `oriented_face` with orientation f_o, a
shell with orientation s_o (every void of a `brep_with_voids` has .F.), and a placement with
determinant sign d,

    w = sigma(f_o) * sigma(s_o) * d
    BrepFace.SameSense    = sigma(same_sense) * w
    FaceBound.Orientation = sigma(orientation) * w      for every bound

where sigma maps .T. to +1 and .F. to -1. Multiplying the face's sign and every bound's sign by
the same w keeps their product, which decides on which side of each loop the face lies in its
surface's parameter plane (research 4.2): the face's point set is unchanged
(`Law_FoldPreservesInteriorSide`, theorem `FoldingKeepsFaceRegions`). With w = -1 the normal turns
over and the loops reverse, so after folding every face's bounds run counter-clockwise about its
normal and every normal points out of the material: into the void, for a void shell. Each flip is
recorded as a `FoldRecord` naming its cause and the instance that carried it; a face's flags
differ from the file's exactly when it has an odd number of records
(`Law_FoldFlipsExactlyRecorded`, `Law_FoldRecordsNameFalseFlags`). An `oriented_edge` becomes a
`Coedge` whose orientation is its own; an oriented edge nested in another (against its WR1) has
the two senses composed, with a Warning.

## Other decisions

- **Pcurves are kept, never invented.** A file's pcurves go into the `OnSurface` case of layer 1
  with their master representation; a missing `curve_3d` makes the first pcurve the master, with
  an Error (`MissingCurve3D`). Seams and poles the file does not write are layer 5's
  (`Law_PcurvesComeFromPcurveInstances`, `Law_PcurveCountMatchesInstances`).
- **Edge ranges are not decoded.** `BrepEdge` gets its vertices, curve, and `same_sense`
  (`Law_EdgeSenseCopied`); layer 2's `EdgeDomain` finds the interval by projecting the vertices.
- **Outer-bound flags are a hint.** Kept when a face has at most one `face_outer_bound`
  (`Law_OuterFlagCopiedWhenSingle`); cleared on every bound of a face with two or more, with a
  Warning (`Law_OuterFlagClearedWhenDoubled`), so layer 2's `Law_AtMostOneOuterBound` holds and
  layer 5 finds the outer loop by geometry. This changes what layer 2's comment says `IsOuter`
  records; see "Changes to the contract".
- **Shells keep their declaration.** `DeclaredClosed` is true exactly for a `closed_shell`
  (`Law_DeclaredClosedCopied`), free edges or not; the decoder warns, layer 2's
  `Law_DeclaredClosedIsClosed` judges.
- **Local repairs only**, each recorded in `ProvenanceMap.Repairs` and diagnosed: two
  `vertex_point`s within the length tolerance at one loop joint or on one edge are merged
  (`Law_MergedVerticesCoincide`); a zero-length edge on an open curve is dropped from its loops;
  an instance that cannot be decoded is skipped with its dependants. No merge across solids,
  no healing: that is OpenCascade's shape healer, and here it is layer 7's report.
- **Bounds keep their file order.** A SET's order is not data (research 2.2), but keeping it lets
  the laws pair a kernel bound with the file bound it came from.
- **A negative torus major radius is decoded as written**, with a Warning; OpenCascade takes the
  absolute value and flips the face, which would also need the face's pcurves remapped. None was
  in the survey.
- **Diagnostics are one closed sum** (`StepDiagnosticCode`) with one table (`Diagnose`), so every
  code, severity and message lives in one place and a law can ask for one (`HasCode`).

## Laws

Every law is total: positions and indices are guarded with `? :` before use. "Exact" means a
comparison of integers, Booleans, indices, sum tags, strings, or numbers copied from the file and
compared as the EXPRESS rule compares them. Severity is what a failure is reported at; the
decoder's own handling is in the diagnostics table of `step-diagnostics.library.plato`. The
validity laws (`Law_ReferencesResolve`, `Law_HeaderNamesASchema`, the schema conformance laws,
and every `Law_Where_`) are about the file and are checked by layer 7's `ValidateStep`; the rest
are about this layer's code.

#### `step-part21.laws.plato` (block `Part21ReadingLaws`)

| Law | Statement | Tolerance | Severity |
|---|---|---|---|
| `Law_ParsePrintParseIsIdentity` | Parsing a text, printing the file, and parsing the print gives the same data model. | exact | Error |
| `Law_ParseOkIffNoError` | A parse is Ok exactly when it reported no Error. | exact | Error |
| `Law_InstanceIdsPositive` | Every instance name is positive (P21 6.4.4.3: at least one non-zero digit). | exact | Error |
| `Law_InstanceIdsAscending` | Instances are stored in ascending order of name. | exact | Error |
| `Law_InstanceIdsUnique` | No instance name is used twice (P21 11.2). | exact | Error |
| `Law_InstancePositionIsExact` | InstancePosition returns the position of the instance named id, and -1 exactly when no instance has that name. | exact | Error |
| `Law_RecordIndicesInRange` | Every attribute index a record holds is an index of the arena. | exact | Error |
| `Law_ChildrenPrecedeParent` | Every value nested in another (a list item, the inner value of a typed parameter) has a smaller index than its holder: the arena is a forest stored children first, so every recursive reader terminates. | exact | Error |
| `Law_ReferencesResolve` | Every reference names an instance of the file. | exact | Warning (P21-DANGLING-REFERENCE); Error where a decoded instance needs it |
| `Law_HeaderNamesASchema` | The header names at least one schema (FILE_SCHEMA is a LIST [1:?], P21 8.2.4). | exact | Warning |

#### `step-schema.laws.plato` (block `StepSchemaModelLaws`)

| Law | Statement | Tolerance | Severity |
|---|---|---|---|
| `Law_SchemaNamesUnique` | No two entities of the table share a long name. | exact | Error |
| `Law_SchemaShortNamesUnique` | No two entities share a short name (P21 12.2.11); "" means none known. | exact | Error |
| `Law_SchemaShortNameIsNoOtherLongName` | No entity's short name is another entity's long name, so a keyword names one entity whichever form the file uses. | exact | Error |
| `Law_SchemaSupertypesPrecede` | Every supertype an entity names is in the table at an earlier position, so the supertype graph is acyclic and IsKindOf terminates. | exact | Error |
| `Law_SchemaDerivesAreInherited` | Every name an entity derives (writes as *) is an explicit attribute of one of its supertypes' records (P21 12.2.6). | exact | Error |
| `Law_AttributeCountMatchesSchema` | Every record of a decoded instance has as many attributes as its schema definition: the flat record for a simple instance, the entity's own attributes for a part of a complex one (P21 12.2.5). | exact | Error |
| `Law_AttributeKindsMatchSchema` | Every attribute value of a decoded instance conforms to its slot's kind, optionality, and derivation. | exact | Error |
| `Law_AggregateBoundsHold` | Every aggregate value of a decoded instance has an item count within its declared bounds at every level, and no repeated reference where the level is UNIQUE or a SET. | exact | Error |
| `Law_DefinedTypeRulesHold` | Every value of a decoded instance satisfies the WHERE rule of its defined type: a positive_length_measure is positive (P41), a dimension_count positive (P42 4.4.5). | exact | Error |
| `Law_ComplexPartsInStandardOrder` | The parts of a complex instance are in ascending order of long name, octet by octet (P21 12.2.5.3). | exact | Info |

#### `step-where.laws.plato` (block `StepWhereRulesLaws`)

| Law | Statement | Tolerance | Severity |
|---|---|---|---|
| `Law_Where_UncertaintyMeasureWithUnit_WR1` | uncertainty_measure_with_unit WR1 (P43 4.4.23): the value is positive. | exact | Error |
| `Law_Where_LengthMeasureWithUnit_WR1` | length_measure_with_unit WR1 (P41): the unit is a length unit. | exact | Error |
| `Law_Where_PlaneAngleMeasureWithUnit_WR1` | plane_angle_measure_with_unit WR1 (P41): the unit is a plane-angle unit. | exact | Error |
| `Law_Where_ConversionBasedUnit_WR1` | conversion_based_unit WR1 (P41, AP203 edition 2 and AP242): the unit's dimensions equal those of its conversion factor's unit. | exact | Error |
| `Law_Where_LengthUnit_WR1` | length_unit WR1 (P41): the dimensional exponents are those of length, (1, 0, 0, 0, 0, 0, 0). | exact | Error |
| `Law_Where_PlaneAngleUnit_WR1` | plane_angle_unit WR1 (P41): every dimensional exponent is zero. | exact | Error |
| `Law_Where_Direction_WR1` | direction WR1 (P42 4.5.14): at least one ratio is non-zero. | exact | Error |
| `Law_Where_Vector_WR1` | vector WR1 (P42 4.5.15): the magnitude is not negative. | exact | Error |
| `Law_Where_Axis1Placement_WR1` | axis1_placement WR1 (P42 4.5.17): the placement is three-dimensional. | exact | Error |
| `Law_Where_Axis2Placement2D_WR1` | axis2_placement_2d WR1 (P42 4.5.18): the placement is two-dimensional. | exact | Error |
| `Law_Where_Axis2Placement3D_WR1` | axis2_placement_3d WR1 (P42 4.5.19): the location is three-dimensional. | exact | Error |
| `Law_Where_Axis2Placement3D_WR2` | axis2_placement_3d WR2: the axis, when present, is three-dimensional. | exact | Error |
| `Law_Where_Axis2Placement3D_WR3` | axis2_placement_3d WR3: the ref_direction, when present, is three-dimensional. | exact | Error |
| `Law_Where_Axis2Placement3D_WR4` | axis2_placement_3d WR4: axis and ref_direction, when both present, are not parallel. | `AngleTolerance` (parameter) | Error |
| `Law_Practice_Axis2Placement3D_Orthogonal` | Practice, not an ISO rule: axis and ref_direction, when both present, are orthogonal within the tolerance; the projection repairs a skew pair, so the decoder only warns. | `AngleTolerance` (parameter) | Warning |
| `Law_Where_CartesianTransformationOperator_WR1` | cartesian_transformation_operator WR1 (P42 4.5.20): the derived scale (scale, or 1.0 when absent) is positive. | exact | Error |
| `Law_Where_CartesianTransformationOperator3D_WR1` | cartesian_transformation_operator_3d WR1 (P42 4.5.21): the operator is three-dimensional. | exact | Error |
| `Law_Where_Line_WR1` | line WR1 (P42 4.5.24): the vector has the dimension of the point. | exact | Error |
| `Law_Where_Parabola_WR1` | parabola WR1 (P42 4.5.29): the focal distance is not zero. | exact | Error |
| `Law_Where_BSplineCurve_WR1` | b_spline_curve WR1 (P42 4.5.34): the curve is also one of the four knot subtypes, which fix its knots. | exact | Error |
| `Law_Where_BSplineCurveWithKnots_WR1_DegreePositive` | b_spline_curve_with_knots WR1 (P42 4.5.35, constraints_param_b_spline 4.6.11), first condition: the degree is at least 1. | exact | Error |
| `Law_Where_BSplineCurveWithKnots_WR1_EnoughControlPoints` | b_spline_curve_with_knots WR1, second condition: there are at least degree + 1 control points. | exact | Error |
| `Law_Where_BSplineCurveWithKnots_WR1_TwoKnots` | b_spline_curve_with_knots WR1, third condition: there are at least two knot values. | exact | Error |
| `Law_Where_BSplineCurveWithKnots_WR1_KnotsIncrease` | b_spline_curve_with_knots WR1, fourth condition: the knot values strictly increase. | exact | Error |
| `Law_Where_BSplineCurveWithKnots_WR1_MultiplicitySum` | b_spline_curve_with_knots WR1, fifth condition: the multiplicities sum to degree + control point count + 1. | exact | Error |
| `Law_Where_BSplineCurveWithKnots_WR1_EndMultiplicities` | b_spline_curve_with_knots WR1, sixth condition: the first and last multiplicities lie in [1, degree + 1]. | exact | Error |
| `Law_Where_BSplineCurveWithKnots_WR1_InteriorMultiplicities` | b_spline_curve_with_knots WR1, seventh condition: every interior multiplicity lies in [1, degree]. | exact | Error |
| `Law_Where_BSplineCurveWithKnots_WR2` | b_spline_curve_with_knots WR2: the multiplicity and knot lists have the same length. | exact | Error |
| `Law_Where_RationalBSplineCurve_WR1` | rational_b_spline_curve WR1 (P42 4.5.39): one weight per control point. | exact | Error |
| `Law_Where_RationalBSplineCurve_WR2` | rational_b_spline_curve WR2 (curve_weights_positive): every weight is positive. | exact | Error |
| `Law_Where_TrimmedCurve_WR1` | trimmed_curve WR1 (P42 4.5.43): when trim_1 has two values, one is a point and the other a parameter. | exact | Error |
| `Law_Where_TrimmedCurve_WR2` | trimmed_curve WR2: the same for trim_2. | exact | Error |
| `Law_Where_CompositeCurve_WR1` | composite_curve WR1 (P42 4.5.44): an open curve has exactly one discontinuous transition, at its last segment, and a closed curve none; equivalently no segment before the last is discontinuous. | exact | Error |
| `Law_Where_CompositeCurveSegment_WR1` | composite_curve_segment WR1 (P42 4.5.45): the parent curve is bounded. | exact | Error |
| `Law_Where_ReparametrisedCompositeCurveSegment_WR1` | reparametrised_composite_curve_segment WR1 (P42 4.5.46): the parameter length is positive. | exact | Error |
| `Law_Where_OffsetCurve3D_WR1` | offset_curve_3d WR1 (P42 4.5.55): the basis curve and the reference direction are three-dimensional. | exact | Error |
| `Law_Where_Pcurve_WR1` | pcurve WR1 (P42 4.5.47): the definitional representation has exactly one item. | exact | Error |
| `Law_Where_Pcurve_WR2` | pcurve WR2: that item is a curve. | exact | Error |
| `Law_Where_Pcurve_WR3` | pcurve WR3: that item is two-dimensional. | exact | Error |
| `Law_Where_DefinitionalRepresentation_WR1` | definitional_representation WR1 (P43 4.4.4): its context is a parametric_representation_context. | exact | Error |
| `Law_Where_SurfaceCurve_WR1` | surface_curve WR1 (P42 4.5.49): curve_3d is three-dimensional. | exact | Error |
| `Law_Where_SurfaceCurve_WR2` | surface_curve WR2: the master representation is pcurve_s1 only when the first associated geometry is a pcurve. | exact | Error |
| `Law_Where_SurfaceCurve_WR3` | surface_curve WR3: the master representation is pcurve_s2 only when the second associated geometry is a pcurve. | exact | Error |
| `Law_Where_SurfaceCurve_WR4` | surface_curve WR4: curve_3d is not a pcurve. | exact | Error |
| `Law_Where_SeamCurve_WR1` | seam_curve WR1 (P42 4.5.51): there are two associated geometries. | exact | Error |
| `Law_Where_SeamCurve_WR2` | seam_curve WR2: both lie on the same surface instance. | exact | Error |
| `Law_Where_SeamCurve_WR3` | seam_curve WR3: the first associated geometry is a pcurve. | exact | Error |
| `Law_Where_SeamCurve_WR4` | seam_curve WR4: the second associated geometry is a pcurve. | exact | Error |
| `Law_Where_IntersectionCurve_WR1` | intersection_curve WR1 (P42 4.5.50): there are two associated geometries. | exact | Error |
| `Law_Where_IntersectionCurve_WR2` | intersection_curve WR2: they lie on distinct surface instances. | exact | Error |
| `Law_Where_ConicalSurface_WR1` | conical_surface WR1 (P42 4.5.61): the radius is not negative. | exact | Error |
| `Law_Where_DegenerateToroidalSurface_WR1` | degenerate_toroidal_surface WR1 (P42 4.5.64): the major radius is below the minor radius. | exact | Error |
| `Law_Where_BSplineSurface_WR1` | b_spline_surface WR1 (P42 4.5.72): the surface is also one of the four knot subtypes. | exact | Error |
| `Law_Where_BSplineSurfaceWithKnots_WR1` | b_spline_surface_with_knots WR1 (P42 4.5.73): constraints_param_b_spline holds in u. | exact | Error |
| `Law_Where_BSplineSurfaceWithKnots_WR2` | b_spline_surface_with_knots WR2: constraints_param_b_spline holds in v. | exact | Error |
| `Law_Where_BSplineSurfaceWithKnots_WR3` | b_spline_surface_with_knots WR3: the u multiplicity and knot lists have the same length. | exact | Error |
| `Law_Where_BSplineSurfaceWithKnots_WR4` | b_spline_surface_with_knots WR4: the v multiplicity and knot lists have the same length. | exact | Error |
| `Law_Where_RationalBSplineSurface_WR1` | rational_b_spline_surface WR1 (P42 4.5.77): the weights have the shape of the control points, row for row. | exact | Error |
| `Law_Where_RationalBSplineSurface_WR2` | rational_b_spline_surface WR2: every weight is positive. | exact | Error |
| `Law_Where_RectangularTrimmedSurface_WR1` | rectangular_trimmed_surface WR1 (P42 4.5.80): u1 and u2 differ. | exact | Error |
| `Law_Where_RectangularTrimmedSurface_WR2` | rectangular_trimmed_surface WR2: v1 and v2 differ. | exact | Error |
| `Law_Where_RectangularTrimmedSurface_WR3` | rectangular_trimmed_surface WR3: usense is (u2 > u1), unless the basis is a non-planar elementary surface or a surface of revolution (closed in u, where a trim may wrap). | exact | Error |
| `Law_Where_RectangularTrimmedSurface_WR4` | rectangular_trimmed_surface WR4: vsense is (v2 > v1), unless the basis is a sphere or a torus (closed in v). | exact | Error |
| `Law_Where_OrientedEdge_WR1` | oriented_edge WR1 (P42 5.5.6): the element is not itself an oriented edge. | exact | Error |
| `Law_Where_Path_WR1` | path WR1 (P42 5.5.9, path_head_to_tail 5.6.18): each oriented edge ends at the same vertex instance the next one starts at. | exact | Error |
| `Law_Where_EdgeLoop_WR1` | edge_loop WR1 (P42 5.5.15): the loop closes: the first oriented edge starts at the same vertex instance the last one ends at. | exact | Error |
| `Law_Where_Face_WR1` | face WR1 (P42 5.5.19, mixed_loop_type_set 5.6.16): poly loops are not mixed with other loop kinds among a face's bounds. | exact | Error |
| `Law_Where_Face_WR2` | face WR2 (P42 5.5.19): a face has at most one face_outer_bound. | exact | Warning (flags cleared) |
| `Law_Where_FaceSurface_WR1` | face_surface WR1 (P42 5.5.20): the face geometry is not an oriented_surface. | exact | Error |
| `Law_Where_OrientedFace_WR1` | oriented_face WR1 (P42 5.5.21): the element is not itself an oriented face. | exact | Error |
| `Law_Where_OrientedClosedShell_WR1` | oriented_closed_shell WR1 (P42 5.5.29): the element is not itself an oriented closed shell. | exact | Error |
| `Law_Where_OrientedOpenShell_WR1` | oriented_open_shell WR1 (P42 5.5.27): the element is not itself an oriented open shell. | exact | Error |
| `Law_Where_ShellBasedSurfaceModel_WR1` | shell_based_surface_model WR1 (P42 6.4.44): every shell is an open or a closed shell (no vertex or wire shells). | exact | Error |
| `Law_Where_AdvancedFace_WR1` | advanced_face WR1: the face geometry is exactly one of an elementary surface, a B-spline surface, or a swept surface. | exact | Error |
| `Law_Where_AdvancedFace_WR2` | advanced_face WR2: every oriented edge of every edge loop has an edge_curve as its element. | exact | Error |
| `Law_Where_AdvancedFace_WR3` | advanced_face WR3: every edge geometry is exactly one of a line, a conic, a polyline, a surface curve, or a B-spline curve. | exact | Error |
| `Law_Where_AdvancedFace_WR4` | advanced_face WR4: both vertices of every edge are vertex_points on cartesian_points. | exact | Error |
| `Law_Where_AdvancedFace_WR5` | advanced_face WR5: no edge loop is an oriented_path. | exact | Error |
| `Law_Where_AdvancedFace_WR6` | advanced_face WR6: a swept surface's swept curve is a line, a conic, a polyline, or a B-spline curve. | exact | Error |
| `Law_Where_AdvancedFace_WR7` | advanced_face WR7: a vertex loop's vertex is a vertex_point on a cartesian_point. | exact | Error |
| `Law_Where_AdvancedFace_WR8` | advanced_face WR8: every bound is an edge loop or a vertex loop (no poly loops). | exact | Error |
| `Law_Where_AdvancedFace_WR9` | advanced_face WR9: a surface_curve edge geometry has only pcurves as associated geometry, no bare surfaces. | exact | Warning (curve_3d used) |
| `Law_Where_AdvancedFace_WR10` | advanced_face WR10: a polyline used as edge geometry or as a swept curve has at least three points. | exact | Error |
| `Law_Where_AdvancedBrepShapeRepresentation_WR1` | advanced_brep_shape_representation WR1 (AIC 514): every item is a manifold solid B-rep, a faceted B-rep, a mapped item, or a placement. | exact | Error |
| `Law_Where_AdvancedBrepShapeRepresentation_WR2` | advanced_brep_shape_representation WR2: at least one item is a solid or a mapped item. | exact | Error |
| `Law_Where_AdvancedBrepShapeRepresentation_WR3` | advanced_brep_shape_representation WR3: every face of every shell of every solid is an advanced_face. | exact | Error |
| `Law_Where_AdvancedBrepShapeRepresentation_WR4` | advanced_brep_shape_representation WR4: no solid's outer shell is an oriented_closed_shell. | exact | Error |
| `Law_Where_AdvancedBrepShapeRepresentation_WR5` | advanced_brep_shape_representation WR5: every void of a brep_with_voids has orientation .F. | exact | Error |
| `Law_Where_AdvancedBrepShapeRepresentation_WR6` | advanced_brep_shape_representation WR6: every mapped item maps another advanced_brep_shape_representation. | exact | Error |
| `Law_Where_FacetedBrepShapeRepresentation_WR1` | faceted_brep_shape_representation WR1 (AIM): every item is a faceted B-rep, a mapped item, or a placement. | exact | Error |
| `Law_Where_FacetedBrepShapeRepresentation_WR3` | faceted_brep_shape_representation WR3: every face is a face_surface on a plane whose position's location is a cartesian_point. | exact | Error |
| `Law_Where_FacetedBrepShapeRepresentation_WR4` | faceted_brep_shape_representation WR4: every face has exactly one face_outer_bound. | exact | Error |
| `Law_Where_FacetedBrepShapeRepresentation_WR5` | faceted_brep_shape_representation WR5: no outer shell is oriented. | exact | Error |
| `Law_Where_FacetedBrepShapeRepresentation_WR6` | faceted_brep_shape_representation WR6: every void has orientation .F. | exact | Error |
| `Law_Where_ManifoldSurfaceShapeRepresentation_WR1` | manifold_surface_shape_representation WR1 (AIM): every item is a shell-based surface model, a mapped item, or a placement. | exact | Error |
| `Law_Where_ManifoldSurfaceShapeRepresentation_WR2` | manifold_surface_shape_representation WR2: at least one item is a surface model or a mapped item. (The research gives WR1 and WR2 together; this split is unconfirmed). | exact | Error |
| `Law_Where_ManifoldSurfaceShapeRepresentation_WR4` | manifold_surface_shape_representation WR4: every shell is an open shell, a closed shell, or an oriented closed shell (not an oriented open shell). | exact | Error |
| `Law_Where_ManifoldSurfaceShapeRepresentation_WR5` | manifold_surface_shape_representation WR5: every face is a face_surface. | exact | Error |
| `Law_Where_ManifoldSurfaceShapeRepresentation_WR6` | manifold_surface_shape_representation WR6: every face is an advanced face or its geometry passes msf_surface_check. | exact | Error |
| `Law_Where_ManifoldSurfaceShapeRepresentation_WR7` | manifold_surface_shape_representation WR7: every bound is an edge loop or a vertex loop. | exact | Error |
| `Law_Where_ManifoldSurfaceShapeRepresentation_WR8` | manifold_surface_shape_representation WR8: every edge is an edge_curve. | exact | Error |
| `Law_Where_ManifoldSurfaceShapeRepresentation_WR9` | manifold_surface_shape_representation WR9: every edge geometry is a B-spline curve, conic, curve replica, line, offset curve, pcurve, polyline, or surface curve. | exact | Error |
| `Law_Where_ManifoldSurfaceShapeRepresentation_WR10` | manifold_surface_shape_representation WR10: every edge geometry passes msf_curve_check. | exact | Error |
| `Law_Where_ManifoldSurfaceShapeRepresentation_WR11` | manifold_surface_shape_representation WR11: every vertex is a vertex_point. | exact | Error |
| `Law_Where_ManifoldSurfaceShapeRepresentation_WR12To14` | manifold_surface_shape_representation WR12 to WR14: every vertex geometry is a cartesian point, a degenerate pcurve, a point on a curve, or a point on a surface. | exact | Error |
| `Law_Where_MappedItem_WR1` | mapped_item WR1 (P43 4.4.11): a mapped item does not reach itself. | exact | Error |
| `Law_Where_RepresentationMap_WR1` | representation_map WR1 (P43 4.4.18): the mapping origin is founded in the mapped representation's context. | exact | Error |
| `Law_Where_RepresentationRelationshipWithTransformation_WR1` | representation_relationship_with_transformation WR1 (P43 4.4.21): the two representations are in different contexts. | exact | Error |
| `Law_Where_RepresentationRelationshipWithTransformation_WR2` | representation_relationship_with_transformation WR2: with an item_defined_transformation, transform_item_1 is in rep_1's context and transform_item_2 in rep_2's. | exact | Info (direction taken from membership) |
| `Law_Where_ShapeRepresentationRelationship_WR1` | shape_representation_relationship WR1 (AIM): one side is a shape_representation. | exact | Error |

#### `step.laws.plato` (block `StepReadingLaws`)

| Law | Statement | Tolerance | Severity |
|---|---|---|---|
| `Law_DecodeIsTotal` | Whatever the file, every index of the decoded model is in range (layer 2's Law_IndicesInRange): no instance makes decoding fail; whatever cannot be decoded is left out and diagnosed. | exact | Error |
| `Law_DecodedTolerancesWellFormed` | Whatever the file, the decoded tolerances are positive and finite. | exact | Error |
| `Law_RepairsAreDiagnosed` | Every repair has a diagnostic about its instance. | exact | Error |
| `Law_ProvenanceCoversModel` | Every kernel element has exactly one source: each table of the map is as long as the model's. | exact | Error |
| `Law_ProvenanceSourcesDistinct` | No two kernel elements share a source: the map is injective. | exact | Error |
| `Law_ProvenanceLookupInvertsSources` | Looking a source up gives back the kernel element it is the source of: KernelOf inverts the map's forward tables. | exact | Error |
| `Law_SourceKindMatchesTable` | The source of every kernel element is an instance of that table's kind: a vertex comes from a vertex_point, a face from a face_surface, a pcurve from a pcurve, and so on (TableKinds). | exact | Error |
| `Law_RepairedSourcesAreUnmapped` | A repaired source has no kernel element of its own. | exact | Error |
| `Law_ReachedInstancesAreAccountedFor` | Every instance an occurrence reaches that decodes to a kernel element of its own (ProducesKernelElement) is mapped or repaired: the map covers every decoded instance, so it is a bijection between them and the kernel elements. | exact | Error |
| `Law_VertexCountMatchesInstances` | One BrepVertex per reached vertex_point not merged into another. | exact | Error |
| `Law_EdgeCountMatchesInstances` | One BrepEdge per reached edge_curve not dropped. | exact | Error |
| `Law_LoopCountMatchesInstances` | One BrepLoop per reached edge_loop, vertex_loop or poly_loop. | exact | Error |
| `Law_FaceCountMatchesInstances` | One BrepFace per reached face_surface (advanced_face included). | exact | Error |
| `Law_ShellCountMatchesInstances` | One BrepShell per reached closed_shell or open_shell that is not an oriented shell. | exact | Error |
| `Law_BodyCountMatchesInstances` | One BrepBody per reached manifold solid B-rep (brep_with_voids and faceted_brep included) or shell-based surface model. | exact | Error |
| `Law_CurveCountMatchesInstances` | One BrepCurve or BrepCurve2D per reached curve that is not a pcurve: basis curves, composite segments' curves, and the 2D curves inside pcurve definitions each get their own entry, never nested. | exact | Error |
| `Law_PcurveCountMatchesInstances` | One Pcurve per reached pcurve: the file's pcurves are kept, and none is invented (Law_PcurvesComeFromPcurveInstances). | exact | Error |
| `Law_SurfaceCountMatchesInstances` | One BrepSurface per reached surface. | exact | Error |
| `Law_CirclePeriodIsTwoPi` | Angles are radians after decoding, whatever the file's plane-angle unit: a kernel curve decoded from a circle has period 2 pi within tol, in a file whose angle unit is the degree as in any other. | `ParameterTolerance` (parameter) | Error |
| `Law_CurveClosureDecidedByEnds` | A decoded curve whose formula does not wrap is Closed exactly when its range is bounded and its ends coincide within the length tolerance. | `Tolerances.Length` of the model | Error |
| `Law_SurfaceClosureDecidedBySides` | A decoded surface direction whose formula does not wrap is Closed exactly when it is bounded and its opposite sides coincide within the length tolerance (SidesCoincide). | `Tolerances.Length` of the model | Error |
| `Law_AngleUnitIsReported` | Every used context's plane-angle unit is reported at Info: found, or defaulted by the policy. | exact | Error |
| `Law_UncertaintyDefaultExactlyWhenAbsent` | The uncertainty default is applied exactly when no used context states a length uncertainty. | exact | Error |
| `Law_ToleranceCoversStatedUncertainties` | The model's length tolerance is at least every stated uncertainty of a used context, converted to the model unit (within the policy's unit-match tolerance, the rounding of the conversion). | `DecodePolicy.UnitMatch` (relative 1e-9) | Error |
| `Law_ModelUnitIsRootUnit` | The model's length unit is that of the first root occurrence's context; every other occurrence is converted to it. | exact | Error |
| `Law_EdgeSenseCopied` | An edge keeps the same_sense of its edge_curve; its parameter range is not in the file and layer 2 derives it (EdgeDomain). | exact | Error |
| `Law_PcurvesComeFromPcurveInstances` | Every kernel pcurve comes from a pcurve instance of the file: the decoder invents none (seams and poles are face meshing's). | exact | Error |
| `Law_DeclaredClosedCopied` | A shell is declared closed exactly when the file wrote a closed_shell; whether it is closed is layer 2's Law_DeclaredClosedIsClosed. | exact | Error |
| `Law_OuterFlagClearedWhenDoubled` | A face with two or more face_outer_bounds (face WR2 broken) has no bound marked outer: the flag is a hint, and a contradictory hint is dropped. | exact | Error |
| `Law_OuterFlagCopiedWhenSingle` | On a face with at most one face_outer_bound, bound j is marked outer exactly when the file wrote it as a face_outer_bound. | exact | Error |
| `Law_MergedVerticesCoincide` | A merged vertex lies within the length tolerance of the vertex it was merged into. | `Tolerances.Length` of the model | Error |
| `Law_FoldPreservesInteriorSide` | Folding preserves the point set of every face: for every bound, the product of the face's and the bound's signs is the file's. | exact | Error |
| `Law_FoldFlipsExactlyRecorded` | Folding flips exactly the recorded faces: a face's same_sense differs from the file's exactly when the map records an odd number of folds for it. | exact | Error |
| `Law_FoldRecordsNameFalseFlags` | Every fold record names an instance that carries the flip: an oriented_face or oriented shell whose orientation is .F., or an occurrence whose placement is mirrored. | exact | Error |

Rules of the brief that map to laws: the round trip, `Law_ParsePrintParseIsIdentity`; references
resolve, `Law_ReferencesResolve`; no repeated name, `Law_InstanceIdsUnique`; attribute counts,
`Law_AttributeCountMatchesSchema`; the WHERE rules, the `Law_Where_` laws (the
`axis2_placement_3d` orthogonality the brief names is `Law_Practice_Axis2Placement3D_Orthogonal`,
since ISO's WR4 asks only that the two directions not be parallel, which
`Law_Where_Axis2Placement3D_WR4` states with the same tolerance); counts per kind, the nine
`Law_*CountMatchesInstances`; the bijection, `Law_ProvenanceSourcesDistinct`,
`Law_ProvenanceLookupInvertsSources`, `Law_ReachedInstancesAreAccountedFor` (theorem
`ProvenanceIsBijection`); totality, `Law_DecodeIsTotal`; radians, `Law_CirclePeriodIsTwoPi`;
folding, `Law_FoldPreservesInteriorSide` and `Law_FoldFlipsExactlyRecorded`; the uncertainty
default, `Law_UncertaintyDefaultExactlyWhenAbsent`.

## Left open

- **The default plane-angle unit.** Radians here, degrees in OpenCascade, silence in the
  standard as far as the research read it. A file could be classified by evidence (a cone
  semi-angle above pi / 2 is impossible in radians) and a Warning given; not designed.
- **Assemblies meshed per copy** (above). Layers 6 and 8 decide whether to add a placements
  table.
- **Rules the research did not distil.** The text of `msf_surface_check` and `msf_curve_check`
  (deferred as `PassesMsfSurfaceCheck`, `PassesMsfCurveCheck`); `manifold_surface_shape_representation`
  WR3 and `faceted_brep_shape_representation` WR2, which no law states; the split of
  `manifold_surface_shape_representation` WR1 from WR2 and of WR12 to WR14 (one law,
  `..._WR12To14`). All need the AIM long form.
- **`seam_edge.pcurve_reference`** says which pcurve of a seam a use takes. `Coedge` has no
  pcurve field, so the decoder cannot pass it on; layer 5 assigns seam pcurves by the rule of
  research 4.3. None was in the survey.
- **`degenerate_pcurve` vertex geometry** is Unsupported; the research suggests evaluating it at
  the pcurve's start. None was in the survey.
- **The Ignored list** covers the presentation, PMI and AP203 management entities common in
  files; AP242 has many more, each of which now draws a Warning. Whether an unknown keyword
  should be Info instead is the owner's call.
- **Pcurve coordinates in degree files.** Whether exporters that assign degrees write pcurve u
  coordinates in degrees is unconfirmed (research 5.1); the decoder follows P42 4.2.3 and
  converts them.
- **`Number` width.** At 32 bits, the tolerance floor `ResolutionAt` is 0.19 at magnitude 1e5,
  coarser than most stated uncertainties; the design assumes 64 bits (PLAN.md question 1).

## Implementation notes

- **Parser.** A host obligation (see "Host obligations"): a hand-written lexer and
  recursive-descent parser in the host language (C# first, TARGET-LANGUAGE.md), possibly the IFC
  reader's Part 21 code in `deps/bim-open-data` that the owner's separate agent is assessing: Part 21 is LL(1) once tokenized, and a parser generator
  would add a dependency for no gain. It runs in one pass over the text, building the arena
  children first, then sorts instances by name and checks references. Plato's `String` has
  literals and `==` only, so `ParseStep`, `PrintStep` and `NameOctetsPrecede` are host code.
  Leniency follows research 1.2 and 6.6: lower-case keywords, `.5`, values where `*` is
  required, line breaks inside strings, short names.
- **Cost.** Parsing is linear in the text and the sort O(n log n) in instances; the survey's
  largest set was 6.3 million instances over 103 files, the NASA file 44 MB. Decoding is linear
  in the instances each occurrence reaches, so an assembly costs its number of copies times its
  part sizes. The bodies written here are specifications, not implementations: `EntityPosition`
  scans the table and `SupportedSchema` rebuilds it per call; an implementation keeps one table
  and a keyword-to-entity hash map, memoizes `FlatRecord`, and resolves the provenance map's
  reverse lookup by the sorted `ByInstance`.
- **Laws need witnesses.** Every law over a `Part21File` holds arrays, so the runner cannot
  generate inputs; the schema-table laws (Integer positions) are the exception. Small
  hand-written Part 21 witnesses of research 8.3, one per flag combination (a cylinder with a
  seam, as a band, and split; a sphere with poles as loop vertices, with vertex loops, and as a
  hemisphere pair; each in radians and degrees, with and without pcurves; a hollow box; a
  mirrored mapped item), exercise every law of this layer and are the cheapest regression tests.

## Test files

From research section 8, the corpus starts with:

| File | Source | Exercises |
|---|---|---|
| `block.stp` | STEP Tools AP203 samples (ACIS) | 6 planar faces, `intersection_curve` on bare planes (advanced_face WR9), degrees, placements without `ref_direction` |
| `moon_buggy_asm.stp` | STEP Tools AP203 (Unigraphics 10.5) | vertex loops on a sphere, a torus and a cone; mapped-item assembly; extrusion and B-spline faces; inch and degree; a torus with major below minor |
| `as1_pe.stp` | STEP Tools AP203 (Pro/ENGINEER) | context-dependent assembly, inch, degree, per-part uncertainty |
| `turbine.stp` | STEP Tools AP203 (Unigraphics 13) | 1,241 faces, cone semi-angles in degrees, no seams |
| `bull.stp` | STEP Tools AP203 (CADDS) | quasi-uniform and rational B-spline faces |
| `clip.stp` | STEP Tools AP203 (CATIA V4) | short names, faceted B-rep with poly loops |
| `cubcylso.stp` | STEP Tools AP203 (CATIA V4) | 0.1 mm uncertainty |
| `as1-ec-214.stp` | STEP Tools AP214 (CAS.CADE) | every edge a surface curve with two pcurves, master `PCURVE_S2` |
| `io1-tc-214.stp` | STEP Tools AP214 (Theorem) | surfaces of revolution, 1e-13 mm uncertainty, non-unit directions |
| `as1-ug-214.stp` | STEP Tools AP214 (Unigraphics 16) | assembly, degree |
| `screw.step`, `linkrods.step` | OpenCascade `data/step` (Euclid) | seam curves with two pcurves, tori, cones with seams, rational B-spline faces, line breaks in strings |
| NIST CTC-01 to CTC-05, FTC-06 to FTC-11 | NIST MBE PMI test cases | one geometry from five exporters; CTC-02 and CTC-04 form an assembly; PMI to ignore |
| `SHO/NORA-B101.step`, `SHO/IRIS-W1x1.step`, `SHO/ELLA-W1.STEP`, `SHO/NINA-B222-W1x2.STEP`, `SHO/c211_case_with_odin_v1.step`, `SHO/ODIN-W260.STEP`, `SHO/THEO-P173.STEP`, `POS/ANN-MB2.step`, `SHO/BMD-301.STEP`, `SHO/JODY-W3.STEP`, `CEL/LENA-R8.STEP`, `SHO/M2-JODY-W377-00C_PCIE-UART.step` | u-blox 3D-Step-Models-Library, already on this machine (research 8.2) | seams, vertex-loop poles, 8,386 pcurves, a `seam_curve`, Autodesk seams without pcurves, `brep_with_voids`, two outer bounds, out-of-order complex units, metre units, closed shells with free edges, lines with magnitude 1000, degree units, 1,218 occurrences |
| `rassor_shrinkwrap.stp` | NASA 3D Resources (Creo) | size (13,394 faces), voids, degrees |

## Changes to the contract

| Old | New | Reason |
|---|---|---|
| `ProvenanceMap`: "`StepInstanceId` to kernel index and back" | keyed by `StepSource` (occurrence, instance); fields `Occurrences`, `Sources: KernelSources`, `ByInstance`, `Folds: Array<FoldRecord>`, `Repairs: Array<RepairRecord>`; reverse lookup `KernelOf` returns a `KernelElement` | a part placed twice in an assembly is decoded twice, so the instance alone is not a key; repairs (merged vertices, dropped edges, skips) are needed for the counts to be exact |
| (none) | `StepOccurrenceIndex`, declared here with `// belongs-in: 00-foundation` | the typed index of an occurrence; every other typed index is layer 0's |
| `StepHeader { Description; Name; Schema; ... }` | ten fields: `Description`, `ImplementationLevel`, `Name`, `TimeStamp`, `Author`, `Organization`, `PreprocessorVersion`, `OriginatingSystem`, `Authorization`, `Schema` | completed from P21 8.2.2 to 8.2.4 as the contract asked |
| `Part21File` | adds the invariant that `Instances` are in ascending `Id` order | binary-search lookup and a canonical form for the round trip |
| `AttributeKind` | the element kind only; aggregation levels are `AttributeDefinition.Aggregates: Array<AggregateBound>`; new `AggregateForm`, `AggregateBound`, `ValueRule`, `EntityTreatment`, `RecordSlot`, `StepKnotSpec`; `EntityDefinition` gains `ShortName`, `Clause`, `Supertypes`, `Derives`, `Treatment` | no recursive kind (PLATO-PRIMER.md D.2); the treatment column is the decode's domain as data |
| proposed typed `StepEntity` sum | not introduced | see "Decision: no typed `StepEntity` sum" |
| `DecodeBrep(file)` | unchanged, now `DecodeBrepWith(file, DecodePolicy.StandardPolicy)`; new `DecodePolicy`, `DecodeBrepWith` | the defaults for what a file leaves out are data a caller can change |
| (none) | `ContextUnits`, `ContextUncertainty`, `ResolveContexts` | units and uncertainty per context, honest about what was stated |
| (none) | `StepDiagnosticCode`, `Diagnose`, `CodeOf`, `HasCode` | one table for every code this layer writes into `Diagnostic.Code` |
| `FaceBound.IsOuter` "records that the file wrote face_outer_bound" (layer 2's comment) | as written, except false on every bound of a face that has two or more | a contradictory hint is dropped so `Law_AtMostOneOuterBound` holds after decode |
| layer 8 `ParseOutcome { Ok; File; Diagnostics }` | proposal: layer 8 reuses `ParsedFile`, which has the same fields | one declaration of one shape |
| (none) | `IntegerTotal`, declared here with `// belongs-in: 00-foundation` | layer 6 declares the same function; two identical overloads are ambiguous once both layers compile together |
| names used from lower layers beyond the fixed list | layer 0: `ResolutionAt`, `ParameterFloor`, `Coincident`, `IsWellFormed`, `IsError`, `IsPeriodic`, `PeriodOr`, `Corresponds`, `Identical`, `Unmeasured`; layer 2: `ScaleToMetres` | these should become fixed names, or this layer breaks when they are renamed |
