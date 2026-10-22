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
- [ ] regen-step-brep.ps1 runs the check over its output and its log, and stops with a non-zero exit when it fails (v1-close's fence)

Reliability report docs/plans/step-mesher-reliability-2026-10-22.md, class F (compiler output that degrades silently). TKT-410's stub cost 22,410 corpus faces; the regeneration printed one DEGRADED line that nobody read, and CHK304 was never printed.
