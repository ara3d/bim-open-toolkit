# Reading STEP geometry in C# the way IFC is read

Written 2026-10-17 at the owner's request: read the geometry in STEP (`.stp`/`.step`) files with the existing
Ara 3D C# STEP parser, following the pattern proven for IFC, where Parakeet generates the typed schema layer from
the EXPRESS grammar in an explicit unit test. Serves workflow 3 (a picture of the model) and workflow 4 (a STEP
node pack), the same workflows as TKT-299. Tickets: TKT-301 (spike) to TKT-305, and the question TKT-306.

## The IFC pattern

| Piece | Where | Schema-specific? |
|---|---|---|
| Tokenizer: file to `StepDocument` of definitions and tokens | `deps/ara3d-sdk/src/Ara3D.IO.StepParser` | no |
| EXPRESS grammar | `deps/parakeet/Parakeet.Grammars/ExpressGrammar.cs` | no |
| Generator, an explicit NUnit test `IfcCodeGenTest.TestGenerate` | `deps/bim-open-data/tools/Ara3D.IfcTypeGen` | IFC names in output |
| Generated descriptors (`IfcAttribute<T>` with the attribute's position in the STEP line) | `deps/bim-open-data/src/data/Ara3D.IfcTypes/*.g.cs` | yes |
| `IfcEntity`: one definition plus its document | `deps/bim-open-data/src/data/Ara3D.Ifc.Entities` | no, apart from the name |
| Readers, for example `MeshHelpers.ReadNumber(surface, IfcBSplineSurface.Instance.UDegree)` | `deps/bim-open-data/src/data/Ara3D.Ifc.Mesher` | yes |
| Geometry kernel: `SurfaceMap`, B-spline evaluation, Earcut | `deps/bim-open-data/src/data/Ara3D.MeshKernel` | no |

IFC's geometry entities are ISO 10303-42 entities with an `Ifc` prefix, so a generated `Ara3D.StepTypes` makes a
STEP reader look nearly line for line like the IFC one.

## Gaps

1. **Schema file.** `deps/parakeet/input/exp` holds only `IFC2X3.exp`, `IFC4.exp`, `IFC4X3.exp`. The AP242 long-form
   EXPRESS schema has to be added; its redistribution terms are unchecked. AP203, AP214 and AP242 share the Part 42
   and Part 43 entities, so one AP242 layer covers geometry for files of all three.
2. **Grammar and generator.** AP242 uses EXPRESS that IFC does not: `SUPERTYPE OF (a ANDOR b)` (the grammar's
   `SupertypeHeader` accepts only `ONEOF` or a list), several supertypes (`GetEntitySubType` keeps the first, and a
   C# class has one base), extensible and `BASED_ON` selects. Attribute indices must come from walking every
   supertype in EXPRESS order rather than from one base class.
3. **Complex instances.** `#10=(BOUNDED_SURFACE()B_SPLINE_SURFACE(...)B_SPLINE_SURFACE_WITH_KNOTS(...)RATIONAL_B_SPLINE_SURFACE(...)...);`
   carries every rational B-spline and every unit (`(LENGTH_UNIT()NAMED_UNIT(*)SI_UNIT(.MILLI.,.METRE.))`).
   `StepTokenizer.AdvanceToAndTokenizeDefinition` reads one name then one group and throws "Expected the beginning
   of a group" on the first complex instance, so `StepDocument` opens no STEP file that has one: 0 of 88 in the
   spike (build log, 2026-10-17). `StepDefinition` needs a list of partial entities, and a descriptor addresses an
   attribute as (partial entity, index within it).
4. **The `name` offset.** Every STEP `representation_item` begins with a `name` string that IFC dropped, so every
   index differs by one and the IFC readers cannot be pointed at STEP data. Generation handles it; the readers are new.

## What is reused, generalized, and new

- Reused: the tokenizer (after gap 3), `ExpressGrammar` (after gap 2), `Ara3D.MeshKernel`.
- Generalized: one generator for IFC and STEP. The IFC output stays byte-identical, which is the regression test.
- New: STEP readers over the generated types that feed the same kernel. Anything in `FaceSetBuilder` that is not
  reading moves into `MeshKernel` first, so IFC and STEP share it (TKT-250 is the earlier extraction).
- STEP only: the assembly tree (`NEXT_ASSEMBLY_USAGE_OCCURRENCE`, `CONTEXT_DEPENDENT_SHAPE_REPRESENTATION`,
  `ITEM_DEFINED_TRANSFORMATION`), colours from `STYLED_ITEM`, and cones, spheres and tori, which the IFC mesher
  flattens to a fitted plane (`sandbox/step-brep-mesh/research/EXISTING-MESHER-LESSONS.md`, step 4).

## Chunks

| Ticket | Chunk | Repository |
|---|---|---|
| TKT-301 | Spike: parse the AP242 long form with `ExpressGrammar` and count failures; tokenize real AP242 files and count mangled complex instances | throwaway, outside the repository |
| TKT-302 | Complex instances in `Ara3D.IO.StepParser`, then move the pin | ara3d-sdk |
| TKT-303 | Grammar and generator cover AP242; IFC output byte-identical | parakeet, bim-open-data |
| TKT-304 | Generate `Ara3D.StepTypes`; a test asserts the indices of ten Part 42 entities | bim-open-data |
| TKT-305 | STEP readers, units, assembly tree, meshing tests | bim-open-data |

## Open decisions (TKT-306)

- Does this C# route replace the Plato library of TKT-299 (`sandbox/step-brep-mesh`), or run beside it as the
  working path while the specification continues? TKT-300 is the same generated-types idea for Plato, which the
  owner set aside on 2026-10-17.
- `PROJECT.md` does not mention STEP. The working guess is product models (equipment, fixtures) shown with the
  building in the 3D view.

## Pivot: geometry in Plato (owner decision, 2026-10-17)

The owner's intent was to reuse the C# reader and parser and write the geometry algorithms in Plato
(TKT-306). The split:

| Stage | Language | Where | Ticket |
|---|---|---|---|
| Parse Part 21, diagnostics, header | C# | ara3d-sdk `Ara3D.IO.StepParser` | TKT-302, TKT-310 (done) |
| Typed AP242 layer | C# (generated) | bim-open-data `Ara3D.StepTypes`, `Ara3D.Step.Entities` | TKT-303, TKT-304 (done) |
| Decode into the Plato library's `RawDecodedModel` (the B-rep as written; units in mm and radians) | C# | `Ara3D.Step.Mesher/Decode` | TKT-312 |
| `PrepareModel`: closure, mirror folds, tolerance floors, reduction repairs, model size | Plato | `sandbox/step-brep-mesh` layer 3 | TKT-299 (a small chunk replacing D and E) |
| Units, placements, mapped items, assemblies, colours, entry point | C# | `Ara3D.Step.Mesher/Model`, `StepMesher` | TKT-305 |
| Geometry: discretization, face meshing, mesh assembly, validation | Plato, compiled to C# | `sandbox/step-brep-mesh` layers 1, 2, 4 to 8 | TKT-299 chunks, TKT-313 |

The boundary moves from `Part21File` to `BrepModel`, so decoding happens in compiler-checked
generated C# instead of by string name in Plato (finding F-1; TKT-300 is not needed). The Plato
library's decode chunks D and E are replaced by TKT-312. The C# geometry builder (TKT-305 part A) was
stopped before it committed anything. The kernel fixes TKT-308 and TKT-309 stay: they serve the IFC
mesher, which remains in C#. First risk to retire: TKT-311, whether Plato's C# writer compiles the
library's constructs today.

## Build log

- 2026-10-17: plan and tickets written.
- 2026-10-17, TKT-301 spike, tokenizer half. Corpus: the 88 files of the u-blox 3D-Step-Models-Library
  (`3d-format-shootout/data/submodules/3D-Step-Models-Library`, outside this repository): 82 `AUTOMOTIVE_DESIGN`
  (AP214), 6 `CONFIG_CONTROL_DESIGN` (AP203). A throwaway console program over `Ara3D.IO.StepParser` (ara3d-sdk
  pin of this date) opened none: all 88 throw "Expected the beginning of a group" at the first complex instance.
  Every file has complex instances, because units and the geometric representation context are always written as
  one. Only 11 distinct combinations occur in all 88 files, counted by a regex over `#n=(...)` lines:

  | Instances | Files | Partial entities |
  |---|---|---|
  | 70,085 | 88 | LENGTH_UNIT NAMED_UNIT SI_UNIT |
  | 69,919 | 88 | GEOMETRIC_REPRESENTATION_CONTEXT GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT GLOBAL_UNIT_ASSIGNED_CONTEXT REPRESENTATION_CONTEXT |
  | 69,918 | 88 | NAMED_UNIT SI_UNIT SOLID_ANGLE_UNIT |
  | 69,918 | 88 | NAMED_UNIT PLANE_ANGLE_UNIT SI_UNIT |
  | 15,129 | 81 | REPRESENTATION_RELATIONSHIP REPRESENTATION_RELATIONSHIP_WITH_TRANSFORMATION SHAPE_REPRESENTATION_RELATIONSHIP |
  | 9,818 | 2 | GEOMETRIC_REPRESENTATION_CONTEXT PARAMETRIC_REPRESENTATION_CONTEXT REPRESENTATION_CONTEXT |
  | 1,683 | 35 | BOUNDED_CURVE B_SPLINE_CURVE B_SPLINE_CURVE_WITH_KNOTS CURVE GEOMETRIC_REPRESENTATION_ITEM RATIONAL_B_SPLINE_CURVE REPRESENTATION_ITEM |
  | 650 | 19 | CONVERSION_BASED_UNIT LENGTH_UNIT NAMED_UNIT |
  | 434 | 24 | BOUNDED_SURFACE B_SPLINE_SURFACE B_SPLINE_SURFACE_WITH_KNOTS GEOMETRIC_REPRESENTATION_ITEM RATIONAL_B_SPLINE_SURFACE REPRESENTATION_ITEM SURFACE |
  | 44 | 1 | CONVERSION_BASED_UNIT NAMED_UNIT PLANE_ANGLE_UNIT |
  | 1 | 1 | MASS_UNIT NAMED_UNIT SI_UNIT |

  The set is small and closed, so TKT-304 can generate one accessor per combination as well as the general
  (partial entity, index) descriptor. The assembly placements (`SHAPE_REPRESENTATION_RELATIONSHIP` with
  transformation, 81 files) are complex instances too, so TKT-305's assembly tree depends on TKT-302.
- 2026-10-17, TKT-301 spike, schema half. The three long forms come from the MBx-IF EXPRESS schema page
  (<https://www.mbx-if.org/home/?p=613>), which states no licence, so they are never committed:
  `deps/bim-open-data/data/get-express-schemas.ps1` fetches them into the git-ignored `deps/bim-open-data/data/express/`
  (AP242 edition 3 v1.152, 2,392,527 bytes; AP214 edition 3 2010, 860,508; AP203 edition 2, 665,100). A throwaway
  program split each with `ExpressGrammar.EntityBlocks` and `TypeBlocks`, as `IfcCodeGenTest` does, and parsed every
  block with `Entity` or `TypeDecl`:

  | Schema | ENTITY blocks | TYPE blocks | Fail | Entities with several supertypes |
  |---|---|---|---|---|
  | AP242 ed3 | 2,140 | 464 | 0 | 238 |
  | AP214 ed3 | 915 | 192 | 0 | 63 |
  | AP203 ed2 | 1,006 | 240 | 0 | 92 |
  | IFC4X3 (reference) | 872 | 439 | 0 | 0 |

  Every block parses, so TKT-303's grammar work is smaller than planned. Parsing is not reading correctly: the
  generator's `GetEntitySubType` keeps the first supertype, so 238 AP242 entities lose inherited attributes and
  their indices are wrong. The spike did not check that the parse trees of `ANDOR` supertype expressions or of
  redeclared attributes are right; TKT-303 checks them against the attribute tables of
  `sandbox/step-brep-mesh/research/STEP-BREP-MODEL.md` section 3.
- 2026-10-17, TKT-302 done in ara3d-sdk f48f62b: complex instances parse; the u-blox 88 open with definition
  counts equal to those written; four IFC files (duplex, AC20-FZK-Haus, AC20-Institute-Var-2, large_test_model)
  dump byte-identical definitions before and after the change. The comparison also showed that the published
  NuGet package Ara3D.IO.StepParser 1.6.1 reads `-1.` as 1: TKT-307. Correction, same day: inside the toolkit the
  IFC projects build the parser from `deps/ara3d-sdk` source (bim-open-data's `Directory.Build.targets` rewrites SDK
  package references into project references), so they already run both fixes; only standalone clones and nuget.org
  users had 1.6.1. Ara3D.SDK 1.6.2 is being published for them. With the TKT-302 parser built from source,
  Ara3D.Ifc.Tests passes 38, fails 0, skips 11 (49 in all), including the new `NegativeNumberTests`.
- 2026-10-17, TKT-305 preparatory chunk, bim-open-data 2b4104b: the schema-free half of `FaceSetBuilder` moves into
  `Ara3D.MeshKernel` as `public static FaceDrop? AddFace(this WeldedMeshBuilder mesh, SurfaceMap map,
  IReadOnlyList<Vector3> outer, IReadOnlyList<IReadOnlyList<Vector3>> holes, bool sameSense)` (`Faces/FaceMesher.cs`;
  `FaceRingTriangulation`, `FaceDrop` and `WeldedMeshBuilder` beside it). The IFC mesher keeps the reading and the
  diagnostics; Ara3D.Ifc.Mesher.Tests pass 164 before and after.
- 2026-10-17, TKT-308, bim-open-data 02bb175: the congruent-ring band refuses a hole that runs against the outer
  ring (it twisted: area 24 for a 12 face) and returns counter-clockwise triangles; earcut takes the refused face and
  the 1 % area check covers both. Kernel tests 35+1 skipped to 38+1 skipped; mesher tests 164 before and after.
- 2026-10-17, TKT-309, bim-open-data 9fa7674: curved faces meet a chordal deviation bound, `AddFace(...,
  float maxDeviation = Tolerance.ChordDeviation)` (1 mm). A virtual `SurfaceMap.ChordDeviation` (planes answer 0) drives
  boundary densification and interior flips then splits of earcut's triangles. Quarter cylinder: area 3.98 before,
  pi - 3.8e-4 after, no interior point. Kernel tests 38+1 skipped to 41+1 skipped; mesher tests 164 before and after.
- 2026-10-17, TKT-310, ara3d-sdk 002784d: `StepDocument.Diagnostics` lists `StepDiagnostic(Severity, Code, Offset,
  Expected, DefinitionId, DefinitionOffset)` instead of throwing; a fault keeps every instance completed before it
  (unit-cube-truncated.stp: #1 to #124, one Error `Syntax` at byte 4232 in #125, which starts at 4198). `StepHeader`
  keeps its ten fields as written. The u-blox 88 open with zero diagnostics and 5,708,101 definitions, as before;
  Ara3D.Ifc.Tests 38 passed, 11 skipped, before and after.
- 2026-10-17, TKT-303 done in parakeet 278d154 and bim-open-data edb944a. The spike's "every block parses" was
  wrong: `ExpressGrammar` recovers from a failed rule by jumping to the end of the block and recording
  `ParserState.LastError`, so `AtEnd` held even when the tail was lost. Counted with `LastError`, 697 of 2,140 AP242
  entities, 108 of 915 AP214 and 111 of 1,006 AP203 were read only in part (an `ANDOR` supertype lost
  `b_spline_curve`'s `SUBTYPE OF` and all five attributes; a `SELF\x.y` redeclaration in the explicit list dropped
  every attribute after it). The grammar now reads ANDOR / AND / nested ONEOF supertype expressions, explicit
  `SELF\x.y [RENAMED z]` redeclarations, DERIVE attribute names, expression bounds (`LIST [1 : segments]`),
  `STRING(n)`/`BINARY(n) FIXED`, `TYPE ... WHERE` and `--` comments: 0 blocks with an error in the three long forms and
  in IFC2X3, IFC4, IFC4X3. The block scan started a TYPE block at every `SUBTYPE` and `TYPEOF` and rescanned to the end
  of the file each time; splitting AP242 took over ten minutes and now takes about 9 s. No `EXTENSIBLE` or `BASED_ON`
  select occurs in the three long forms, so none was needed.
  The generator's model (`ExpressSchema.cs`, renamed from the `Ifc*` records) keeps every supertype, own explicit
  attributes and DERIVE redeclarations; `ExpressAttributeLayout.Layout(entities)` gives each attribute's `Position` in
  a simple-instance record, its `OwnPosition` in its partial-entity record, and `IsDerived` for a `*` slot. 26 AP242
  records match `STEP-BREP-MODEL.md` section 3, as do two complex instances' partial records and the AP214/AP203
  difference in `conversion_based_unit`; every entity of the three schemas has a layout (33 tests, skipped when the
  schemas are absent). `TestGenerate` was writing to the stale `src/Ara3D.IfcTypes`; it now writes
  `src/data/Ara3D.IfcTypes`, byte-identical, in about 25 s. For TKT-304: a C# class has one base, so the IFC emitter
  throws on several supertypes; StepTypes needs interfaces or flattened attribute lists, and descriptors addressed by
  (partial entity, `OwnPosition`) for complex instances and by `Position` for simple ones.
- 2026-10-17, TKT-304 done in bim-open-data 337a762. `StepCodeGenTest.TestGenerate` (explicit) writes
  `src/data/Ara3D.StepTypes/*.g.cs` from the AP242 long form: all 2,140 entities, 39,077 lines, compiled by Csc in
  6.9 s, so no closure rule was needed; a rerun is byte-identical and the normal test `GeneratedFilesAreCurrent` fails
  when the committed files drift. Shape: per entity an interface extending its supertypes' interfaces and the SELECTs
  that list it (`IAdvancedFace : IFaceSurface`), so membership is a type test that works with several supertypes; per
  entity a sealed descriptor class with one `Instance` and a `StepAttribute<T>` field for every slot of its record,
  inherited ones included, each carrying `Position` and (declaring `Entity`, `OwnPosition`); per SELECT an interface,
  per ENUMERATION an enum. `Ara3D.Step.Entities` (net8.0, like `Ara3D.Ifc.Entities`) holds `StepModel`, `StepEntity`
  (`Is<T>()`, `Parts`, `TryGet`) and typed readers; a complex instance is an X when any part is, and an attribute is read
  from the part named by its declaring entity. Tests: Ara3D.StepTypes.Tests 23 passed, including reads from the u-blox
  `SAM_AP214.STEP` (now a fixture in bim-open-data) of a millimetre prefix and a rational surface's weights from their
  complex instances; Ara3D.IfcTypeGen 34 passed. A throwaway corpus check: the 88 u-blox files hold 5,708,101 instances,
  307,599 complex, and no name AP242 does not declare; the five adapter fixtures, 710 instances, none either. Gap 4 is
  narrower than stated: ten AP242 representation items have another first supertype, so `name` is not their first slot
  (`rep_item_group`, `user_defined_curve_font`, `externally_defined_hatch_style`, ...); every Part 42/43 geometry and
  topology entity starts with it. For TKT-305: names are EXPRESS names in Pascal case and some meet .NET ones (`Path`,
  `Vector`, `Plane`), so alias the namespace where they meet; strings are read raw (no `\X2\` decoding yet).
- 2026-10-17: pivot recorded (section above); TKT-305 re-scoped to model assembly; TKT-311 (writer spike), TKT-312 (C# decode into BrepModel), TKT-313 (mesh through compiled Plato) filed.
- 2026-10-17: boundary refined with the Plato session: C# produces `RawDecodedModel` (structural mapping only), Plato's `PrepareModel` makes the four geometric decisions. TKT-312 updated.
- 2026-10-17, TKT-305 part B (model assembly), bim-open-data 04d0cc0 to 19dbf9e. `StepMesher.Mesh(path or
  StepDocument)` returns a `StepMeshingResult` shaped like `IfcMeshingResult` plus `Placements` (every shape item at every
  place, meshed or not), `ContextUnits`, `AssemblyDepth`, `StyledColours`, `GeometryPending`, `Cycles`, the parser's
  `StepDocument.Diagnostics` and `Prefix` (instances read before a parse error). Units: length unit from SI prefix or
  `conversion_based_unit` factor, smallest length uncertainty in file units. Placements: `axis2_placement_3d` by ISO
  build_axes, `cartesian_transformation_operator_3d`; `mapped_item` origin onto target, mesh shared. Assemblies: NAUO,
  CDSR, RRWT, `item_defined_transformation`, the component side decided by membership (M2-ZED-F9T-20B writes rep_1 as
  the assembly's); a NAUO with no CDSR is skipped when a mapped item of its assembly placed it. Colours: the CAx-IF
  chain to `colour_rgb` and `draughting_pre_defined_colour`, on solid, shell, face (most common, recorded approximate when
  faces differ), mapped item or representation. `MeshItem`'s `NotImplementedException` is counted as geometry pending.
  Tests: Ara3D.Step.Mesher.Tests 24 passed, 1 ignored (two instances of one mesh, until `MeshItem` has a body), including
  unit-cube 0.001 m, inline inch 0.0254 m, the two-cubes assembly at +0.002 m, swapped transform items, product and
  mapped-item cycles, and unit-cube-truncated.stp (Syntax error in #125, prefix of 124 instances).
  Corpus check (throwaway program) over the 88 u-blox files, everything but triangles: 0 exceptions, 0 failed results,
  0 parse diagnostics, 7.8 s in all (Release, first file 2.0 s with JIT warm-up); 18,771 placements of 10,881 distinct
  shape items, all geometry pending; 81 files are assemblies, depth up to 6 (M2-MAYA-W271); 70 files in millimetres, 17
  in metres, LENA-R8 mixes mm, inch and thou across 40 part contexts; 88,295 styled colours, 17,979 placements coloured,
  8 files with uncoloured placements (the AP203 exports carry no styles); 18 files with approximate records, all faces
  of one solid carrying several colours (NINA-B221-W1x1: 52 solids). Notable: LENA-R8 (a `shape_aspect` representation
  repeats each part's solid; the first run placed 40 duplicates at the origin, fixed in 5b5bcbc), M2-ZED-F9T-20B
  (component frame at 503, 764, 1259 mm in the assembly, as written; placement span 1.5 m), M2-JODY-W377-00C (1,092
  distinct items, one placement each), NINA-B222-W1x2 (195 `geometric_curve_set` items counted unsupported),
  ODIN-W262 (depth 5, a `brep_with_voids` with two face colours). Debts: per-face colour (one material per instance),
  occurrence colours (`over_riding_styled_item`), a context without a length unit read as millimetres.
