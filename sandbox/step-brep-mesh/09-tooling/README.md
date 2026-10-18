# Layer 9: test tooling

Written 2026-10-17 under TKT-316. The owner's concern that day: starting with small, trivial data
is risky, and debugging needs tools to generate test data, compare results, and see what is
happening, provided building them does not slow the main line. This folder holds those tools as
Plato, beside the library rather than inside it: no layer from 0 to 8 names anything declared
here (checked by searching the layer folders for every type and library name of this folder).

Four tools, in the order a developer reaches for them:

| Tool | Files | What it answers |
|---|---|---|
| Law runner | `tooling-law-runner.*` | Which laws hold on which witness, under which backend |
| Diffs | `tooling-diffs.*`, `tooling-diff-helpers.library.plato` | Where exactly two values differ, instead of "not equal" |
| Dumps | `tooling-dumps.*` | What a mesh, a parameter-plane region, a report, or every stage of a run looks like |
| Generators | `tooling-generators.*` | Many valid models from each witness family, perturbed with a known effect, and corpus files |

Contracts of the host shims are in `tooling.spec.plato`, which the gate does not read.

## Using it on a failing law

1. **Run, and get the failing input.** The law runner's table names the law, the witness or the
   family, and the index that failed (`Measure`). A generated model is reproduced from three
   values: `WitnessFamily.DefaultFamilyAt(j).SampleModel(seed, index)`. A corpus file comes from
   `LoadCorpusModel(root, CorpusEntry.CorpusEntryAt(i))`.
2. **Diff against what was expected.** `DiffModels(actual, expected)` (or `DiffMeshes`,
   `DiffConnectivity`, `DiffFaceMeshes`, `DiffDiscretizations`, `DiffReports`, `DiffFiles`)
   returns `Same`, or the first difference: the table, the row, the slot inside the row, the
   field, both values, and the tolerance used, with the count of all differences. The `Within`
   forms take a tolerance for coordinates. `ModelDifferencesTable` and `MeshDifferencesTable`
   list every difference as a table. For a model difference, `DifferenceProvenance` gives the
   kernel row as a layer 0 `Provenance`.
