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

- [ ] the unit cube and two-cube assembly fixtures decode to RawDecodedModel values equal to the Plato library's witnesses for them (Witness_UnitBoxMillimetres, Witness_TwoCubes in 03-step)
- [ ] PrepareModel (compiled Plato) of the decoded value equals the expected DecodedModel for both fixtures, run from C#; units are converted to millimetres and radians with the conversion factor recorded so Law_UnitsStated can check it
- [ ] decoding reads only through Ara3D.StepTypes descriptors; every entity it cannot represent is a diagnostic, never an exception
- [ ] all 88 files of the u-blox library decode with zero exceptions; counts of faces decoded and entities not represented are in the build log

Plan: docs/plans/step-reader.md, section 'Pivot: geometry in Plato' (owner decision 2026-10-17). The boundary between C# and Plato moves from Part21File to BrepModel (and the occurrences DecodeBrep would have produced), so decoding happens in compiler-checked generated C# rather than by string name in Plato (finding F-1). The exact input type and the witnesses come from the Plato session after it revises layer 3.

Boundary agreed with the Plato session 2026-10-17: C# does the structural mapping only (typed AP242 records to BrepModel tables as written: SameSense as in the file, Periodicity by surface family, never Closed, Closures empty), plus Occurrences, Sources, per-context Units and Uncertainty converted to millimetres and radians, and P21-*/decode diagnostics. Plato's PrepareModel(raw): DecodedModel keeps the four decisions that are geometry (closure from end coincidence at the length tolerance, mirror folding of left-handed placements, tolerance floors, reduction repairs) and computes ModelSize and CoordinateExtent. The 110 WHERE laws of 03-step become the specification the C# WHERE checks are written against. RawDecodedModel is declared by the Plato session in sandbox/step-brep-mesh/03-step.
