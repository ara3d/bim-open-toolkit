---
id: TKT-508
title: Plato: document the optimizer pipeline for agents (passes, flags, recognised shapes, runtime contract) and split the passes along the data flow
status: open
depends_on: []
owner:
fence: [C:/Users/cdigg/git/plato/docs/**, C:/Users/cdigg/git/plato/writers/Plato.CSharpWriter/**, C:/Users/cdigg/git/plato/AGENTS.md]
workflow: [W3]
related: [TKT-442, TKT-407]
confidence: high
created: 2026-10-23
---

## Acceptance criteria

- [ ] One document under the Plato docs names every pass between the elaborated TIR and the emitted C# in order (the short-circuit rewrite, TirInliner, ComponentUnroller, TirArrayMaterializer, TirLoopLowerer, TirCSharpBodyWriter) and gives for each the flag that enables it, the shapes it recognises, the shapes it refuses and why, the runtime intrinsic it relies on, and the test that pins it
- [ ] The document states the runtime contract as it is: MapRange, Reduce and FlatMap are the only array intrinsics and MapRange is eager; the stale statements that Map returns a lazy view (TirArrayMaterializer.cs header, optimizer-stage2-plan.md) and that Take, Skip, Slice and Concatenate never copy (primitives.library.plato) are corrected or dated
- [ ] Each pass lives in its own file with a header saying what it consumes and produces; the pipeline order is written once, in CSharpWriter, and the passes refer to it rather than repeat it
- [ ] An agent reading only the document can say, for a given Plato expression, which pass changes it under which flags; the Plato repository's AGENTS.md points to the document

Asked by the owner on 2026-10-23 while docs/plans/step-mesher-generated-csharp-2026-10-23.md was being written: the paths through the optimizer need to be clearly documented for agents, and the data flow and the algorithms split so each is as easy to understand as possible.

What a reader meets today: four flags whose only description is a comment in `src/Plato.CLI/Program.cs`; a materializer (`TirArrayMaterializer.cs`) whose header describes a lazy runtime that TKT-350 replaced with an eager one; a loop lowerer that silently matches a type name the stdlib no longer uses (the defect filed beside this ticket went unnoticed because nothing states what the pass expects); and `docs/design/optimizer-stage2-plan.md`, which lists fusion and consumer-side lowering as future work without saying what has landed since. Write the document from the code, not from the plans, and keep it to the paths that exist.
