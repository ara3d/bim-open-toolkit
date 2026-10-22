---
id: TKT-433
title: STEP mesher reliability: the C# regeneration fails on any degraded body or unlisted bodiless stub
status: open
depends_on: []
owner:
fence: [sandbox/step-brep-mesh/tools/check_generated.py, sandbox/step-brep-mesh/tools/generated-stubs.txt, deps/bim-open-data/tools/regen-step-brep.ps1]
workflow: [W3]
related: [TKT-410, TKT-348]
confidence: high
created: 2026-10-22
---

## Acceptance criteria

- [ ] check_generated.py fails on bim-open-data 5571854 (the SagittaByHullBoundGiven stub) and passes on e646e28
- [x] regen-step-brep.ps1 runs the check over its output and its log, and stops with a non-zero exit when it fails (v1-close's fence)

Reliability report docs/plans/step-mesher-reliability-2026-10-22.md, class F (compiler output that degrades silently). TKT-410's stub cost 22,410 corpus faces; the regeneration printed one DEGRADED line that nobody read, and CHK304 was never printed.
- 2026-10-22, session cab91351 (track E): box 2 in bim-open-data 3f1ad1b. The script exports `tools/check_generated.py` and `generated-stubs.txt` from the same library commit as the layers, writes the compiler's log, runs `python -I check_generated.py <compiler output> --log <log>`, and throws before writing anything when it fails. Plato c8c83c8b with the library at toolkit 8ad9c530: `31 stubs: 0 degraded, 30 bodiless (0 listed names no longer stubs); 0 failure(s)`, 1,428 files written. Plato e37c032f, same library: `32 stubs: 1 degraded, 30 bodiless; 3 failure(s)` (the `SagittaByHullBoundGiven` stub at `BisectionCached.g.cs:25` and two DEGRADED log lines), exit 1, output folder never created. A library commit older than the check script cannot be regenerated (its `git archive` fails), which is intended. Box 1 is v1-reliability's.
