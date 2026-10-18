# Adapter test spec: `StepDocument` to `ParsedFile`

Written 2026-10-17 for whoever writes the C# adapter of TASKS.md chunk E (owner decision pending
in TKT-306, how the C# reader relates to this design). Ticket: TKT-299.

## Purpose and the boundary

The STEP decoder of this design reads a `Part21File` (`03-step/step-part21.types.plato`): the
header with every string decoded, the instances in ascending id order, and one flat attribute
arena in which a list or a typed parameter stores its children at smaller indices than itself.
`ParseStep(text): ParsedFile` is a host obligation (`03-step/README.md`, "Host obligations"): the
C# parser `Ara3D.IO.StepParser` (in `deps/ara3d-sdk`) reads the text into a `StepDocument`, and
the adapter turns that into a `ParsedFile`. This document gives the adapter's acceptance tests:
five text fixtures under `fixtures/`, the `Part21File` each must produce (the literals in
`../03-step/step-witnesses.laws.plato`, library `StepWitnessesLaws`, layer 3's witnesses since
the name review of 2026-10-17), the expected `Ok` and diagnostics,
and the file laws every output must satisfy.

## What the adapter does about each difference

| `StepDocument` | `Part21File` | The adapter |
|---|---|---|
| `Definitions` in file order | `Instances` in ascending `Id` | Stable sort by `Id`. A second definition with a used id is dropped with one `DuplicateInstanceId` Error at `AtInstance(id)`. |
| One token arena, each list token before its items (parent first) | `Attributes` children first | Re-emit each definition's tokens in the layout below. Linear in the token count. |
| Tokens are raw byte spans: strings with quotes and escape directives, keywords as written | Strings decoded, keywords and enumeration names upper case | Decode strings by the rules below; upper-case keywords (record names, typed-parameter names) and the name between the dots of an enumeration. |
| `Diagnostics` (since TKT-310, ara3d-sdk 002784d): `StepDiagnostic(Severity, Code, Offset, Expected, DefinitionId, DefinitionOffset)` in file order; an Error means parsing stopped there and the definitions before it are kept | `Ok` false exactly when a Diagnostic is an Error; `File` the parsed prefix; `Diagnostics` in layer 3's codes | Map each `StepDiagnostic` by the table below; `Ok` is the absence of an Error. |
| `StepHeader` keeps the ten header fields raw (text between the quotes, escape directives and doubled apostrophes as written, `""` for `$` or a missing entity), `SchemaIdentifiers` as a list | `StepHeader` has the same ten fields, strings decoded | Decode each string by the rules below; copy the lists. A missing header entity arrives as a `HeaderIncomplete` Warning from the parser (mapped below). |

Row 4 and row 5 were different before 2026-10-17: the parser threw on malformed input and its
header kept three strings. TKT-310 changed both; the two fixtures `unit-cube.stp` and
`unit-cube-truncated.stp` are copied byte-exact into `ara3d-sdk/tests/Ara3D.SDK.Tests/StepFixtures/`
as its tests.

### Mapping `StepDocument.Diagnostics`

| `StepDiagnostic` | Layer 3 code | Severity | `Where` | `Measure` |
|---|---|---|---|---|
| `NotStepFile` | `P21-NOT-A-FILE` (`NotPart21File`) | Error | `WholeInput` | `Offset` |
| `HeaderIncomplete` | `P21-HEADER-INCOMPLETE` | Warning | `WholeInput` | `Offset` |
| `Syntax` with `DefinitionId` > 0 | `P21-SYNTAX` (`SyntaxError`) | Error | `AtInstance(DefinitionId)` | `Offset` |
| `Syntax` with `DefinitionId` = 0 (a cut header, a missing `DATA;` or `ENDSEC;`, text between instances) | `P21-SYNTAX-OUTSIDE-INSTANCE` (new in layer 3, TASKS.md chunk D) | Error | `WholeInput` | `Offset` |

