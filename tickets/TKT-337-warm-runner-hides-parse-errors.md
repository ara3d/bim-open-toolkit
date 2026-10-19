---
id: TKT-337
title: The warm law runner reports '0 laws, 0 type errors' when a file fails to parse, instead of the parse error
status: claimed
depends_on: []
owner: session 958bd180
session: 958bd180-e4b6-4a19-bb46-2271f00f9b71
fence: [../plato/src/Plato.Navigation/**, ../plato/tests/Plato.Interpreter.Tests/**, ../studio/labs/PlatoNavigationMcp/LawMcpTools.cs]
workflow: [W3, W4]
related: [TKT-331, TKT-323]
confidence: high
created: 2026-10-18
claimed: 2026-10-18
kind: defect
---

## Acceptance criteria

- [x] when any file of the law folders fails to parse, plato_laws reports ok false and each parse error with its file and line, as the cold 'plato run' does ('Parsing failed'), and runs no laws
  - plato f22b36b0: one 'Parsing failed: <file>: <parser message>' per parse error, ok false, no law run. The line is whatever the parser reports: for a missing semicolon it reports (0,0), the start of the file, so the line is not there yet; the cold 'plato run' prints no line either. Filed as TKT-345 (grammar or parser change in parakeet).
  - Cause of the '0 laws' answer: the server already returned ok false with 'errors' (since 38f2031a); sandbox/step-brep-mesh/tools/plato_laws.py prints only typeErrors, results and the counts, so the errors never reached the screen. That script is outside this fence: printing data['errors'] (and exiting 1 when data['ok'] is false) is a two-line change for its owner.
- [x] a test plants a missing semicolon in a copy of a law file and asserts the parse error comes back through the warm runner
  - WarmLawRunnerTests.A_file_that_does_not_parse_is_reported_with_its_file_and_no_law_runs and A_fixed_parse_error_compiles_on_the_next_run pass (plato f22b36b0).
- [x] the server on 8768 is rebuilt from the fix and restarted with the law flags by the supervisor, and sandbox/step-brep-mesh/tools/plato_laws.py still exits 2 on an empty run. Evidence: docs/plans/step-mesher-v2.md Log, 2026-10-18 23:55 (server from Plato f2b20722 and studio 60abd7fb) and 2026-10-19 (rebuilt from Plato 951a70ab); f22b36b0 is an ancestor of both; on 2026-10-19 `plato_laws.py "Law_NoSuchLawZzz"` printed "no laws matched" and exited 2

Found 2026-10-18 by the step B session (TKT-324): a missing semicolon made plato_laws answer '0 laws: {}; 0 type errors', which reads as a clean run; the cold CLI said 'Parsing failed'. A builder trusting the warm answer could commit a library that does not compile. Mitigated the same day: tools/plato_laws.py exits 2 with a hint whenever a filtered run matches no law. WarmLawRunner is Plato 38f2031a (TKT-331).

## Log

- 2026-10-18: fixed in plato f22b36b0 and studio 60abd7fb (with TKT-344). The third criterion (rebuild and restart of 8768, plato_laws.py exit 2 on an empty run) is the supervisor's step, so this ticket stays open for it. Start command for 8768 (build studio labs/PlatoNavigationMcp in Release first; it compiles the plato working tree): PlatoNavigationMcp.exe --root C:/Users/cdigg/git/plato/stdlib --port 8768 --law-folder=C:/Users/cdigg/git/plato/stdlib/foundation --law-folder=C:/Users/cdigg/git/plato/stdlib/geometry --law-folder=C:/Users/cdigg/git/plato/stdlib/graphics --law-folder=C:/Users/cdigg/git/bim-open-toolkit/sandbox/step-brep-mesh --law-recursive --law-exclude=brep.types.plato --law-exclude=brep.library.plato --law-exclude=brep.concepts.plato --law-profile=gpu32 [--law-programs=8]
- 2026-10-19, closer (supervisor of docs/plans/step-mesher-v2.md): every box is met, but `ticket.py close` refuses while the debt ticket TKT-345 (parse errors name a line; a parser change in parakeet) is neither paid nor deferred. Stays open until TKT-345's owner pays it or defers it with a reason.
