---
id: TKT-192
title: DataModel's GeometryConversion keeps its own hidden check and stricter geometry validation beside BosScene
status: open
depends_on: []
owner:
fence: [deps/bim-open-data/src/data/Ara3D.BimOpenSchema.DataModel/**, deps/bim-open-data/src/data/Ara3D.BimOpenSchema.ObjectModel/BosScene*.cs, deps/bim-open-data/tests/data/Ara3D.BimOpenSchema.DataModel.Tests/**, deps/bim-open-data/tests/data/Ara3D.BimOpenSchema.ObjectModel.Tests/**]
workflow: [W3]
related: [TKT-174]
created: 2026-10-10
---

## Acceptance criteria

- [ ] One hidden-instance rule and one place for geometry validity checks (non-finite transforms, non-unit quaternions, triangle index ranges): either BosScene gains them and GeometryConversion uses BosScene, or the reason they stay apart is written in both files

From the BOS middle-layer wave review (docs/plans/bos-middle-layer.md, Review findings), 2026-10-10. GeometryConversion.cs:51 is the last of four hidden checks; it also validates more than BosScene does.