3. **Dump and look.** `DumpStages(m, o)` keeps every stage of `MeshModel`: the loop state after
   each round, each face's parameter-plane region, and the outcome. The host writes it as one
   folder: `mesh.glb` for the toolkit's 3D pane (each model face its own colour; the vertex
   attributes `_VERTEX` and `_PROVENANCE` say which mesh vertex and which model vertex, edge
   or face each corner came from), `round-<k>.glb` per round, `face-<f>.svg` per face (the
   region's loops, seams, poles and vertex labels over its triangulation), and `report.csv`
   and `rounds.csv` for the notebook.

## Law runner

Laws compile to Boolean functions in the C# backend, but nothing builds their witness arguments
and calls them (TKT-311). `LawReportOf(backend)` does, in Plato:

- Laws with a `Check_` form run through layer 7's validators. For each of the thirteen model
  witnesses (the ten positive ones and the three negative ones), the runner takes the checks of
  `ValidateBrep` at the Oracle level and of the report of meshing the witness under layer 8's
  witness options; for the tetrahedron mesh witness, `ValidateModelMesh`. Each check becomes a
  `LawRun`. These laws are therefore listed once, by layer 7, and never here.
- A negative witness's expected failures come from layer 7's table: failing one gives
  `FailedAsExpected`, holding one gives `HeldUnexpectedly`, a defect.
- The witness laws written over Integer selectors (layers 3, 7, 8 and this layer) are listed by
  hand, one line each, through quantifiers that sweep every positive witness and every shell,
  face, edge or vertex of it.
- Laws over Number parameters are swept over eight generated samples where a family fits
  (box, cylinder, sphere radius, hollow box, B-spline bump), or reported `Skipped` with the
  reason (three are: drawn chordal pairs, drawn frames with a re-mesh per vertex, and a
  re-mesh per vertex).
- Laws of other shapes (layer 0 and 1 over scalars and curve data, layer 3's WHERE rules over
  `Part21File`, layers 4 and 5 over discretizations and face meshes) are not enumerated. The
  host prints every reflected `Law_` method that no run carries as "not enumerated", so the gap
  is visible rather than silent. Of the 714 laws in layers 0 to 8 on 2026-10-17, those are the
  majority; enumerating them is per-layer work for the chunk that gives the layer its bodies.

**Backend results are untrusted until TKT-315's writer fixes land**: nested conditionals
miscompile in the C# backend. `LawReport.Backend` records the writer the host ran under, every
table row repeats it, and the host prints a warning while the fixes are missing.

The runner meshes witnesses many times over (each layer 8 law meshes again; Plato has no memo).
That is acceptable for ten small witnesses; a slow run is a reason to add a per-witness cache in
the host, not to change the laws.

## Diffs

`ModelDiff`, `DiscretizationDiff`, `MeshDiff`, `ReportDiff` and `FileDiff` are each
`Same | Differs(First, Count)`, where `First` is a `LocatedDifference<Table>`: the table (a sum
per compared type, in the type's field order), row, slot (the position inside a nested array
such as a face's bounds, or -1), and a `Difference` (field name, left and right as `CellValue`,
tolerance). A count mismatch is reported at the first row present on one side only. Every
difference is found in table, row, slot, field order; the first is the head.

Laws in `tooling-diffs.laws.plato` make each diff and its Boolean equality one definition:
`SameDiscretization`, `SameFaceMesh`, `SameFaceMeshOutcome`, `SameConnectivity`, layer 8's
`SameModelMesh`, `IsSameFile` and layer 0's `Identical` on reports hold exactly when the exact
diff is `Same`. Chunk A's owner may replace those bodies with "the diff is Same" without
changing a verdict.

**`SameModel` compares everything** since chunk A (finding F-51, TKT-314): the parameter-plane
curves, the pcurves, a loop's and a body's case, and a poly loop's points were added to layer 7's
body, `SameBeyondSameModel` was deleted, and the model law is the plain equality
`DiffModels(a, b).IsSame == SameModel(a, b)`. `SameModel` keeps its own body rather than calling
`DiffModels`, because layer 7 may not name layer 9; the law keeps the two in step.

Sum-typed rows (curves, surfaces, provenances) are compared with `==` and printed by case name:
Field `Case` when the cases differ, `Payload` when only the payload does. Plato cannot compose
strings, so a differing payload is found by dumping the row.

## Dumps

All conversions are pure and total; they work on a broken mesh, which is when they are needed.

- **3D.** The pane (`deps/bim-open-viewer`, `loadGlb`) reads GLB through three's `GLTFLoader` and
  colours each mesh by its material; it does not read vertex colours. So `ModelMeshDump` makes
  one part, one glTF mesh and one material per model face, with the colour from the face index
  (hues a golden-ratio turn apart). Corners are a triangle soup (quads split A-C, as layer 6
  realizes them), so a vertex shared by two faces appears in both parts; `_VERTEX` maps it back.
  The stdlib's `Scene3D` holds only `TriangleMesh3D` (positions and faces), so it cannot carry
  colour or provenance, and is not used.
- **Parameter plane.** `RegionToSvg(region, triangulation)` returns an `SvgDocument` of layers of
  marks (traces, dots, integer labels). Plato strings have literals and `==` only, so the host
  serializes. The stdlib's `Scene2D` would need `TextLayout` for labels and a Scene2D-to-SVG
  writer that does not exist; if one appears, `RegionToSvg` can target it.
- **Tables.** `ResultTable` (title, column names, rows of `CellValue`) is written as CSV, which
  the toolkit's CSV source reads, so the notebook shows it: `ReportToTable`, `StateTable`,
  `LawReportTable`, `LawSummaryTable`, `DifferencesTable`.

## Generators

Plato has no generic sums, so there is no `Generator<T>`. Each witness family of layer 7 has a
record of parameter ranges (`BoxFamily`, `CylinderFamily`, `SphereFamily` with three forms,
`TorusFamily`, `ConeFamily`, `BlockWithHoleFamily`, `HollowBoxFamily`, `BSplinePatchFamily`),
and the parameterless negative witnesses are `FixedWitness` values varied by a drawn motion.
`WitnessFamily` gathers them; `DefaultFamilyAt(k)` gives fourteen default families. Constrained
parameters (a minor radius, a hole, a void) are drawn as a ratio of the one they must stay
below, so every sample is valid. A sample is a pure function of family, seed and index over an
integer hash, so sample i never depends on samples before it. `SampleFacts` gives the same
sample's expected counts, areas and volumes from layer 7's closed forms; it is empty where layer
7 states none.

`Perturbation` is `RigidMotion | Scale | Jitter | FaceReversal | EdgeReversal |
EveryFaceReversal`. What each keeps is a law in `tooling-generators.laws.plato`: every one keeps
table sizes and raw shell counts; motions keep every edge, face, shell and body row; reversals
are involutions; jitter of up to half the length tolerance moves no vertex further than the
tolerance; volume follows a known factor (1, 8^k for a scale by 2^k, -1 for every face
reversed; no statement for one face reversed or for jitter).

The hash relies on 32-bit wrapping Integer multiplication, as the stdlib's `Hash` functions do.

## Host shims

Bodiless functions marked `// host:`, with contracts in `tooling.spec.plato`. Each is a thin
writer or reader; the conversion is Plato. The C# host provides:

| Shim | Does |
|---|---|
| Law runner entry point (`Main`, no Plato signature) | `LawReportOf(backend)`; writes `LawReportTable` and `LawSummaryTable` as CSV; prints reflected `Law_` names no run carries; prints the backend and, until TKT-315 lands, an untrusted-results warning; exit 0 exactly when `IsPassing` |
| `LoadCorpusModel(root, entry): RawDecodedModel` | TKT-312's `DecodeRaw` on `<root>/<Source>/<Name>`; an unreadable file gives an empty model and one `TOOLING-FILE-UNREADABLE` Error |
| `WriteMeshDump(path, dump): Report` | `path.glb` (node, mesh, material per part; `POSITION`, `NORMAL`, `_VERTEX`, `_PROVENANCE`) and `path.obj` with `path.mtl` |
| `WriteSvg(path, drawing): Report` | SVG 1.1, viewBox from `View`, 800 pixels wide |
| `WriteTable(path, table): Report` | CSV, RFC 4180 |
| `WriteStageDump(folder, dump): Report` | `model.json`, `options.json`, `mesh.glb/.obj/.mtl`, `round-<k>.glb`, `face-<f>.svg`, `report.csv`, `rounds.csv` |
| Dump command (`Main`) | `--witness k` runs `DumpWitnessStages(k)`, `--family j --seed s --index i` dumps a sample, `--corpus i` a corpus file, then `WriteStageDump` |

The runner and the dump command can run either on compiled C# (TKT-313) or on the Plato
interpreter of TKT-317, which needs no code generation.

## Found while building

- A conditional nested thirteen deep failed to parse, and the parser reported a location
  hundreds of lines earlier than the construct. `DefaultFamilies` is an array literal instead.
  The `stopped at` position of a parse failure is not where the fault is; bisect the file.
- A statement-level `h = (h * c).BitwiseAnd(m);` was the first suspect for the same report; it
  was not the cause, but the hash is written as expression-bodied steps anyway.
- `match` on a field read (`match (d.Table)`, `match (f.Form)`) fails the sum checker with
  CHK304 (`?` or `Any`), as PLATO-PRIMER.md section F says; pass the field to a helper.
- A generic function cannot take a type variable as its first parameter (`InTable(t: $T, ...)`
  halts the compiler: "not a concrete type or interface"); put the array first.

## Gate

`PASS: 0 error(s) in scope` with the whole sandbox merged and `brep.*.plato` excluded,
2026-10-17.
