---
id: TKT-184
title: frag_to_bos and FragmentsToBos.Convert save a .bos with no geometry tables
status: open
depends_on: []
owner:
fence: [deps/bim-open-data/src/data/Ara3D.BimOpenSchema.IO.Fragments/**, deps/bim-open-data/src/mcp/BimOpenMcp.Ifc/BosFileTools.cs, deps/bim-open-data/tests/**]
workflow: [W1]
related: [TKT-172]
created: 2026-10-10
kind: defect
---

## Acceptance criteria

- [ ] FragmentsToBos.Convert and the frag_to_bos tool write the geometry tables (Instances, Meshes, VertexBuffer, IndexBuffer, Materials, Transforms) into the .bos
- [ ] A test reads the saved file back and checks the instance and triangle counts, not the in-memory data

Both call WriteToParquetZip (ParquetUtils.cs:503), which goes through BimDataExtension.ToDataSet and writes only the nine non-geometry tables; ParquetUtils.cs:392 says so. WriteBimOpenSchema (ParquetUtils.cs:506) and IfcToBosConverter.SaveToBos include geometry. BosFileToolTests.cs:68 checks instances from the in-memory data. Found 2026-10-10 while planning the Speckle converter (docs/plans/speckle-converter-and-viewer.md); the Fragments reader's own tests pass because they check memory.
