---
id: TKT-440
title: STEP mesher reliability: a lint over law and library files flags the Plato traps that make a law throw or say nothing: && or || guarding a later operand, a var evaluated before its guard, and staged laws that compare staged code with the library's
status: done
depends_on: []
owner:
fence: [sandbox/step-brep-mesh/tools/law_lint.py]
workflow: [W3]
related: [TKT-411]
confidence: high
created: 2026-10-22
closed: 2026-10-22
---

## Acceptance criteria

- [x] law_lint.py flags SameUvPoints (a.Count == b.Count && ...) and the library's IsBandPair before v1-faces F3
- [x] it flags staged laws whose body calls both a staged name and the library name it replaces, with the note that the law says nothing after merge
- [x] it runs over the library and staging in under 10 s and exits 1 on a finding not in its allowlist

Reliability report docs/plans/step-mesher-reliability-2026-10-22.md, class H (the law language's traps). && and || evaluate both sides (SPEC-DSL.md), so a count guard does not guard: SameUvPoints made a law throw instead of fail, and IsBandPair's && chain was one cause of TKT-411's 30 thrown corpus faces.
