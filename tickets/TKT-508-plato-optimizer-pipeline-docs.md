---
id: TKT-508
title: Plato: document the optimizer pipeline for agents (passes, flags, recognised shapes, runtime contract) and split the passes along the data flow
status: done
depends_on: []
owner: session e0a829d8
session: e0a829d8-a881-4096-b67d-9d7c6cd6b337
fence: [C:/Users/cdigg/git/plato/docs/**, C:/Users/cdigg/git/plato/writers/Plato.CSharpWriter/**, C:/Users/cdigg/git/plato/AGENTS.md]
workflow: [W3]
related: [TKT-442, TKT-407]
confidence: high
created: 2026-10-23
claimed: 2026-10-23
closed: 2026-10-23
---

## Acceptance criteria

- [x] One document under the Plato docs names every pass between the elaborated TIR and the emitted C# in order (the short-circuit rewrite, TirInliner, ComponentUnroller, TirArrayMaterializer, TirLoopLowerer, TirCSharpBodyWriter) and gives for each the flag that enables it, the shapes it recognises, the shapes it refuses and why, the runtime intrinsic it relies on, and the test that pins it
- [x] The document states the runtime contract as it is: MapRange, Reduce and FlatMap are the only array intrinsics and MapRange is eager; the stale statements that Map returns a lazy view (TirArrayMaterializer.cs header, optimizer-stage2-plan.md) and that Take, Skip, Slice and Concatenate never copy (primitives.library.plato) are corrected or dated
- [x] Each pass lives in its own file with a header saying what it consumes and produces; the pipeline order is written once, in CSharpWriter, and the passes refer to it rather than repeat it
- [x] An agent reading only the document can say, for a given Plato expression, which pass changes it under which flags; the Plato repository's AGENTS.md points to the document

Asked by the owner on 2026-10-23 while docs/plans/step-mesher-generated-csharp-2026-10-23.md was being written: the paths through the optimizer need to be clearly documented for agents, and the data flow and the algorithms split so each is as easy to understand as possible.

What a reader meets today: four flags whose only description is a comment in `src/Plato.CLI/Program.cs`; a materializer (`TirArrayMaterializer.cs`) whose header describes a lazy runtime that TKT-350 replaced with an eager one; a loop lowerer that silently matches a type name the stdlib no longer uses (the defect filed beside this ticket went unnoticed because nothing states what the pass expects); and `docs/design/optimizer-stage2-plan.md`, which lists fusion and consumer-side lowering as future work without saying what has landed since. Write the document from the code, not from the plans, and keep it to the paths that exist.

## Evidence (2026-10-23)
- Plato 858335e7 (pushed): `docs/csharp-optimizer-pipeline.md` (passes, flags, refusals, runtime contract, worked example under six flag combinations, unimplemented list); stale text corrected in `writers/Plato.CSharpWriter/TirArrayMaterializer.cs`, `docs/design/optimizer-stage2-plan.md`, `stdlib/foundation/primitives.library.plato`; pass headers in `TirInliner.cs`, `TirComponentUnroller.cs`, `TirLoopLowerer.cs`, `TirCSharpBodyWriter.cs`; order written once in `CSharpWriter.RunOptimizerPasses`; `AGENTS.md` and `docs/README.md` point to the document.
- Pinning tests run: ArrayMaterializerTests, ComponentUnrollerTests, InlinerTests, LoopLowererArrayTypeTests (20 pass); ShortCircuitTests (4 pass).
- Finding: `--optimize-arrays` writes `MapEager`/`MapRangeEager`, defined only under `src/Plato.Intrinsics/bonepile` (not in the compiled projitems), and since TKT-350 the rename changes no behaviour. Documented; a ticket to retire the pass is open for the owner.
