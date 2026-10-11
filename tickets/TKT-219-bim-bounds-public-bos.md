---
id: TKT-219
title: bim.bounds and bim.rooms return 0 rows on the public .bos samples although the files carry geometry
status: open
depends_on: []
owner:
fence: []
workflow: [W2]
related: [TKT-204, TKT-175, TKT-176]
created: 2026-10-11
kind: defect
---

Seen by the TKT-204 builder on 2026-10-11: on every public .bos under deps/bim-open-data/samples/public (duplex.bos and six others) bim.bounds and bim.rooms produce 0 rows, while bim.elements works (duplex: 4607 elements). The builder concluded the files carry no geometry; they do: duplex.bos holds VertexBuffer.parquet (28,925 bytes), IndexBuffer, Instances (3,035), Meshes, Transforms, Points, Materials. BimModel.cs reads the zip with ReadBimDataFromParquetZip() and no table selection, so the whole file is read. Find why the bounds come out empty: a changed instance-to-entity mapping after the BOS middle-layer wave (TKT-175 absence as -1, TKT-176 vertex rounding, the samples regenerated in wave C of docs/plans/bos-middle-layer.md), a filter on InstanceFlags, or a unit or scale check that now rejects every instance. Acceptance: a test in BimOpenFlow.Nodes.BimAnalysis.Tests evaluates bim.bounds on duplex.bos and gets one row per element with geometry, with plausible extents; bim-door-rooms then declares a model input and runs on duplex.bos (TKT-204 left this undone for this reason).
