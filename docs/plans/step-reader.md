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
