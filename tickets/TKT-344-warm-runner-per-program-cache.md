---
id: TKT-344
title: Plato warm law runner keeps one compiled program per folder set and profile, so several tracks with their own staging folders do not force each other's recompiles
status: done
depends_on: []
owner: session 958bd180
session: 958bd180-e4b6-4a19-bb46-2271f00f9b71
fence: [../plato/src/Plato.Navigation/**, ../plato/tests/**, ../plato/docs/interpreter.md, ../studio/labs/PlatoNavigationMcp/**]
workflow: [W3, W4]
related: [TKT-331, TKT-337, TKT-323]
confidence: high
created: 2026-10-18
claimed: 2026-10-18
closed: 2026-10-18
---

## Acceptance criteria

- [x] WarmLawRunner keeps a compiled program for each (folders, recursive, exclude, profile) it has seen, up to a bound (for example 8, least recently used dropped), and a call reuses the one that matches
  - plato f22b36b0: WarmProgram per (folders, recursive, exclude), DefaultMaxPrograms 8, least recently used dropped; the server's --law-programs=<n> sets the bound (studio 60abd7fb). Profiles share a program's compilation and keep their own interpreters (a compilation does not depend on the profile), which meets the intent with fewer compilations. WarmLawRunnerTests: alternating folder sets, eviction bound, shared profiles, edit isolation pass.
- [x] measured: two callers alternating between two staging folders get warm answers (under 5 s after a one-body edit) instead of a recompile on every switch; memory per kept program recorded in docs/interpreter.md
  - 2026-10-18 23:26, scratch server on port 8791, library plus copies of staging/genus and staging/poles, gpu32: 4.0 to 4.6 s after a one-body edit to a program's own folder over 14 alternating edits; the other program answered in 0.0 to 0.2 s and never recompiled. Managed heap after a full collection: 510 MB with one program, about 80 MB per further program. Recorded in plato docs/interpreter.md, "Warm law runs".
- [x] TKT-337 is fixed in the same pass: a file that does not parse comes back as ok false with its parse errors
  - see TKT-337: one 'Parsing failed: <file>: <message>' per error, no law run; covered by WarmLawRunnerTests.

Plan docs/plans/step-mesher-v2.md, track P. Today WarmLawRunner holds one compilation, so each track passing its own staging folder through plato_laws.py's --staging recompiles the 250-file program (about 20 s) whenever another track called last. With six tracks this undoes TKT-331's gain. The supervisor rebuilds and restarts the server on 8768 when it lands.

## Log

- 2026-10-18: landed. Plato f22b36b0 (WarmProgram, per-program cache, shared parse cache, parse errors, docs); studio 60abd7fb (plato_laws over it, --law-programs, README). Start command for 8768 (build studio labs/PlatoNavigationMcp in Release first; it compiles the plato working tree): PlatoNavigationMcp.exe --root C:/Users/cdigg/git/plato/stdlib --port 8768 --law-folder=C:/Users/cdigg/git/plato/stdlib/foundation --law-folder=C:/Users/cdigg/git/plato/stdlib/geometry --law-folder=C:/Users/cdigg/git/plato/stdlib/graphics --law-folder=C:/Users/cdigg/git/bim-open-toolkit/sandbox/step-brep-mesh --law-recursive --law-exclude=brep.types.plato --law-exclude=brep.library.plato --law-exclude=brep.concepts.plato --law-profile=gpu32 [--law-programs=8]
