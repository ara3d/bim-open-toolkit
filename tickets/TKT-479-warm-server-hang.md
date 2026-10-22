---
id: TKT-479
title: Plato warm law server: compiled law assemblies never unload, and an interpreter run with no budget (or a slow witness) holds its program's lock without limit
status: done
depends_on: []
owner: session f58080da
session: f58080da-237d-478d-a779-1bc570009dc2
fence: [C:/Users/cdigg/git/plato/src/Plato.Laws/CSharpProgram.cs, C:/Users/cdigg/git/plato/src/Plato.Navigation/**, C:/Users/cdigg/git/plato/tests/Plato.Navigation.Tests/**]
workflow: [W3]
related: [TKT-344, TKT-354, TKT-478]
confidence: medium
created: 2026-10-22
claimed: 2026-10-22
closed: 2026-10-22
kind: defect
---

## Acceptance criteria

- [x] a recompiled or evicted program unloads its compiled C# assemblies (a test sees the collectible load context unloaded)
- [x] a run past the server's run limit stops at its next interpreter step, including in witness evaluation and with budget=0, and releases its program's lock (a test runs a non-terminating law with budget=0 and a short limit)
- [x] the limitation that compiled laws abandoned after AbandonSeconds keep running is stated in the server's documentation

Found 2026-10-22 by the supervisor: the warm server on 8768 (navmcp-a7aeeb36-clean, started 07:39, --law-programs=8) was hung by 10:30 with a 15 GB working set, 56,000 CPU-seconds, and a type-check-only call blocked for over 4 hours; restarted as pid 25816. No log survived. Reading the code: (1) the program cache is bounded by count (8, least recently used), but CSharpProgram.Build loads every compiled program with Assembly.Load into the default load context, which never unloads, so each recompilation after an edit, and each evicted program, leaves its assembly loaded; (2) runs of one program are serialized under its lock, the interpreter stops a law only at its deadline, a request with budget=0 sets none, and LawRunner.EvaluateWitnesses clears the deadline, so a slow law or witness holds the lock without limit and every other call on that program waits, type checks included; (3) the C# backend cannot interrupt a law: one abandoned after AbandonSeconds (120 s) keeps running on its thread, which is CPU time with no request attached. CallMemo is bounded per function (4,096 entries), though an entry can hold a whole model.

## Resolution (2026-10-22, Plato 60134758, studio ade9c049)

- Compiled programs load into a collectible AssemblyLoadContext each (CSharpProgram.Unload); a WarmProgram unloads them when it recompiles, and the runner releases an evicted program once any run on it ends. CSharpProgramUnloadTests: the context is collected after Unload.
- Interpreter.RunLimit bounds a whole run (the law runner resets only the per-law Deadline); WarmLawRunner.RunLimit defaults to 30 minutes, and the studio server takes --law-run-limit=<seconds>. WarmLawRunnerTests: a 16-million-call law with budget=0 stops at a 3 s limit and the next run on the program passes. On a server built from clean exports (navmcp-60134758-clean, --law-run-limit=5): the slow law stopped at 5.9 s with "run limit reached", and a type check on the same program then answered in 0.5 s.
- Not fixed, documented in the studio README (labs/PlatoNavigationMcp): one intrinsic step of the interpreter (building a 100-million-element Range) is not interrupted, and a compiled law abandoned after 120 s keeps its thread running.
- The working set of a server compiling a small program 15 times grew about as fast before and after the change (700 to 1,600 MB and 700 to 1,280 MB), so it is not a measure of this leak at that size; the unload test is the evidence. The 15 GB server compiled the 1,400-file mesher program, whose assemblies are far larger.
- Generated C#: this ticket changes nothing the generator reads. Plato 60134758 also contains TKT-445, 446 and 447 from other sessions; against c8c83c8b, the mesher's generated C# differs in _TriangleFace.g.cs and _QuadFace.g.cs only (TKT-447: At(index) out of range now faults instead of returning the last corner).
