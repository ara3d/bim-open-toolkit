---
id: TKT-345
title: Plato parse errors name a line: a missing semicolon is reported at the start of the file today
status: open
depends_on: []
owner:
fence: [../plato/parakeet/**, ../plato/src/Plato.Navigation/**]
workflow: [W3, W4]
related: [TKT-337, TKT-344]
debt_of: TKT-337
confidence: medium
created: 2026-10-18
kind: defect
---

## Acceptance criteria

- [ ] a law file with one missing semicolon, through plato run and plato_laws, reports the line of the statement missing it (or the line where the parser gave up), not (0,0)
- [ ] a test in Plato.Navigation.Tests plants the missing semicolon and asserts the reported line

Found 2026-10-18 while fixing TKT-337. A law file whose only function lost its trailing semicolon fails to parse with 'Error at (0,0,0,0) while parsing File, expected Rule failed EndOfInput ::= _END_': the grammar's File rule backtracks to the start, so the error names the file but no line. The cold plato run prints only 'Parsing failed: <file>', so builders search the whole file. The parser is parakeet (a submodule of plato with its own repository); the fix is likely error recovery in the Plato grammar or reporting the furthest position any rule reached. WarmProgram.ParseErrors (plato f22b36b0) passes the parser's messages through unchanged, so a better parser message reaches plato_laws with no further change.
