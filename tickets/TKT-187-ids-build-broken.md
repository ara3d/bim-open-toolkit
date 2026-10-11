---
id: TKT-187
title: Ara3D.Ids does not build (IfcDataTypes is missing) and is not in BimOpenData.sln, so no gate sees it
status: open
depends_on: []
owner:
fence: [deps/bim-open-data/src/data/Ara3D.Ids/**, deps/bim-open-data/tests/data/**]
workflow: [kept]
related: [TKT-50]
created: 2026-10-10
kind: defect
---

## Acceptance criteria

- [ ] Ara3D.Ids builds, is in BimOpenData.sln (added with --include-references false), and its tests run in the gate

Found by chunk T180 of the BOS middle-layer wave (docs/plans/bos-middle-layer.md) on 2026-10-10: building Ara3D.Ids fails because IfcDataTypes exists nowhere; this was already so before T180. Because the project is missing from the solution, the full build and test gate passed without it. The bim-open-data README lists it as the IDS evaluator, and TKT-50 and the BCF writer's verdict-table preset rely on it.
