---
id: TKT-237
title: Type-object property sets reach BOS so IDS property facets see inherited values
status: open
depends_on: []
owner:
fence: [deps/bim-open-data/src/data/Ara3D.Ifc.Bos/**, deps/bim-open-data/src/data/Ara3D.Ids/**]
workflow: [kept]
related: [TKT-50]
created: 2026-10-11
---

## Acceptance criteria

- [ ] The IFC to BOS converter writes the property sets an IfcTypeObject carries (HasPropertySets) so an occurrence sees the values it inherits, in a form Ara3D.Ids reads; the Duplex door types show it
- [ ] Ara3D.Ids drops its once-per-report warning that type-object property sets are not seen

Found by the fresh-context review of the IDS and BCF nodes (docs/plans/ids-bcf-nodes.md, 2026-10-11). BOS collects property sets only through IfcRelDefinesByProperties, never from the type object, so under IDS 1.0 (where an occurrence inherits its type properties, and ifctester merges them) a set that lives only on the type gives a false Fail for a required facet and a false Pass for a prohibited or optional one. Until the converter carries them, ids.check warns once whenever a property facet is evaluated.
