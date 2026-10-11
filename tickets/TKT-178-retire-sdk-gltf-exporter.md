---
id: TKT-178
title: Retire the SDK glTF exporter: ifc_export_glb and the BOS Browser write through Ara3D.BimOpenSchema.IO.Gltf
status: done
depends_on: []
owner:
fence: [deps/bim-open-data/src/mcp/BimOpenMcp.Ifc/IfcGeometryTools.cs, deps/bim-open-data/apps/Ara3D.BimOpenSchema.Browser/**, deps/bim-open-data/tests/mcp/**]
workflow: [W3]
related: [TKT-170]
created: 2026-10-10
closed: 2026-10-11
---

## Acceptance criteria

- [x] ifc_export_glb and the Browser's glTF export carry entity ids in node extras and the right material per instance
- [x] A comparison on the public samples shows whether the Approach1 mesher and the IFC-to-BOS geometry agree before ifc_export_glb switches source

Found in the BOS formats wave (docs/plans/bos-formats.md, Architecture notes). Ara3D.IO.GltfExporter gives a shared mesh the first instance's material, cannot carry extras, writes unused meshes, and rotates with an inexact float matrix.

Done 2026-10-11 (bim-open-data): `f740540` (ifc_export_glb from the session's BOS conversion, chosen by GlbSourceComparisonTests; Browser on BosGlb), `752dd49` (last GltfExporter reference). Follow-ups: TKT-188, TKT-189.
