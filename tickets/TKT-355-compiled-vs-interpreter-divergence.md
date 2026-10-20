---
id: TKT-355
title: Three mesher laws pass in the interpreter and fail on compiled C#: Law_WitnessIsSameAsItself and Law_ReversalIsAnInvolution on witness 7, Law_UpdatedNeighboursAreTheTable on k = -1
status: open
depends_on: []
owner:
fence: [../plato/writers/**, ../plato/src/**, ../plato/tests/**]
workflow: [W3]
related: [TKT-354, TKT-317]
confidence: high
created: 2026-10-19
kind: defect
---

## Acceptance criteria

- [ ] the cause of each of the three divergences is named (writer, runtime or interpreter) with the Plato expression whose value differs between the backends
- [ ] after the fix the three laws reach the same verdict on both backends and the differential test still has 0 mismatches under cpu64 and gpu32

Found by the first compiled sweep of the mesher library (TKT-354; Plato e37c032f, pinned at C:/Users/cdigg/.plato-cli/e37c032f; library at bim-open-toolkit d3d297ce, profile cpu64). Three laws pass in the interpreter and fail on the compiled C#, on the same witnesses in the same order; reproduced alone with `--budget=0` on both backends:

    dotnet C:/Users/cdigg/.plato-cli/e37c032f/Plato.CLI.dll run stdlib/foundation stdlib/geometry stdlib/graphics C:/Users/cdigg/git/bim-open-toolkit/sandbox/step-brep-mesh --recursive --exclude=brep.types.plato --exclude=brep.library.plato --exclude=brep.concepts.plato --laws --backend=csharp --profile=cpu64 --budget=0 --filter=Law_WitnessIsSameAsItself,Law_ReversalIsAnInvolution,Law_UpdatedNeighboursAreTheTable

| law | first failing witness (compiled) | interpreted |
|---|---|---|
| ToolingDiffsLaws.Law_WitnessIsSameAsItself | case 9: k = 7 | pass, 14 cases exhaustive |
| ToolingGeneratorsLaws.Law_ReversalIsAnInvolution | case 4: k = 7, seed = 10, index = 11 | pass, 25 cases |
| TriangulationFastLaws.Law_UpdatedNeighboursAreTheTable | case 1: k = -1 | pass, 14 cases exhaustive |

The two tooling laws fail on witness 7 of BrepModel.WitnessAt, Witness_BSplinePatchSolid, and only there: `BrepModel.WitnessAt(7).DiffModels(BrepModel.WitnessAt(7)).IsSame` is false compiled, so a model compared with itself differs somewhere. The third fails on TriSampleModel(-1), the sphere by pole loops (index 9), where UpdatedTableIsTable does not hold compiled. Every other law of the 802 reaches the same verdict on both backends, and the differential test over 39 stdlib laws (tests/Plato.Interpreter.Tests/DifferentialTests.cs) has 0 mismatches, so the divergence is in something these models exercise and the stdlib laws do not. Hypotheses to check first: Number equality on NaN (the interpreter's Equals(Number, Number) is double.Equals, under which NaN equals NaN; a `==` in the emitted C# or the runtime would say false) or on -0.0; integer division or modulo of negatives; an array or List operation the runtime and interpreter order differently. Decide by evaluating the law body step by step on both backends (`plato run --call=` for nullary pieces) and file the fix against the writer, the runtime (src/Plato.Intrinsics) or the interpreter, whichever disagrees with Plato's stated semantics.
