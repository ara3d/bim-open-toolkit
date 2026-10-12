---
id: TKT-249
title: MCP parameter index counts occurrences only, not type objects
status: open
depends_on: []
owner:
fence: [deps/bim-open-data/src/mcp/BimOpenMcp.Ifc/IfcParameterIndex.cs, deps/bim-open-data/src/data/Ara3D.IfcLoader/IfcPropData.cs, deps/bim-open-data/tests/mcp/**]
workflow: [W2]
related: [TKT-237]
created: 2026-10-11
kind: defect
---

## Acceptance criteria

- [ ] IfcParameterIndex.Accumulate skips type objects (the set IfcPropData builds with IfcTypeObjects.IsTypeObject), so elementsWithParameters and each parameter ElementCount count occurrences only; a test over the IFC4 door-type fixture shows it

From the review of the second IDS wave. Since f103af0 IfcPropData lists a type object own property sets under the type id, so the MCP parameter tools count type objects as elements (model_0: Pset_BeamCommon on 117 beams plus the beam types). Not fixed in the wave because IfcParameterIndex.cs had another session uncommitted edits.
