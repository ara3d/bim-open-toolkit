---
id: TKT-331
title: Plato law runs in seconds: a warm law-run tool on the plato-navigation server, a list of filters, and a verdict file with a regression check
status: claimed
depends_on: []
owner: session 958bd180
session: 958bd180-e4b6-4a19-bb46-2271f00f9b71
fence: [../plato/src/Plato.CLI/**, ../plato/src/Plato.Navigation/**, ../plato/src/Plato.Navigation.CLI/**, ../plato/src/Plato.Interpreter/LawRunner.cs, ../plato/tests/Plato.Interpreter.Tests/LawRunner*, ../plato/docs/interpreter.md, ../studio/labs/PlatoNavigationMcp/LawMcpTools.cs, ../studio/labs/PlatoNavigationMcp/Program.cs, ../studio/labs/PlatoNavigationMcp/README.md, ../plato/src/Plato.Compiler/Compilation.cs]
workflow: [W3, W4]
related: [TKT-323, TKT-317, TKT-321]
confidence: high
created: 2026-10-18
claimed: 2026-10-18
---

## Acceptance criteria

- [ ] plato run accepts several filters (a comma list, and --laws-from=<file> with one law or class name per line) and runs exactly the laws they match
- [ ] plato run --report=<file> writes one line per law (name, verdict, first failing witness if any), sorted by name; --baseline=<file> prints every law whose verdict changed and exits non-zero when a law that passed no longer passes
- [ ] the plato-navigation server (port 8768) has a tool that runs filtered laws over its warm compilation of the open folders; on the STEP library, a second run after a one-body edit returns its verdicts in under 5 s, measured and recorded in docs/interpreter.md beside the cold CLI time (32.5 s on 2026-10-18)
- [ ] Plato is built only into a private --artifacts-path, never into src/*/bin, so the pinned CLI and the running server are not disturbed; the commits are pushed and their ids reported to the supervisor

Part of the epic TKT-323 (the STEP mesher in Plato); plan docs/plans/step-mesher-parallel.md, track P1. Today each law check through plato run spends about 30 s compiling the 250-file program again and 0.3 s on the law, so builders writing STEP mesher bodies wait half a minute per check. The supervisor also needs a committed verdict file to detect regressions after each step. Work happens in the Plato repository (C:/Users/cdigg/git/plato); the ticket lives here so its id does not collide. The interpreter's evaluator files belong to TKT-332 at the same time; this ticket touches only LawRunner.cs in that project. The server on port 8768 is studio's labs/PlatoNavigationMcp (a thin MCP host over plato's Plato.Navigation), so the warm runner lives in Plato.Navigation and studio gets only the tool wrapper, one Register line in its Program.cs, and its README; the supervisor widened the fence to those three studio paths on 2026-10-18. The tool must compile the STEP library's folders (the pinned command's inputs), not only the stdlib the server indexes, and report type errors as well as verdicts from its warm state. Compilation.cs joined the fence on 2026-10-18 for one change only: the code writers' tables (LibraryFunctions, ConcreteTypes) are built on first use, because they are about half of every warm recompile and the interpreter never reads them; the foundation tier's generated C# must be unchanged by it.
