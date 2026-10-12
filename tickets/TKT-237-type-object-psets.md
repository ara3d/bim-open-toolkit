---
id: TKT-237
title: Type-object property sets reach BOS so IDS property facets see inherited values
status: done
depends_on: []
owner:
fence: [deps/bim-open-data/src/data/Ara3D.Ifc.Bos/**, deps/bim-open-data/src/data/Ara3D.Ids/**]
workflow: [kept]
related: [TKT-50]
created: 2026-10-11
closed: 2026-10-11
---

## Acceptance criteria

- [x] The IFC to BOS converter writes the property sets an IfcTypeObject carries (HasPropertySets) so an occurrence sees the values it inherits, in a form Ara3D.Ids reads; the Duplex door types show it
- [x] Ara3D.Ids drops its once-per-report warning that type-object property sets are not seen

Found by the fresh-context review of the IDS and BCF nodes (docs/plans/ids-bcf-nodes.md, 2026-10-11). BOS collects property sets only through IfcRelDefinesByProperties, never from the type object, so under IDS 1.0 (where an occurrence inherits its type properties, and ifctester merges them) a set that lives only on the type gives a false Fail for a required facet and a false Pass for a prohibited or optional one. Until the converter carries them, ids.check warns once whenever a property facet is evaluated.

- 2026-10-11: converter done in bim-open-data `f103af0`: a type object's own sets become parameters on the type entity (no copies on occurrences; readers resolve through Entity.Type; `Ara3D.Ifc.Conventions/IfcTypeObjects.cs` states the rule). The Duplex's door styles carry only empty lining properties, so the tests use an IFC4 door type, an IFC2x3 door style, and data/model_0.ifc's beam types. The second criterion (Ara3D.Ids reads inherited values and drops its warning) is the next chunk.
- 2026-10-11, later: Ara3D.Ids reads inherited values in bim-open-data `5a23e83`: an occurrence's Properties add its type's for any set and name it lacks (own value wins; attributes are not inherited); FromBimData follows Entity.Type, FromTables matches the Type column's name against entities with no type, or an optional TypeIndex column, and gives InfoNotAvailable with a warning when the name is ambiguous. The warning is gone. Left: `e.Type AS TypeIndex` on the EntityText view and through bos.load, so table-built checks never hit the ambiguity; samples/public/duplex.bos predates f103af0 (its door styles carry nothing, so no count changes).
