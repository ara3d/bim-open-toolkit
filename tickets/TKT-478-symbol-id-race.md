---
id: TKT-478
title: Plato: symbols made by two compilations at once could share an Id, so an expression took a child for itself (Circular expression, no location)
status: done
depends_on: []
owner: session f58080da
session: f58080da-237d-478d-a779-1bc570009dc2
fence: [C:/Users/cdigg/git/plato/src/Plato.Compiler/Symbols/**, C:/Users/cdigg/git/plato/writers/Plato.CSharpWriter/**, C:/Users/cdigg/git/plato/src/Plato.Navigation/**, C:/Users/cdigg/git/plato/tests/**]
workflow: [W3]
related: [TKT-345, TKT-344]
confidence: high
created: 2026-10-22
claimed: 2026-10-22
closed: 2026-10-22
kind: defect
---

## Acceptance criteria

- [x] a test makes symbols on 8 threads at once and every Id is distinct (979,332 distinct of 1,600,000 before the fix)
- [x] a resolution error reported by the warm server names its file and line (file:line: message)
- [x] the generated C# of the mesher library is unchanged

Found by v1-reliability (sandbox/step-mesh-staging/v1-reliability/TRACK.md, findings): the warm server's plato_laws halted with 'Circular expression' and no location on `(x).IsFinite && x < c ? a : b` in an expression body; the same logic written with a local compiled. The expression is not the cause: it compiles alone on every variant tried (five forms, plato run over stdlib/foundation). The cause is Symbol.Id = NextId++ on a static int, which is not atomic: the warm server compiles one program per folder set and runs different programs at once, so two symbols could get the same Id. Symbol equality is by Id, and the Expression constructor checks children.Contains(this), so an expression whose child happened to share its Id threw 'Circular expression'. Duplicate Ids can also mislead any dictionary keyed by symbol. The warm server printed resolution errors as 'RESOLVE <message>' without the node's location; TKT-345 is the parser's own missing location, a different path. The writer's name counters (SymbolRewriter.NextId, TirInliner.NextRenameId, TirLoopLowerer.NextId) are reset to 0 per generation, so two programs emitted at once could reset each other mid-function; and the resolver's lambda counter had the same race.

## Resolution (2026-10-22, Plato a7aeeb36)

- Symbol.Id is a long from Interlocked.Increment; the Expression constructor's circular check compares references. SymbolIdTests: 1,600,000 symbols on 8 threads, all Ids distinct (979,332 distinct before).
- The resolver's lambda counter increments atomically; the writer's name counters (SymbolRewriter.NextId, TirInliner.NextRenameId, TirLoopLowerer.NextId) are per thread. A fresh CLI process counts as before.
- The warm server's resolution errors read `RESOLVE <file>:<line>: <message>` (WarmLawRunnerTests.A_resolution_error_names_its_file_and_line).
- Generated C# of layers 00-08 (library 83a5da13) at a7aeeb36 is byte-identical to c8c83c8b's apart from the header line (1,419 files and the runtime copies).
- PlatoTests 263 pass and the 4 failures that fail at HEAD; Plato.Interpreter.Tests 79/79; WarmLawRunnerTests 8/8.
- The commit message lost the expression `(x).IsFinite && x < c ? a : b` to shell substitution; this ticket is the record.
