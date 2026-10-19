---
id: TKT-344
title: Plato warm law runner keeps one compiled program per folder set and profile, so several tracks with their own staging folders do not force each other's recompiles
status: open
depends_on: []
owner:
fence: [../plato/src/Plato.Navigation/**, ../plato/tests/**, ../plato/docs/interpreter.md, ../studio/labs/PlatoNavigationMcp/**]
workflow: [W3, W4]
related: [TKT-331, TKT-337, TKT-323]
confidence: high
created: 2026-10-18
---

## Acceptance criteria

- [ ] WarmLawRunner keeps a compiled program for each (folders, recursive, exclude, profile) it has seen, up to a bound (for example 8, least recently used dropped), and a call reuses the one that matches
- [ ] measured: two callers alternating between two staging folders get warm answers (under 5 s after a one-body edit) instead of a recompile on every switch; memory per kept program recorded in docs/interpreter.md
- [ ] TKT-337 is fixed in the same pass: a file that does not parse comes back as ok false with its parse errors

Plan docs/plans/step-mesher-v2.md, track P. Today WarmLawRunner holds one compilation, so each track passing its own staging folder through plato_laws.py's --staging recompiles the 250-file program (about 20 s) whenever another track called last. With six tracks this undoes TKT-331's gain. The supervisor rebuilds and restarts the server on 8768 when it lands.
