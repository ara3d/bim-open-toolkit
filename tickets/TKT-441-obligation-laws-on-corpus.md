---
id: TKT-441
title: STEP mesher reliability: the 84 host-obligation laws (decode, parse, schema, WHERE rules) run compiled on every corpus file, by the harness, against the file's own parsed and decoded model
status: open
depends_on: []
owner:
fence: [deps/bim-open-data/tools/regen-step-brep.ps1, deps/bim-open-data/tools/step-corpus-harness/**]
workflow: [W3]
related: [TKT-348, TKT-422]
confidence: medium
created: 2026-10-22
---

## Acceptance criteria

- [ ] the regeneration emits the laws of layers 3 and 8 whose only obligations are ParseStep, DecodeRaw, FlatRecord, SlotOf or InstancePosition into a law assembly the harness references
- [ ] the harness's time mode runs each such law on the file's values and records each fail in <prefix>.laws.csv

Reliability report docs/plans/step-mesher-reliability-2026-10-22.md, class D. These 84 laws are recorded as 'obligation' in verdicts-cpu64.tsv and never evaluated; Law_DecodeIsTotal is among them, the property TKT-348 broke on 72 of 88 files. The regeneration script is v1-close's fence.
