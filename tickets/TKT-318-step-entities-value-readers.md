---
id: TKT-318
title: Ara3D.Step.Entities reads strings and typed measure values (LENGTH_MEASURE(25.4)); move them from Ara3D.Step.Mesher/Model/StepValues.cs and decode \X2\ escapes
status: done
depends_on: []
owner: session 10b9c9c6
session: 10b9c9c6-0052-40f3-a1c2-c12f2f8861d7
fence: [deps/bim-open-data/src/data/Ara3D.Step.Entities/**, deps/bim-open-data/src/data/Ara3D.Step.Mesher/Model/StepValues.cs, deps/bim-open-data/src/data/Ara3D.Step.Mesher/Model/**, deps/bim-open-data/tests/data/Ara3D.StepTypes.Tests/**, deps.json]
workflow: [W3, W4]
related: [TKT-304, TKT-305, TKT-312]
confidence: medium
created: 2026-10-17
claimed: 2026-10-17
closed: 2026-10-17
---

## Acceptance criteria

- [x] StepEntityReaders gains a string reader (decoding P21 escape directives) and a typed-measure reader; Ara3D.Step.Mesher calls them and StepValues.cs is gone
- [x] tests cover a \X2\ escape and a LENGTH_MEASURE parameter

Found 2026-10-17 by the TKT-305 part B builder: the readers it needed were missing from the typed layer and were written in the mesher instead. TKT-312's decoder needs them too, so they belong in one place.
