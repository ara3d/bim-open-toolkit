---
id: TKT-434
title: STEP mesher reliability: plato_laws.py fails on skipped laws, reruns budget errors alone to tell load from a verdict, and writes a coverage table (cases per law, sampled or exhaustive, skip reasons)
status: done
depends_on: []
owner:
fence: [sandbox/step-brep-mesh/tools/plato_laws.py]
workflow: [W3]
related: [TKT-399, TKT-401, TKT-356]
confidence: high
created: 2026-10-22
closed: 2026-10-22
---

## Acceptance criteria

- [x] a skipped law makes the run exit 1 unless --allow-skipped
- [x] --rerun-budget reruns each budget error alone with a larger budget and prints the settled verdict
- [x] --coverage FILE writes one row per law: verdict, cases, sampled or exhaustive, reason

Reliability report docs/plans/step-mesher-reliability-2026-10-22.md, classes A (vacuous or unreached laws) and G (verdicts that cannot be told from load). TKT-401 and TKT-399 were budget errors for days before anyone saw the fails under them; 14 laws are skipped today and the runner exits 0.
