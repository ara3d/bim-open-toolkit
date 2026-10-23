---
id: TKT-491
title: STEP decode stage several times faster with identical output
status: open
depends_on: []
owner:
fence: [deps/bim-open-data/src/data/Ara3D.Step.Decode/**, deps/bim-open-data/src/data/Ara3D.Step.Entities/**, deps/bim-open-data/src/data/Ara3D.StepTypes/**, deps/bim-open-data/tests/data/Ara3D.Step.Decode.Tests/**, deps/bim-open-data/tools/step-corpus-harness/**]
workflow: [W3]
created: 2026-10-22
---

## Acceptance criteria

- [ ] A profile of DecodeRaw on the largest u-blox files names where the 29.2 s warm total goes
- [ ] The decoded RawDecodedModel is identical before and after on the baseline fixtures (a test compares them)
- [ ] Decode total over the 88 u-blox files falls by several times, measured back to back with the baseline on the same machine

Over the 88 u-blox files the warm stage times are parse 3.8 s and decode 29.2 s (docs/plans/step-mesher-corpus-2026-10-22-evening.md). Decode is the second largest serial stage and nobody has examined it (docs/plans/step-mesher-algorithmic-performance-2026-10-22.md, last line). Each fix is its own commit in deps/bim-open-data; the pin in deps.json moves after the push.
