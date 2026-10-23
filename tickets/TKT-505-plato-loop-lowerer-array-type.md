---
id: TKT-505
title: Plato: loop lowering never fires on Array<T> because it matches the legacy name IArray; fix, regenerate with --loops, measure
status: done
depends_on: []
owner: session 1da356ea
session: 1da356ea-9103-45cc-bd33-09d578bd60e8
fence: [C:/Users/cdigg/git/plato/writers/Plato.CSharpWriter/**, C:/Users/cdigg/git/plato/tests/**, deps/bim-open-data/tools/regen-step-brep.ps1]
workflow: [W3]
related: [TKT-442, TKT-407]
confidence: high
created: 2026-10-23
claimed: 2026-10-23
closed: 2026-10-23
kind: defect
---

## Acceptance criteria

- [x] TirLoopLowerer and TirArrayMaterializer recognise receivers and results typed Array of T (the current stdlib name) as well as IArray; a test in the Plato tests compiles a MapRange, Map, Reduce and Any over Array of T with the loops flag and shows a for loop in the output
- [x] A regeneration of Ara3D.StepBrep with the loops flag on (through a regen-step-brep.ps1 switch, pin noted) builds, the mesher tests pass, and the corpus harness on ODIN-W160 and ELLA-W1 reports time and allocation before and after
- [x] The differential law run (interpreter against compiled C#) over sandbox/step-brep-mesh has no new mismatch

Found 2026-10-23 (docs/plans/step-mesher-generated-csharp-2026-10-23.md). The C# writer's loop lowering (`--loops`) and array materializer (`--optimize-arrays`) test the receiver type by name: `TirLoopLowerer.cs` lines 182, 256, 258 and 305 accept only `IArray`, the legacy stdlib's name. The STEP mesher library types its arrays `Array<T>`, so an experiment compiling the pinned inputs (Plato 60134758, layers 00 to 08) with `--inline --loops` lowered zero call sites: the output has no `for` loop, while 774 `MapRange`, 1,147 `Map`, 419 `Reduce` and 890 `All`/`Any` sites stayed delegate calls into the eager intrinsics. The regen script passes only `--out` and `--profile=cpu64`, so none of the four optimizer flags has ever reached the measured build.

Fix the name check (both names, or the type's identity rather than its name), then measure. The lowerer leaves lambdas, conditionals and the inside of `while` loops alone, so the gain is bounded to statement-level pipelines such as the seven `MapRange` arrays per round in `NeedsRefinementCarriedCounted` (`triangulation-neighbours-carried.library.plato`).

## Outcome (2026-10-23, Plato 6ff8c4a7, bim-open-data 1848845 and the pin move)

- Criterion 1: `TirRewrite.IsListType` and `ListElementType` (Plato `0786f567`) accept `Array<T>` and `IArray<T>`; the lowerer uses them at its four sites. `TirArrayMaterializer` has no type-name check, so it is unchanged (the report overstated it). `tests/PlatoTests/LoopLowererArrayTypeTests.cs`: MapRange, Map, Reduce and Any over `Array<T>` each become a `for` loop; the four cases fail on the old lowerer. PlatoTests: 298 pass, 4 fail, the four TKT-442 recorded.
- The lowerer's emission then needed fixing before its output compiled on this library (Plato `dcd908f5`, `6ff8c4a7`): the loop index as the Integer wrapper, the result bound as `IReadOnlyList<T>`, the Reduce accumulator typed by the call, statement-bodied lambdas left as delegates, inlined lambda parameters renamed per loop, and a negative MapRange count as the empty array. `plato run --loops` (Plato.Laws and Plato.CLI, outside the fence) compiles the lowered arm for the differential sweep; without it the sweep would have proved nothing.
- Criterion 2: `regen-step-brep.ps1 -Loops` (or `-CompilerFlags`), the flags in every file's header line, `$PinnedFlags` beside `$PinnedPlato`. Regeneration: 1,503 files, 2,444 `for` loops, stub check unchanged. `Ara3D.Step.Mesher.Tests`: 33 pass, 6 skipped. Harness (`time`, host path, parallel, warmup, five runs alternating on an idle machine, medians, allocated bytes over tables to assembly, digests identical): ODIN-W160 1,382 MB to 558 MB and 1,225 ms to 1,060 ms; ELLA-W1 3,457 MB to 1,638 MB and 2,712 ms to 2,848 ms (spread 2,398 to 3,136). Pin moved to `6ff8c4a7` with `--loops`.
- Criterion 3: differential sweep, 1,389 laws, budget 20 s: plain 1,285 pass, 10 fail, 10 error, 78 obligation, 6 skipped, 0 mismatches; `--loops` 1,286 pass, 10 fail, 9 error, 78 obligation, 6 skipped, 0 mismatches (one budget error passed). An earlier run on `dcd908f5` had 4 mismatches, all the negative-count MapRange, fixed in `6ff8c4a7`.
- Details and the stage table: `docs/plans/step-mesher-generated-csharp-2026-10-23.md` section 6.
- Not in the fence, reported: the harness's `AllocatedBytes` (bim-open-data `tools/step-corpus-harness`); an untracked `tests/data/Ara3D.Step.Mesher.Tests/Plato/PlatoBodyCutTests.cs` from another session breaks that test project's build (`StepText` does not exist), so the tests ran with `-p:DefaultExcludesInProjectFolder=Plato/PlatoBodyCutTests.cs`.