`Expected` becomes the diagnostic's message. `Law_ParseFindingsPointAtTheirSubject` keeps requiring
`P21-SYNTAX` to name an instance; the fourth row is the code for the case where none exists. On
`unit-cube-truncated.stp` the parser keeps #1 to #124 and reports one `Syntax` Error at byte 4232
in #125 (which starts at byte 4198), expected `')' closing the list`; the adapter output is the
truncated row of the acceptance table.

### Arena layout

`IsSameFile` compares arenas element by element, so the layout is part of the contract:

1. Visit the instances in ascending id order.
2. Within an instance, visit its records in written order. A simple instance has one; a complex
   instance has its parts in file order (`StepDefinitionExtensions.PartialEntities`).
3. Within a record, visit its parameters left to right. Emit each one depth-first in post-order:
   a list's items (recursively) before the list, a typed parameter's inner value before the typed
   value. The record holds the indices of its top-level parameters.

Example, `#1=CARTESIAN_POINT('',(0.,0.,0.));` first in id order: arena `0 StringValue("")`,
`1 RealValue(0)`, `2 RealValue(0)`, `3 RealValue(0)`, `4 ListValue([1,2,3])`; record attributes
`[0, 4]`. `LENGTH_MEASURE(1.E-06)` is `RealValue(1e-6)` at k and `Typed("LENGTH_MEASURE", k)` at
k + 1. The layout is forced: `PrintStep` writes instances in id order, so a layout that followed
file order would break `Law_ParsePrintParseIsIdentity` for a file written out of order.

Token kinds: `IntegerValue` for a number without a decimal point, `RealValue` for one with
(`1.`, `1.E-06`, read with the invariant culture), `Unset` for `$`, `Derived` for `*`,
`Reference(n)` for `#n`, `BinaryValue` for `"..."` with the hex digits as written.

## Acceptance tests

Each row: read the fixture, run the adapter, and require `IsSameFile(result.File, witness)` (layer
3, `step-part21.library.plato`), the stated `Ok`, and diagnostics equal field by field (`Severity`,
`Code`, `Where`; `Measure` is NaN in every expected diagnostic). Witness functions are static: call
`Part21File.Witness_Part21UnitBox`, `Diagnostic.Witness_Part21UnitBoxTruncatedDiagnostics`.

| Fixture | Bytes | What it is | Witness (instances, arena values) | `Ok` | Diagnostics |
|---|---|---|---|---|---|
| `unit-cube.stp` | 5439 | 1 mm cube, AP214 product, B-rep, units, uncertainty | `Witness_Part21UnitBox` (142, 588) | true | none |
| `unit-cube-no-shape.stp` | 5324 | the same without #141 `ADVANCED_BREP_SHAPE_REPRESENTATION` and #142 `SHAPE_DEFINITION_REPRESENTATION` | `Witness_Part21UnitBoxNoShape` (140, 581) | true | none: `STEP-NO-SHAPE` belongs to the decoder, not the parse |
| `unit-cube-dangling.stp` | 5440 | the same with #65 `ORIENTED_EDGE` naming #999 instead of #56 | `Witness_Part21UnitBoxDangling` (142, 588; value 251 is `Reference(999)`) | true | `Witness_Part21UnitBoxDanglingDiagnostics`: one Warning `P21-DANGLING-REFERENCE` at `AtInstance(65)` |
| `unit-cube-truncated.stp` | 4232 | the first 4232 bytes of `unit-cube.stp` | `Witness_Part21UnitBoxTruncatedPrefix` (124, 518) | false | `Witness_Part21UnitBoxTruncatedDiagnostics`: one Error `P21-SYNTAX` at `AtInstance(125)` |
| `two-cubes-assembly.stp` | 6778 | the cube's 142 instances, then ids 143 to 162 placing it twice | `Witness_Part21TwoCubes` (162, 672) | true | none |

Notes on the fixtures:

- Every fixture is LF-terminated ASCII; `fixtures/.gitattributes` keeps git from converting it.
- In every fixture, `#5` to `#8` are written before `#1` to `#4` (the eight `CARTESIAN_POINT`s), so
  the sort is tested; every other instance is written in ascending order, and every reference
  names an instance written earlier, so a prefix of the file never dangles.
