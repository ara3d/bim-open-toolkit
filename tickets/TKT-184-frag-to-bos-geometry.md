---
id: TKT-184
title: frag_to_bos and FragmentsToBos.Convert save a .bos with no geometry tables
status: done
depends_on: []
owner:
fence: [deps/bim-open-data/src/data/Ara3D.BimOpenSchema.IO.Fragments/**, deps/bim-open-data/src/mcp/BimOpenMcp.Ifc/BosFileTools.cs, deps/bim-open-data/tests/**]
workflow: [W1]
related: [TKT-172]
created: 2026-10-10
kind: defect
closed: 2026-10-10
---

## Acceptance criteria

- [x] FragmentsToBos.Convert and the frag_to_bos tool write the geometry tables (Instances, Meshes, VertexBuffer, IndexBuffer, Materials, Transforms) into the .bos
- [x] A test reads the saved file back and checks the instance and triangle counts, not the in-memory data

Both call WriteToParquetZip (ParquetUtils.cs:503), which goes through BimDataExtension.ToDataSet and writes only the nine non-geometry tables; ParquetUtils.cs:392 says so. WriteBimOpenSchema (ParquetUtils.cs:506) and IfcToBosConverter.SaveToBos include geometry. BosFileToolTests.cs:68 checks instances from the in-memory data. Found 2026-10-10 while planning the Speckle converter (docs/plans/speckle-converter-and-viewer.md); the Fragments reader's own tests pass because they check memory.

Fixed in bim-open-data 521b837 (WriteToParquetZip writes the geometry tables when Geometry is set), 43386b2 (BosUnion.WriteBos uses it instead of its own copy), and 46e5885 (DuplexFixtureTests and BosFileToolTests read the saved file back).
