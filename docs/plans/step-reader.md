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
- 2026-10-17, TKT-311 spike (Plato `65d63c90`, sandbox `cc4ab928`; throwaway files in the session scratchpad, `tkt311\`).
  Instead of a slice, the whole library compiled: the three stdlib tiers minus `brep.*`, plus all 86 non-spec sandbox
  files flattened into one folder, `dotnet Plato.CLI.dll in/foundation in/geometry in/graphics in/design --out=<out>
  --csharp-style=extensions` (18 s; 1,207 files, 148k lines; 1 degraded body, the stdlib's `Tween.Change`), then built
  with a copy of `generated/Plato.Generated.Foundation.Unoptimized/*.csproj` (17 s). The generated C# does not compile
  today. Construct by construct (counts from a regex over the 86 files):

  | Construct | Count | C# writer today | Evidence |
  |---|---|---|---|
  | Product types | 99 | compiles, runs | constructors, fields, `With*` |
  | Sum types and `match` | 41 sums, 251 matches | compiles, runs; equality wrong | sum `Equals` compares every flattened case field, so a null array of an inactive case throws: `Curves[0].Equals(Curves[0])` on a `Line` gives NullReferenceException, and so do `SameModel` and `Law_UnitBoxIsBoxOfOnes`. A `BrepCurve` is a 352-byte struct, a `BrepSurface` 416 |
  | Typed index as subscript, `m.Faces[f]` | 290 errors | blocks | CS1503 "cannot convert from 'BrepFaceIndex' to 'int'": the writer emits the raw indexer, and C# will not chain `BrepFaceIndex` to `Integer` to `int` |
  | `IIndexable<$T>` functions on `Array<T>` | 190 errors | blocks | CS1929 "'IReadOnlyList<Point3D>' does not contain a definition for 'IsValidIndex'": not instantiated for arrays; `First` and `Last` compile only because `System.Linq` supplies them |
  | Conditional as condition, `(a ? b : false) ? x : y` | 109 sites | 12 block, about 97 compile wrong | `TirCSharpBodyWriter` drops the parentheses; `Law_TriangleMinAngleMeetsThreshold` becomes `IsTriangle(e) ? HasValidCorners(e) : (false ? ... : true)` and never tests the angle. It is the library's short-circuit idiom, since `&&` evaluates both sides |
  | C# keywords as names | 2 in the library (`short`, `explicit`), 1 in stdlib (`base`) | blocks | CS1001 at `StepSchemaModel.g.cs`, `_EntityDefinition.g.cs`, `Sampling.g.cs` |
  | `Array<T>`, lambdas, `Function1..9` | 531, 3,876, 71 | compiles, runs | `IReadOnlyList<T>`, `Func<>` |
  | `Number`, `Integer`, `Boolean`, `String` | | compiles, runs | `Number` is float32: `Point3D` is 12 bytes |
  | Block bodies, `while`, `List`, `Buffer` | 255, 9, 1, 1 | compiles, runs | the throwaway body below |
  | Static `_` functions and witnesses | 121 | compiles, runs | `BrepModel.Witness_UnitBox()` |
  | Generic `$T` functions, interfaces | 4, 3 | compiles | not run |
  | Laws | 698, all with bodies | compile as Boolean functions | no runner builds witness arguments; a C# test calls them |
  | Bodiless functions | 85 | stubs, unevenly | receiver a library type: throws NotImplementedException; receiver `Array<T>`: not emitted (`FlatRecord`, CS1061 at the call); receiver a scalar: calls itself (`ParseStep`, `NameOctetsPrecede`) |
  | `spec` blocks | 231 in 15 files | blocks | the parser halts: "Parsing failed to reach end of input, stopped at: Ln:28 Ch:4" in `topology.spec.plato` |
  | stdlib geometry tier | 3 defects | blocks | CS1929 `Contains` on an existential (`Extensions.g.cs`, 2), CS0117 `Constants.UniformWeights` (`Remeshing.g.cs`) |

  Going around each blocker in the scratchpad: a copy of the compiler with the condition parenthesized (two lines
  in `TirCSharpBodyWriter.cs`, the `TirConditional` case), a shim file adding `implicit operator int` to the 37 `IIndex`
  structs plus two generic `IsValidIndex` extensions on `IReadOnlyList<T>`, an `@` on the three keywords, and throwing
  stubs for `FlatRecord` and the three stdlib defects. With those, the whole library builds with 0 errors. A
  throwaway C# program builds the unit cube through the generated types (`BrepCurve.Line`, `BrepSurface.Plane`,
  `BrepLoop.EdgeLoop`, `BrepBody.ManifoldSolid`, `LengthUnit.Metre`, typed indices) and prints:

  ```
  RawCounts: V=8 E=12 F=6 L=6; EulerPoincare=2
  Law_IndicesInRange: True
  Law_LoopsChainEndToStart, all 6 loops: True
  Law_EdgeUsesHaveOppositeOrientation, all 12 edges: True
  Law_DeclaredClosedIsClosed: True
  Witness_BoxWithFlippedFace edges failing Law_EdgeUsesHaveOppositeOrientation (expected none): []
  Edge 0 orientation through match (CoedgeRunsForwardOnCurve) at face 0 slot 3 / face 2 slot 0: False / True
  ShellComponentCount (throwaway while/Buffer/List body), cube shell 0: 1
  ShellComponentCount, shell of bottom + top faces only (expected 2): 2
  SameModel, Law_UnitBoxIsBoxOfOnes, Line Equals: NullReferenceException (sum equality)
  Law_EveryEdgeUsedTwiceInClosedShell, Law_ShellIsOrientable, Law_EulerPoincareEvenAndBounded,
  Law_LoopWindingMatchesSameSense: NotImplementedException (they reach chunk A's bodiless functions)
  ```

  `ShellComponentCount` is bodiless in the library; the spike gave it a flood-fill body in its copy only. A consumer
  project must also exclude the compile assets of the `Ara3D.Geometry` 1.6.1 package (CS0433, two `Point3D`s), and the
  generated `Take` extension on `IReadOnlyList<T>` collides with LINQ's (CS0121).

  Writer work before chunk A runs in C#, all in `writers/Plato.CSharpWriter`: (1) parenthesize a conditional's
  condition in `TirCSharpBodyWriter.cs` (done and verified in the copy); (2) typed-index subscripts, either `xs[i.Value]`
  in the body writer or `implicit operator int` on single-`Integer` `IIndex` structs where the struct writer emits the
  unwrap converter; (3) instantiate the `IIndexable<$T>` library functions (`IsValidIndex`, `At(IIndex)`, `LastIndex`,
  `First`, `Last`) for `IReadOnlyList<T>`, as `Extensions.g.cs` already does for `Take` and `Map`; (4) escape C#
  keywords with `@`; (5) sum `Equals` that switches on `Kind` and compares only the active case
  (`CSharpConcreteTypeWriter.WriteSumType`), which chunk A's determinism and witness-equality laws need; (6) one stub
  shape for every bodiless function. Outside the writer: the three stdlib geometry defects, and 64-bit `Number`
  (TARGET-LANGUAGE.md 7.4; Plato's working tree has uncommitted plato-271 edits to `Plato.Intrinsics`, so the spike built
  against `git archive HEAD`). Items 2 to 4 were measured only as shims; item 1 is the one silent defect, and it
  affects about 97 laws and checks.
- 2026-10-18, TKT-312, bim-open-data 9e645f4 to the tests commit below. **Layout.** `src/data/Ara3D.StepBrep`: the Plato
  library compiled to C# (`Generated/`, 914 files) with a copy of Plato's runtime (`Intrinsics/`), written by
  `tools/regen-step-brep.ps1`; `src/data/Ara3D.Step.Decode`: the decoder, referencing `Ara3D.Step.Entities` and
  `Ara3D.StepBrep`; `tests/data/Ara3D.Step.Decode.Tests`. The script renames Plato's namespace `Ara3D.Geometry` to
  `Ara3D.StepBrep`, so TKT-311's CS0433 cannot occur in any consumer (the mesher can reference both later) and no extern
  alias is needed; the project references `Ara3D.Collections` only, because `Ara3D.SDK.Core` brings the
  `Ara3D.Geometry` assembly and 2,500 CS0121 ambiguities with it. LINQ's `Any`/`Take` still meet the generated
  `IReadOnlyList<T>` extensions in a file importing both (one call site in the decoder, written `Enumerable.Any`).
  **Generation.** `powershell -File tools/regen-step-brep.ps1 -PlatoRoot <clone of Plato dbc065ea>`: stdlib foundation and
  geometry tiers plus sandbox layers 00 to 07, spec files left out, `--profile=cpu64` (TKT-315's profile landed in Plato
  b875bbc0; Number is binary64); headers name Plato 54a3996a and bim-open-toolkit a5df350e, the inputs' last commits; a
  rerun is byte-identical. Layer 03's witnesses need layer 07 (`SameModel`, `Witness_UnitBoxMillimetres`), which needs 04
  to 06, so 00 to 03 alone does not compile. Left out: 08 and 09, the graphics tier, `brep.*`, and `remeshing.*`/
  `lattices.*` (two of the three stdlib defects; the third is in neither). The test `StepBrepGenerationTests` reruns the
  script and compares; it is inconclusive while either checkout has uncommitted input changes (Plato's has today), and
  its first run took 9 minutes, most of it building Plato's CLI (cached between runs).
  **Writer defect, and the one deviation.** TKT-315 writer fix 6 was paused (plato-459, Plato afb1f304), so the generated
  code calls `FlatRecord(this IReadOnlyList<EntityDefinition>, String)`, which the writer never emits:
  `StepSchemaModel.g.cs(37,160)` and `_Integer.g.cs(114,141)`, CS1061. The note in TKT-312 that fix 6 does not affect
  layers 0 to 3 was wrong: `FlatRecord` is 03-step's. `Ara3D.StepBrep/BodilessStubs.cs` holds the throwing stub the fixed
  writer will emit; it is the only hand-written file and will collide (CS0121) with the regenerated one. **Library gap.**
  `PrepareModelWith` calls `Reduced` and `ToleranceDiagnostics`, both bodiless in `step.library.plato` (TASKS.md chunk
  D), so `PrepareModel` throws NotImplementedException from C#, and so do the library's own two laws over its witnesses.
  **Results.** `SameRawModel(decoded, Witness_RawUnitCube)` and `(decoded, Witness_RawTwoCubes)` hold;
  `Law_UnitsFactorsAgree` holds on both decoded models; the two prepare laws with the decoded values, and the library's
  witness forms, are inconclusive on the NotImplementedException; diagnostics tests (truncated file, not Part 21, zero
  direction, dangling reference, unsupported census) pass: 11 passed, 4 inconclusive. Mesher tests 24 passed, 1 ignored,
  before and after. **Corpus** (throwaway program over the 88 u-blox files, Release): 0 exceptions, 33.1 s (NORA-W101 the
  slowest at 2.7 s), 12,872 occurrences, 192,457 faces decoded, 12 folds, 0 skipped rows. Faces per occurrence equal the
  file's `ADVANCED_FACE` count where there is one occurrence (c211_case_with_odin_v1 539, MAYA-W261 1,485).

  | Diagnostic | Count | | Not represented (census) | Instances |
  |---|---|---|---|---|
  | STEP-LENGTH-UNIT, STEP-ANGLE-UNIT, STEP-UNCERTAINTY | 69,919 each | | GEOMETRIC_CURVE_SET | 195 |
  | STEP-IGNORED-TYPE | 1,647 | | DERIVED_UNIT_ELEMENT | 168 |
  | STEP-TWO-OUTER-BOUNDS | 263 | | DERIVED_UNIT | 167 |
  | STEP-DEGREE-SNAPPED | 44 | | PRESENTATION_STYLE_BY_CONTEXT | 12 |
  | STEP-UNSUPPORTED-TYPE | 10 | | GEOMETRIC_SET, GEOMETRICALLY_BOUNDED_SURFACE_SHAPE_REPRESENTATION | 5 each |
  | STEP-UNREFERENCED | 7 | | MASS_UNIT+NAMED_UNIT+SI_UNIT | 1 |

  Most affected: CEL/LENA-R8 (3,311 faces, 291 occurrences, 342 unsupported instances), SHO/NINA-B222-W1x2 (1,007 faces,
  195), SHO/IRIS-W1x1 (1,830, 6), SHO/IRIS-W1x6 (1,992, 6), SHO/c211_case_with_odin_v1 (539, 4); none lost a row.
  **Debts.** (1) The occurrence walk, the inverse-link index and the length-unit reading repeat Ara3D.Step.Mesher's
  (`StepShapeCollector`, `StepModelIndex`, `StepUnitsReader`) in double precision and millimetres; moving them needs the
  mesher's project file, and the mesher's copies go when TKT-313 meshes from the decoder's occurrences. (2)
  `StepSelectReaders.TrimParameter` reads a mixed SELECT list by token; it belongs in `Ara3D.Step.Entities` beside the
  readers TKT-318 moved there. (3) Not decoded, each a skipped row with a diagnostic: point-only trims, a 2D conic in a
  parameter plane scaled unevenly (a degree file's cylinder), a pcurve as an edge's curve, `face` without a surface. (4)
  Not emitted: the torus and non-orthogonal placement warnings; a surface curve without `curve_3d` is reported
  (`MissingCurve3D`) and skipped rather than given its first pcurve as master. (5)
  `tests/data/README.md` lacks a row for the new test project (outside this fence). (6) Performance: `StepEntity.Is<T>()`
  lists the parts of a complex instance on every call, and each placed copy is read again.
- 2026-10-18, TKT-312 criterion 2, bim-open-data 761c2cb. Step D of the STEP mesher epic (TKT-326, toolkit 72d36820) gave
  `Reduced` and `ToleranceDiagnostics` bodies, so `PrepareModel` runs. `Ara3D.StepBrep` regenerated from the library at
  6aee137d with the Plato compiler the epic's builders share (`C:/Users/cdigg/.plato-cli/acbc9b94`, a clean export of
  Plato acbc9b94), passed to the script's new `-PlatoCli`; stdlib and runtime from a clone at the same commit.
  `Ara3D.Step.Decode.Tests`: 14 passed, 0 inconclusive (generation test left out): both prepare laws hold with the decoded
  unit cube and two cubes. Building the compiler from a copy fails (Parakeet eedf2f0 finds Ara3D.Utils through a sibling
  `ara3d-sdk`), hence `-PlatoCli`; the script now prints the compiler's build errors. Timings for TKT-321: the same
  regeneration took 945 s and the test build 927 s under heavy load, then 64 s and 71 s an hour later.
  `BodilessStubs.cs` stays until Plato writer fix 6 (plato-459) lands.
- 2026-10-18, TKT-313 chunk 1 (unit cube through the compiled library), bim-open-data f6e45b3. **Where decoding and
  meshing run: per file.** `Ara3D.Step.Mesher/Plato/StepPlatoMesher.MeshFile(StepModel, chordal mm)` calls `DecodeRaw`
  and `PrepareModel` once for the file, because both are defined over the whole file: the tolerances come from the
  model's size and coordinate extent, and a mirrored occurrence's faces are folded in place, with every occurrence's
  bodies placed in millimetres. Then, as layer 08's `MeshModel` before its loop: every edge discretized once (each row
  materialized: `DiscretizeAll` returns a lazy list that recomputes on access), layer 08's `FaceOutcome` per face, and
  `NumberMeshVertices` plus `AssembleModelMesh`. Layer 08 is not in the committed generation (layers 00 to 07), so those
  ten lines restate it; the refinement loop and validation are not run. Library code that throws on an edge or a face
  becomes an empty outcome with `HOST-LIBRARY-THREW` and a `StepPlatoFailure` (pending when NotImplementedException).
  `StepPlatoBodies.ToShapeMesh(body, units)` restricts the assembled mesh to the body's faces (`RestrictedToFaces`,
  `ToTriangleMesh3D`), drops unused vertices, and maps back through the inverse of the occurrence's placement into the
  item's metres, reversing triangles under a mirror. **Cube** (Plato/PlatoCubeTests): 8 vertices, 12 triangles, no
  failure, no Error; from C# on the library's `ModelMesh`: `IsManifold`, `IsClosed`, `IsConsistentlyOriented`,
  `ReferencedEulerCharacteristic` 2, `SignedVolume` 1 mm^3, `Area` 6 mm^2, one component, and the laws
  `Law_ClosedMeansEveryEdgeHasTwoSides` and `Law_ManifoldMeansNoEdgeHasMoreThanTwoSides` (all 18 edges),
  `Law_OrientedExactlyWhenNoEdgeIsMisoriented`, `Law_ClosedOrientedSurfaceHasGenus`, `Law_AngleDefectSumIsTwoPiTimesEuler`,
  `Law_VectorAreaVanishes`, `Law_ComponentEulerCharacteristicsAddUp`, `Law_ReversalNegatesSignedVolume`,
  `Law_TriangleMeshKeepsArea`, `Law_TriangleMeshKeepsPositions` all hold. C# on the contract mesh: every directed edge
  paired once with its reverse, Euler 2, volume 1e-9 m^3, corners at 0 and 0.001 m. The interpreter was not run, so no
  C#/interpreter comparison was made. **Other surfaces**: a hand-written unit cylinder (new fixture) meshes closed and
  oriented, 72 points per circle at a 0.001 mm chordal bound, volume within 1% below pi mm^3; a unit sphere (new
  fixture, one face bounded by a pole-to-pole seam) throws NotImplementedException in `MeshFace` and comes back as a
  pending failure with an empty face. **Finding:** the unit cube with plane #118 replaced by
  `SPHERICAL_SURFACE('',#112,0.5)`, `CYLINDRICAL_SURFACE('',#112,0.5)` or `TOROIDAL_SURFACE('',#112,2.,0.5)` (edges no
  longer on the face's surface) makes `Discretize` of edge 3 (#56, a line shared with that face) run for more than 15 s
  without returning, with `DefaultCriteria(0.001)` and no floors: a non-terminating loop on inconsistent input, which the
  bridge's exception guard cannot catch. **Not done: wiring.** `StepMesher.Mesh` still meshes nothing, since
  `Model/StepModelBuilder.cs` calls `StepShapeMesher.MeshItem(model, item, units, ...)` per item and cannot receive the
  file's meshes; that file was outside the chunk's fence. Proposed: `StepMesher.Mesh` calls `MeshFile` once, and the
  builder takes the `StepPlatoMesh` (or a `Func<StepPlacedItem, StepShapeMesh?>`) and looks each placed item up by body
  instance id (first occurrence), counting an item pending when every face failed as pending; `MeshItem`'s per-item
  signature then goes. Tests: Ara3D.Step.Mesher.Tests 30 passed, 1 skipped (`AssemblyModelHasTwoInstancesOfOneMesh`,
  waiting on the wiring).
