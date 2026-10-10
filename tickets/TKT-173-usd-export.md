---
id: TKT-173
title: USD export: write a BOS model as an OpenUSD .usda stage
status: done
depends_on: []
owner:
fence: [deps/bim-open-data/src/data/Ara3D.BimOpenSchema.IO.Usd/**, deps/bim-open-data/tests/data/Ara3D.BimOpenSchema.IO.Usd.Tests/**]
workflow: [W3]
created: 2026-10-10
closed: 2026-10-10
---

## Acceptance criteria

- [x] A library call writes a .usda text stage from a BOS document with no native USD dependency: one Xform prim per entity, shared meshes as prototypes referenced by each instance, UsdPreviewSurface materials, z-up and metres in the stage metadata
- [x] Element data is kept: GlobalId, name, category, and parameters as namespaced custom attributes (bim:...), with missing values left out rather than defaulted
- [x] A test writes samples/public/duplex.bos and checks prim, mesh, and instance counts; when usd-core (Python) is installed, a usd-core open of the stage and its UsdValidation validators report no errors (the usd-core wheel ships no usdchecker script; corrected 2026-10-10), and the test says when it was skipped
- [x] File size and write time for schependomlaan.bos are recorded in the project README, to judge whether binary .usdc is needed later

USD reaches Omniverse, Blender, Houdini, and Apple's AR tools; with the parameters kept it is a digital-twin hand-off. Input is out of scope: USD rarely carries BIM data. Serves workflow 3. The MCP tool, solution entry, and README line are supervisor integration. Format survey: chat 2026-10-08.

Done 2026-10-10 in ara3d/bim-open-data: `637c94d` (writer), `06a2de8` (no bim:localId for -1), `fb0367c` (atomic write), `d13566e` (every entity a prim, relations as relationships), MCP tool `bos_export_usd`. 41 tests pass with usd-core 0.26.8; Schependomlaan is 56.8 MB of .usda, 7.2 MB as .usdc (TKT-183).
