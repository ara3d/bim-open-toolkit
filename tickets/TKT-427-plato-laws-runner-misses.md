---
id: TKT-427
title: plato_laws.py misses laws by bare name, misreads MSYS staging paths, and reports a transient empty run as a miss
status: done
depends_on: []
owner:
fence: [sandbox/step-brep-mesh/tools/plato_laws.py]
workflow: [W4]
related: [TKT-337, TKT-323]
confidence: high
created: 2026-10-22
closed: 2026-10-22
kind: defect
---

## Acceptance criteria

- [x] a bare law name, and an overloaded law named with or without its signature, runs the same laws as Block.Law
- [x] a --staging, --library, --report or --baseline path in MSYS form (/c/...) is read as C:/...
- [x] an empty run is retried once inside the script before it prints 'no laws matched'
- [x] arguments, output lines and exit codes are unchanged

Reported by the v1 tracks (sandbox/step-mesh-staging/v1-edges/TRACK.md and v1-faces/TRACK.md, Lessons) and the perf tracks: the warm law server on 8768 sometimes answers 0 laws for a bare law name that Block or Block.Law matches; a staging path given as /c/Users/... reaches the server as C:\c\Users\...; and right after an edit the server can answer 0 laws once and pass on a plain retry. The merge agent and every track call this script, so the fix stays inside it and keeps its interface.

## Log

- 2026-10-22, session (E5 proof track). Fixed in `plato_laws.py`: each bare `Law_X`, and `Law_X(signature)` for an overload, becomes `Block.Law_X` for every `library` or `laws` block of the compiled folders that declares it (the stdlib folders, the library or `--library`, and the staging folders; 0.1 s to scan the library); a filter is split on commas outside parentheses, so a signature keeps its commas; `--staging`, `--library`, `--report` and `--baseline` in MSYS form (`/c/...`) become `C:/...`; an empty run is asked once more after 2 s. Evidence on the warm server: `"Law_RoundsWithinLimit(w: LoopRunWitness),Law_LoopEndsTerminal"` ran `StepToMeshLoopRunLaws.Law_RoundsWithinLimit` and `.Law_LoopEndsTerminal`, 2 pass; `Law_LoopEndsTerminal --staging /c/Users/.../scratchpad/emptystage` 1 pass; `Law_NoSuchLawAnywhere` still prints "no laws matched" and exits 2 after the retry. Output lines and arguments are unchanged.
