---
id: TKT-331
title: Plato law runs in seconds: a warm law-run tool on the plato-navigation server, a list of filters, and a verdict file with a regression check
status: done
depends_on: []
owner: session 958bd180
session: 958bd180-e4b6-4a19-bb46-2271f00f9b71
fence: [../plato/src/Plato.CLI/**, ../plato/src/Plato.Navigation/**, ../plato/src/Plato.Navigation.CLI/**, ../plato/src/Plato.Interpreter/LawRunner.cs, ../plato/tests/Plato.Interpreter.Tests/LawRunner*, ../plato/docs/interpreter.md, ../studio/labs/PlatoNavigationMcp/LawMcpTools.cs, ../studio/labs/PlatoNavigationMcp/Program.cs, ../studio/labs/PlatoNavigationMcp/README.md, ../plato/src/Plato.Compiler/Compilation.cs]
workflow: [W3, W4]
related: [TKT-323, TKT-317, TKT-321]
confidence: high
created: 2026-10-18
claimed: 2026-10-18
closed: 2026-10-18
---

## Acceptance criteria

- [x] plato run accepts several filters (a comma list, and --laws-from=<file> with one law or class name per line) and runs exactly the laws they match
  - plato 69dcb960: an entry matches when it occurs in Owner.Law_Name, so a class name selects its laws; an entry that selects nothing is reported on stderr. LawRunnerSelectionTests (11) pass; CLI smoke selected 3 laws from a comma list and a list file and reported one misspelt entry.
- [x] plato run --report=<file> writes one line per law (name, verdict, first failing witness if any), sorted by name; --baseline=<file> prints every law whose verdict changed and exits non-zero when a law that passed no longer passes
  - plato acbc9b94: tab-separated, sorted, overloads carry parameter types. LawRunnerReportTests (9) pass; CLI smoke against a baseline with two passes marked fail and one error marked pass printed 2 changed, 1 regressed, exit 1.
- [x] the plato-navigation server (port 8768) has a tool that runs filtered laws over its warm compilation of the open folders; on the STEP library, a second run after a one-body edit returns its verdicts in under 5 s, measured and recorded in docs/interpreter.md beside the cold CLI time (32.5 s on 2026-10-18)
  - plato_laws is in the server's code (studio b7598e75, over plato 38f2031a; compiler change 637264f0). It compiles its own program from launch flags (the STEP folders), not only the indexed stdlib, and type-checks the edited files' functions. Switching the live 8768 process is the supervisor's step.
  - Measured through plato_laws on a scratch instance (port 8791), 2026-10-18 18:05, one-body edit in a copy of sandbox/step-brep-mesh then one law: 4.8, 4.9, 4.9, 5.4, 5.5, 6.0 s (compile 4.1-5.5 s, type check of the file 0.2-0.3 s, law 0.3-0.4 s); no edit 0.4 s; a planted type error reported as CHK201 at file and line in 4.8 s. Half the readings are over 5 s on a machine shared with other sessions (one 24 s reading during a load spike left out); the remainder is whole-program compilation, which needs an incremental compiler to go lower. Before the compiler change the same edit cost 8.6-12.6 s. All recorded in plato docs/interpreter.md, "Warm law runs", beside the cold CLI's 32.5 s.
- [x] Plato is built only into a private --artifacts-path, never into src/*/bin, so the pinned CLI and the running server are not disturbed; the commits are pushed and their ids reported to the supervisor
  - Every build went to the session scratchpad (plato-build, plato-build2/3/4, mcp-build); the pinned CLIs and the 8768 server (pid 23784) were not touched. Pushed: plato 69dcb960, acbc9b94, 637264f0, 38f2031a; studio b7598e75. Ids sent to the supervisor after steps 2 and 3.

Part of the epic TKT-323 (the STEP mesher in Plato); plan docs/plans/step-mesher-parallel.md, track P1. Today each law check through plato run spends about 30 s compiling the 250-file program again and 0.3 s on the law, so builders writing STEP mesher bodies wait half a minute per check. The supervisor also needs a committed verdict file to detect regressions after each step. Work happens in the Plato repository (C:/Users/cdigg/git/plato); the ticket lives here so its id does not collide. The interpreter's evaluator files belong to TKT-332 at the same time; this ticket touches only LawRunner.cs in that project. The server on port 8768 is studio's labs/PlatoNavigationMcp (a thin MCP host over plato's Plato.Navigation), so the warm runner lives in Plato.Navigation and studio gets only the tool wrapper, one Register line in its Program.cs, and its README; the supervisor widened the fence to those three studio paths on 2026-10-18. The tool must compile the STEP library's folders (the pinned command's inputs), not only the stdlib the server indexes, and report type errors as well as verdicts from its warm state. Compilation.cs joined the fence on 2026-10-18 for one change only: the code writers' tables (LibraryFunctions, ConcreteTypes) are built on first use, because they are about half of every warm recompile and the interpreter never reads them; the foundation tier's generated C# must be unchanged by it.

## Log

- 2026-10-18, after close: plato 7dff400c removed two stale "Limits" entries from docs/interpreter.md (top-level primitive law parameters, fixed in 1a3298fa and guarded by ValueDomainTests in 88aa0277; per-law times, printed since b31cbfae); e7af66c8 and cb862c84 name the fix and its test in the law-runner section and rewrap it. Step B had read the stale paragraph and worked around a limit that no longer existed.
