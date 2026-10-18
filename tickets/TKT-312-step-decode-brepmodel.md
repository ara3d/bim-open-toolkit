---
id: TKT-312
title: Decode a parsed STEP file into the Plato library's RawDecodedModel (the B-rep as written) through the generated AP242 types (C#); Plato's PrepareModel finishes it
status: done
depends_on: [TKT-311]
owner: session 10b9c9c6
session: 10b9c9c6-0052-40f3-a1c2-c12f2f8861d7
fence: [deps/bim-open-data/src/data/Ara3D.StepBrep/**, deps/bim-open-data/src/data/Ara3D.Step.Decode/**, deps/bim-open-data/tests/data/Ara3D.Step.Decode.Tests/**, deps/bim-open-data/tools/regen-step-brep.ps1, deps/bim-open-data/BimOpenData.sln, deps/bim-open-data/README.md, deps/bim-open-data/src/data/README.md, deps.json, docs/plans/step-reader.md]
workflow: [W3, W4]
related: [TKT-299, TKT-304, TKT-305]
confidence: high
created: 2026-10-17
claimed: 2026-10-17
closed: 2026-10-18
---

## Acceptance criteria

- [x] the unit cube and two-cube assembly fixtures decode to RawDecodedModel values equal to the Plato library's witnesses for them (RawDecodedModel.Witness_RawUnitCube and RawDecodedModel.Witness_RawTwoCubes, compared with SameRawModel; sandbox/step-brep-mesh/03-step/step-raw-witnesses.library.plato)
- [x] Law_RawUnitCubePreparesToUnitBox and Law_RawTwoCubesPreparesToTwoBodies hold with the decoded values in place of the witnesses (PrepareModel, compiled Plato, run from C#); units are millimetres and radians with LengthFactor and AngleFactor recorded so Law_UnitsFactorsAgree holds (bim-open-data 761c2cb: both laws hold with the decoded models, Ara3D.StepBrep regenerated from the library at 6aee137d after step D gave Reduced and ToleranceDiagnostics bodies; Ara3D.Step.Decode.Tests 14 passed, 0 inconclusive)
- [x] decoding reads only through Ara3D.StepTypes descriptors; every entity it cannot represent is a diagnostic, never an exception
- [x] all 88 files of the u-blox library decode with zero exceptions; counts of faces decoded and entities not represented are in the build log

Plan: docs/plans/step-reader.md, section 'Pivot: geometry in Plato' (owner decision 2026-10-17). The boundary between C# and Plato moves from Part21File to BrepModel (and the occurrences DecodeBrep would have produced), so decoding happens in compiler-checked generated C# rather than by string name in Plato (finding F-1). The exact input type and the witnesses come from the Plato session after it revises layer 3.

Boundary agreed with the Plato session 2026-10-17: C# does the structural mapping only (typed AP242 records to BrepModel tables as written: SameSense as in the file, Periodicity by surface family, never Closed, Closures empty), plus Occurrences, Sources, per-context Units and Uncertainty converted to millimetres and radians, and P21-*/decode diagnostics. Plato's PrepareModel(raw): DecodedModel keeps the four decisions that are geometry (closure from end coincidence at the length tolerance, mirror folding of left-handed placements, tolerance floors, reduction repairs) and computes ModelSize and CoordinateExtent. The 110 WHERE laws of 03-step become the specification the C# WHERE checks are written against. RawDecodedModel is declared by the Plato session in sandbox/step-brep-mesh/03-step.

Contract as committed by the Plato session, 2026-10-17 (bim-open-toolkit 44aa7687, a4b2cffa; sandbox/step-brep-mesh/03-step/step-decode.types.plato, step.library.plato where DecodeRaw(file, policy): RawDecodedModel is the bodiless C# obligation, step.laws.plato, README section "Boundary moved to RawDecodedModel, 2026-10-17"). RawDecodedModel = Model (BrepModel as written: millimetres and radians, SameSense as in the file, Closures empty, Tolerances = UnsetTolerances, Unit = Millimetre); Occurrences; Sources: KernelSources; Folds: Array<FoldRecord> (oriented_face / oriented_closed_shell flips the file asks for, recorded by C#, applied by Plato); Repairs: Array<RepairRecord> (only instances C# skipped); Units: Array<ContextUnits> (with uncertainty); LengthFactor, AngleFactor (root context); Diagnostics (not compared). Rows in ascending instance id within each occurrence, occurrences in order. Not carried yet, do not try: closed_curve / u_closed / v_closed flags, angle factors of non-root contexts (convert inside the decoder), steradian. Fixture fact: in two-cubes-assembly.stp SHAPE_REPRESENTATION #147 holds no B-rep, so both cubes are root occurrences placed by #161 and #162 (Plato finding F-49).

Waits on TKT-315 (the Plato session's builder in the Plato repository): after the Number profile (plato-271) it applies TKT-311's six C# writer fixes and three stdlib fixes, one commit each. TKT-312 resumes when fixes 2 (typed-index subscripts), 3 (IIndexable functions on arrays) and 5 (sum-type equality) are in; the Plato session relays the commit ids.

2026-10-17: the writer fixes this ticket needs are on Plato main (fix 2 3d5d21d9, fix 3 ced94312 + a2d41c7b, fix 5 54a3996a; also fix 1 5c2ad367, fix 4 cb274ffc, compiler-461 c0abb82a). TKT-315 stays open for fix 6, three stdlib defects and a CS0305 in layer 09-tooling, none of which affects layers 0 to 3, so the dependency on TKT-315 is dropped.

2026-10-18 (builder 10b9c9c6), bim-open-data 9e645f4, 9e9c123, 94fc392 and the tests commit: `Ara3D.StepBrep` (the library compiled by Plato, regenerated by `tools/regen-step-brep.ps1`, cpu64), `Ara3D.Step.Decode` (`StepDocument.DecodeRaw()`), `Ara3D.Step.Decode.Tests`. Criterion 1: both fixtures decode to the witnesses under `SameRawModel`. Criterion 3: reads go through the descriptors (one mixed SELECT list through its descriptor's token, `StepSelectReaders`); every failure is a diagnostic and a Skipped repair. Criterion 4: 88 files, 0 exceptions, 192,457 faces, 0 skipped rows, 33 s; table in the build log. Criterion 2 is not met: `Law_UnitsFactorsAgree` holds on both decoded models, but `PrepareModel` throws NotImplementedException because `Reduced` and `ToleranceDiagnostics` have no bodies in `step.library.plato` (TASKS.md chunk D, the Plato session, paused), so both prepare laws are inconclusive with the decoded values and with the library's own witnesses. Not a writer defect. One deviation: writer fix 6 (plato-459) was paused, so `Ara3D.StepBrep/BodilessStubs.cs` holds the throwing `FlatRecord` stub the fixed writer will emit (build log).
