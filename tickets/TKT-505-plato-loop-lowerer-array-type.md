---
id: TKT-505
title: Plato: loop lowering never fires on Array<T> because it matches the legacy name IArray; fix, regenerate with --loops, measure
status: open
depends_on: []
owner:
fence: [C:/Users/cdigg/git/plato/writers/Plato.CSharpWriter/**, C:/Users/cdigg/git/plato/tests/**, deps/bim-open-data/tools/regen-step-brep.ps1]
workflow: [W3]
related: [TKT-442, TKT-407]
confidence: high
created: 2026-10-23
kind: defect
---

## Acceptance criteria

- [ ] TirLoopLowerer and TirArrayMaterializer recognise receivers and results typed Array of T (the current stdlib name) as well as IArray; a test in the Plato tests compiles a MapRange, Map, Reduce and Any over Array of T with the loops flag and shows a for loop in the output
- [ ] A regeneration of Ara3D.StepBrep with the loops flag on (through a regen-step-brep.ps1 switch, pin noted) builds, the mesher tests pass, and the corpus harness on ODIN-W160 and ELLA-W1 reports time and allocation before and after
- [ ] The differential law run (interpreter against compiled C#) over sandbox/step-brep-mesh has no new mismatch

Found 2026-10-23 (docs/plans/step-mesher-generated-csharp-2026-10-23.md). The C# writer's loop lowering (`--loops`) and array materializer (`--optimize-arrays`) test the receiver type by name: `TirLoopLowerer.cs` lines 182, 256, 258 and 305 accept only `IArray`, the legacy stdlib's name. The STEP mesher library types its arrays `Array<T>`, so an experiment compiling the pinned inputs (Plato 60134758, layers 00 to 08) with `--inline --loops` lowered zero call sites: the output has no `for` loop, while 774 `MapRange`, 1,147 `Map`, 419 `Reduce` and 890 `All`/`Any` sites stayed delegate calls into the eager intrinsics. The regen script passes only `--out` and `--profile=cpu64`, so none of the four optimizer flags has ever reached the measured build.

Fix the name check (both names, or the type's identity rather than its name), then measure. The lowerer leaves lambdas, conditionals and the inside of `while` loops alone, so the gain is bounded to statement-level pipelines such as the seven `MapRange` arrays per round in `NeedsRefinementCarriedCounted` (`triangulation-neighbours-carried.library.plato`).
