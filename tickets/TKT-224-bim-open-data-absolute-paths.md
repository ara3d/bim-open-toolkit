---
id: TKT-224
title: Owner-machine paths in bim-open-data outside the mesher
status: open
depends_on: []
owner:
fence: [deps/bim-open-data/**]
workflow: [process]
related: [TKT-216]
created: 2026-10-11
---

## Acceptance criteria

- [ ] No file in bim-open-data outside bench/ifc-bench/results/ contains a path under C:\Users\cdigg; each is replaced by a repository-relative path, an environment variable, or a documented argument

Found by the TKT-216 review's remnant grep on 2026-10-11, outside the mesher's scope so left alone then: src/data/Ara3D.BimOpenSchema.BuildingModel.Workflows/Mapping/WAVE-R5.md:3, src/data/Ara3D.BimOpenSchema.DataModel/PLATONIC-INTEGRATION.md:24, src/data/Ara3D.BimOpenSchema.DataModel/README.md:45, tests/data/Ara3D.BimOpenSchema.BuildingModel.Workflows.Tests/SnowdonSource.cs:12, tests/data/Ara3D.BimOpenSchema.DataModel.Tests/README.md:24, tests/data/Ara3D.DoorClearance.Tests/README.md:20, tests/data/Ara3D.Ifc.Tests/ConverterUnitAndAxisTagTests.cs:89, tools/bim-data-model/README.md:22, tools/building-model-workflows/run-samples.ps1:11-12. The IFC-Bench transcripts under bench/ifc-bench/results/2026-10-03/ also carry them; those are a record of a run and stay as they are. The pattern the mesher's harness used is RepoPaths (BimOpenData.TestSupport) plus one environment variable for folders outside the checkout.