- The header author is `'Andr\X2\00E9\X0\ Lefort'`, decoded `André Lefort` (U+00E9). `#136`
  `PRODUCT` has the description `'a hand-written ''unit'' cube'`, decoded with single quotes.
- Truncation: `#125=CLOSED_SHELL(` starts at byte 4198 (0-based); the text stops after
  `('',(#119,#120,#1`, the first two characters of `#121`. A parser that takes `#1` as a complete
  reference has a bug. #1 to #124 are complete; nothing after the cut exists, `ENDSEC;` included,
  and the missing end is part of the same Error, not a second finding.
- The assembly: #143 a second geometric context (the same units and uncertainty, #128 to #131),
  #145 and #146 placements at the origin and at x = 2 mm in `SHAPE_REPRESENTATION` #147, product
  #148 to #152, `NEXT_ASSEMBLY_USAGE_OCCURRENCE` #153 and #154 (assembly #150 relating, cube #139
  related), and for each occurrence an `ITEM_DEFINED_TRANSFORMATION` (#157, #158) from the cube's
  origin #127 to #145 or #146, a complex `SHAPE_REPRESENTATION_RELATIONSHIP` with transformation
  (#159, #160, rep_1 the cube's #141, rep_2 the assembly's #147), and a
  `CONTEXT_DEPENDENT_SHAPE_REPRESENTATION` (#161, #162). The second cube is the first translated by
  +2 mm in x.
- Complex instances: the three units #128 to #130, the contexts #132 and #143, and #159 and #160.
  Their parts are written in the standard order (alphabetical by long name).

## File laws the output must satisfy

On every fixture, and on every file the adapter reads (laws in `03-step/step-part21.laws.plato`,
invariants in `03-step/step.spec.plato`, spec `ParsedFile`):

| Law | Holds on the fixtures |
|---|---|
| `Law_ParseOkIffNoError`: `Ok` exactly when no diagnostic is an Error | all five |
| `Law_ParseFindingsPointAtTheirSubject`: `P21-SYNTAX`, `P21-DUPLICATE-ID`, `P21-DANGLING-REFERENCE` at a `StepInstance`; `P21-NOT-A-FILE`, `P21-HEADER-INCOMPLETE`, `P21-LENIENT-TOKEN` at `WholeInput` | all five |
| `Law_InstanceIdsPositive`, `Law_InstanceIdsAscending`, `Law_InstanceIdsUnique` | all five |
| `Law_RecordIndicesInRange`, `Law_ChildrenPrecedeParent` | all five |
| `Law_ReferencesResolve`, or a `DanglingReference` diagnostic | resolves in four; fails at exactly one arena value (251) in the dangling fixture, which carries the Warning |
| `Law_HeaderNamesASchema` (or `HeaderIncomplete`/`NotPart21File`) | all five name `AUTOMOTIVE_DESIGN { 1 0 10303 214 1 1 1 1 }` |
| `Law_ParsePrintParseIsIdentity` | stated, not run: no printer exists on either side |

`Law_WitnessFilesSatisfyInvariants` in `../03-step/step-witnesses.laws.plato` checks the witnesses
themselves against the same laws; it needs a body for `InstancePosition` (chunk D). One
`DanglingReference` Warning is emitted per instance that holds a dangling reference. Diagnostics
are ordered `WholeInput` findings first, then by instance id.

## Hand verification of `unit-cube.stp`

Coordinates in millimetres (`SI_UNIT(.MILLI.,.METRE.)`, #128); uncertainty 1e-6 mm (#131). Each
`LINE` starts at its edge's start vertex point, `VECTOR` magnitude 1. The vertex, edge, loop and
face numbering is that of layer 7's `Witness_UnitBox` (`07-validation/validation-witnesses.library.plato`),
which is in metres; see the findings below.

| Vertex | `CARTESIAN_POINT` | `VERTEX_POINT` | x, y, z |
|---|---|---|---|
| V0 | #1 | #45 | 0, 0, 0 |
| V1 | #2 | #46 | 1, 0, 0 |
| V2 | #3 | #47 | 1, 1, 0 |
| V3 | #4 | #48 | 0, 1, 0 |
| V4 | #5 | #49 | 0, 0, 1 |
| V5 | #6 | #50 | 1, 0, 1 |
| V6 | #7 | #51 | 1, 1, 1 |
| V7 | #8 | #52 | 0, 1, 1 |

| Edge | `EDGE_CURVE` | `LINE` (`VECTOR`, `DIRECTION`) | Start, end | Direction | Used forward by, reversed by |
|---|---|---|---|---|---|
| E0 | #53 | #33 (#21, #9) | V0, V1 | (1, 0, 0) | #73, #68 |
| E1 | #54 | #34 (#22, #10) | V1, V2 | (0, 1, 0) | #77, #67 |
| E2 | #55 | #35 (#23, #11) | V2, V3 | (-1, 0, 0) | #81, #66 |
| E3 | #56 | #36 (#24, #12) | V3, V0 | (0, -1, 0) | #85, #65 |
| E4 | #57 | #37 (#25, #13) | V4, V5 | (1, 0, 0) | #69, #75 |
| E5 | #58 | #38 (#26, #14) | V5, V6 | (0, 1, 0) | #70, #79 |
| E6 | #59 | #39 (#27, #15) | V6, V7 | (-1, 0, 0) | #71, #83 |
| E7 | #60 | #40 (#28, #16) | V7, V4 | (0, -1, 0) | #72, #87 |
| E8 | #61 | #41 (#29, #17) | V0, V4 | (0, 0, 1) | #86, #76 |
| E9 | #62 | #42 (#30, #18) | V1, V5 | (0, 0, 1) | #74, #80 |
| E10 | #63 | #43 (#31, #19) | V2, V6 | (0, 0, 1) | #78, #84 |
| E11 | #64 | #44 (#32, #20) | V3, V7 | (0, 0, 1) | #82, #88 |

Every edge is used exactly once forward and once reversed, so the shell #125 is closed and
consistently oriented. Each face below is `ADVANCED_FACE('',(#bound),#plane,.T.)` with one
`FACE_OUTER_BOUND(…,.T.)`; the placement's axis is the outward normal, and the loop's Newell
normal (the area vector of the vertex cycle) equals it, so each loop runs counter-clockwise seen
from outside.

| Face | `ADVANCED_FACE`, `PLANE`, placement | `EDGE_LOOP` | Oriented edges, sense | Vertex cycle | Axis, ref direction | Newell normal |
|---|---|---|---|---|---|---|
| bottom | #119, #113, #107 at V0 | #89 | #65 F, #66 F, #67 F, #68 F | V0 V3 V2 V1 V0 | -Z (#106), +X (#101) | (0, 0, -1) |
| top | #120, #114, #108 at V4 | #90 | #69 T, #70 T, #71 T, #72 T | V4 V5 V6 V7 V4 | +Z (#105), +X | (0, 0, 1) |
| front | #121, #115, #109 at V0 | #91 | #73 T, #74 T, #75 F, #76 F | V0 V1 V5 V4 V0 | -Y (#104), +X | (0, -1, 0) |
| right | #122, #116, #110 at V1 | #92 | #77 T, #78 T, #79 F, #80 F | V1 V2 V6 V5 V1 | +X (#101), +Y (#103) | (1, 0, 0) |
| back | #123, #117, #111 at V3 | #93 | #81 T, #82 T, #83 F, #84 F | V2 V3 V7 V6 V2 | +Y (#103), -X (#102) | (0, 1, 0) |
| left | #124, #118, #112 at V0 | #94 | #85 T, #86 T, #87 F, #88 F | V3 V0 V4 V7 V3 | -X (#102), +Z (#105) | (-1, 0, 0) |

Rest of the file: #125 `CLOSED_SHELL` of #119 to #124; #126 `MANIFOLD_SOLID_BREP('cube',#125)`;
#127 the part origin (V0, +Z, +X); #132 the context `(GEOMETRIC_REPRESENTATION_CONTEXT(3)
GLOBAL_UNCERTAINTY_ASSIGNED_CONTEXT((#131)) GLOBAL_UNIT_ASSIGNED_CONTEXT((#128,#129,#130))
REPRESENTATION_CONTEXT('cube context','3D'))`; #133 to #140 application context, protocol
definition (`automotive_design`, 2000), product context, `PRODUCT`, formation, definition
context, `PRODUCT_DEFINITION`, `PRODUCT_DEFINITION_SHAPE`; #141 the shape representation with
items #126 and #127 in context #132; #142 linking #140 to #141. Every reference names a lower id
and resolves. The tables and the witness arenas were produced and checked by a throwaway reader
written for this spec (loop closure, Newell normals, edge use counts, reference resolution, and
the arena of each variant against the unit cube's), not by the C# parser.

## String decoding (P21 6.4.3)

Applied to the text between the quotes, left to right; the result is Unicode text.

| Written | Decoded |
|---|---|
| `''` | one `'` |
| `\\` | one `\` |
| `\X\hh` | the character U+00hh (two upper-case hex digits, an ISO 8859-1 octet) |
| `\X2\hhhh…\X0\` | UTF-16 code units, four hex digits each, until `\X0\` (`\X2\00E9\X0\` is `é`) |
| `\X4\hhhhhhhh…\X0\` | Unicode code points, eight hex digits each, until `\X0\` |
| `\Pc\` (c in A to I) | selects ISO 8859-c for the `\S\` directives that follow; decodes to nothing. Page A (8859-1) at the start of every string |
| `\S\c` | the character of the selected page at the octet of c plus 128 |
| a line break inside the string | dropped (P21 5.6) |

## Parser-side changes

Both asks of the first version of this spec landed as TKT-310 (ara3d-sdk 002784d, 2026-10-17):
the parser reports a malformed or truncated file as a diagnostic with a byte offset and keeps the
parsed prefix, and `StepHeader` keeps all ten fields. Nothing is asked of the parser now.

## Findings for the supervising session

- **No `Diagnostic` equality.** Layer 3 has `IsSameFile` but no structural comparison of
  `Diagnostic` or `Provenance`, so the diagnostics column is compared by the test, field by field.
- **No executable form of the `Part21File` invariants.** `spec Part21File` states them as bounded
  quantifiers; `../03-step/step-witnesses.laws.plato` writes them as folds (`SatisfiesFileInvariants`).
  Layer 3 could own that function, so the C# tests and chunk D call one definition.
- **No code for a parse that stopped at an unknown place.** `P21-NOT-A-FILE` ("nothing was read")
  is the closest that points at `WholeInput`; superseded by `P21-SYNTAX-OUTSIDE-INSTANCE` (mapping table above).
- **Units differ from the kernel witness.** The fixtures are in millimetres (the task asked for
  that, and AP214 exporters write it); layer 7's `Witness_UnitBox` is in metres. Chunk D's law
  "decoding `Witness_Part21UnitBox` gives `Witness_UnitBox`" must either compare in millimetres
  or use a metre variant of the fixture.
- **Diagnostic multiplicity is not stated in layer 3.** Whether a dangling reference gives one
  Warning per value or per instance, and the order of diagnostics, are fixed here, not in
  `03-step`.
- **A non-ASCII Plato string.** `FixtureHeader` holds `"André Lefort"` as a UTF-8 literal. The
  front-end gate accepts it; whether the C# writer emits it intact is untested.

## Regenerating the fixtures and witnesses

`tools/gen_adapter.py <adapter folder>` writes the five fixtures, parses them back with its own
small Part 21 reader (not the C# one), builds every witness arena from `tools/witness_template.plato.txt`,
asserts the hand-verification facts above (loops close, loop normals match the planes' outward
axes, each edge is used once forward and once reversed, every reference resolves, each variant's
arena is a prefix of the cube's), and rewrites `../03-step/step-witnesses.laws.plato` (the
adapter folder's sibling `03-step`; the generator writes there, not beside itself, because the
witnesses are layer 3's data). Edit the generator or the template, never the generated file. Run
with `python -I` from outside the adapter folder, for example
`python -I sandbox/step-brep-mesh/adapter/tools/gen_adapter.py sandbox/step-brep-mesh/adapter`.
