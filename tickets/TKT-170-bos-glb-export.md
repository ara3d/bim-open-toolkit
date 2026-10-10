---
id: TKT-170
title: BOS to GLB export as a library call, with each element's entity id carried into the glTF
status: done
depends_on: []
owner:
fence: [deps/bim-open-data/src/data/Ara3D.BimOpenSchema.IO.Gltf/**, deps/bim-open-data/tests/data/Ara3D.BimOpenSchema.IO.Gltf.Tests/**]
workflow: [W3]
created: 2026-10-10
closed: 2026-10-10
---

## Acceptance criteria

- [x] A library call writes a .glb from a .bos file, optionally limited to a set of entity indices, without the IFC loader
- [x] Each glTF node carries its BOS entity index and GlobalId (in extras), so a viewer's pick finds the element
- [x] Output is y-up as glTF requires, in metres; a test converts samples/public/duplex.bos and checks instance and triangle counts against the BOS tables
- [x] The Khronos glTF validator reports no errors on the duplex output

Today GLB comes only from the IFC MCP server (ifc_export_glb, which meshes IFC) and the WPF BOS Browser. BimGeometry.ToModel3D (Ara3D.BimOpenSchema.ObjectModel) and WriteGlb (ara3d-sdk Ara3D.IO.GltfExporter) already exist; this ticket joins them as a reusable call and fills the gaps (ids, axis). The MCP tool, solution entry, and README line are integration, done by the supervisor after the builder returns. Serves workflow 3 (a 3D file to hand to someone; the basis for pictures). Format survey: chat 2026-10-08.

Done 2026-10-10 in ara3d/bim-open-data: `8edac54` (library), `285c313`, `0201b4e`, `824f255` (review fixes and the pinned Khronos validator script), MCP tool `bos_export_glb` in `8db3659`; the tool takes `entityIndices` since `8f9164b`. The validator reports 0 errors and 0 warnings on all 11 public samples.
