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
   `StepTokenizer.AdvanceToAndTokenizeDefinition` reads one name then one group; read in the code, not yet run, it
   keeps the first partial entity and drops the rest. `StepDefinition` needs a list of partial entities, and a
   descriptor addresses an attribute as (partial entity, index within it).
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
