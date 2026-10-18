---
id: TKT-312
title: Decode a parsed STEP file into the Plato library's RawDecodedModel (the B-rep as written) through the generated AP242 types (C#); Plato's PrepareModel finishes it
status: open
depends_on: [TKT-311]
owner:
fence: [deps/bim-open-data/src/data/Ara3D.Step.Mesher/Decode/**, deps/bim-open-data/tests/data/Ara3D.Step.Mesher.Tests/Decode/**, deps.json]
workflow: [W3, W4]
related: [TKT-299, TKT-304, TKT-305]
confidence: high
created: 2026-10-17
---

## Acceptance criteria

- [ ] the unit cube and two-cube assembly fixtures decode to RawDecodedModel values equal to the Plato library's witnesses for them (RawDecodedModel.Witness_RawUnitCube and RawDecodedModel.Witness_RawTwoCubes, compared with SameRawModel; sandbox/step-brep-mesh/03-step/step-raw-witnesses.library.plato)
- [ ] Law_RawUnitCubePreparesToUnitBox and Law_RawTwoCubesPreparesToTwoBodies hold with the decoded values in place of the witnesses (PrepareModel, compiled Plato, run from C#); units are millimetres and radians with LengthFactor and AngleFactor recorded so Law_UnitsFactorsAgree holds
- [ ] decoding reads only through Ara3D.StepTypes descriptors; every entity it cannot represent is a diagnostic, never an exception
- [ ] all 88 files of the u-blox library decode with zero exceptions; counts of faces decoded and entities not represented are in the build log

Plan: docs/plans/step-reader.md, section 'Pivot: geometry in Plato' (owner decision 2026-10-17). The boundary between C# and Plato moves from Part21File to BrepModel (and the occurrences DecodeBrep would have produced), so decoding happens in compiler-checked generated C# rather than by string name in Plato (finding F-1). The exact input type and the witnesses come from the Plato session after it revises layer 3.

Boundary agreed with the Plato session 2026-10-17: C# does the structural mapping only (typed AP242 records to BrepModel tables as written: SameSense as in the file, Periodicity by surface family, never Closed, Closures empty), plus Occurrences, Sources, per-context Units and Uncertainty converted to millimetres and radians, and P21-*/decode diagnostics. Plato's PrepareModel(raw): DecodedModel keeps the four decisions that are geometry (closure from end coincidence at the length tolerance, mirror folding of left-handed placements, tolerance floors, reduction repairs) and computes ModelSize and CoordinateExtent. The 110 WHERE laws of 03-step become the specification the C# WHERE checks are written against. RawDecodedModel is declared by the Plato session in sandbox/step-brep-mesh/03-step.

Contract as committed by the Plato session, 2026-10-17 (bim-open-toolkit 44aa7687, a4b2cffa; sandbox/step-brep-mesh/03-step/step-decode.types.plato, step.library.plato where DecodeRaw(file, policy): RawDecodedModel is the bodiless C# obligation, step.laws.plato, README section "Boundary moved to RawDecodedModel, 2026-10-17"). RawDecodedModel = Model (BrepModel as written: millimetres and radians, SameSense as in the file, Closures empty, Tolerances = UnsetTolerances, Unit = Millimetre); Occurrences; Sources: KernelSources; Folds: Array<FoldRecord> (oriented_face / oriented_closed_shell flips the file asks for, recorded by C#, applied by Plato); Repairs: Array<RepairRecord> (only instances C# skipped); Units: Array<ContextUnits> (with uncertainty); LengthFactor, AngleFactor (root context); Diagnostics (not compared). Rows in ascending instance id within each occurrence, occurrences in order. Not carried yet, do not try: closed_curve / u_closed / v_closed flags, angle factors of non-root contexts (convert inside the decoder), steradian. Fixture fact: in two-cubes-assembly.stp SHAPE_REPRESENTATION #147 holds no B-rep, so both cubes are root occurrences placed by #161 and #162 (Plato finding F-49).
