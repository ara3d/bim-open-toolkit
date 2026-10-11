---
id: TKT-201
title: IfcPropData names an unnamed property set "$" because it reads an unset attribute as a string
status: open
depends_on: []
owner:
fence: [deps/bim-open-data/src/data/Ara3D.IfcLoader/IfcPropData.cs, deps/bim-open-data/tests/data/Ara3D.Ifc.Tests/**]
workflow: [W2]
related: [TKT-175]
created: 2026-10-11
kind: defect
---

## Acceptance criteria

- [ ] An IfcPropertySet with an unset Name ($) has no name (null) in IfcPropData and in the ifc_properties and ifc_property_sets tool output

Found by fixer F3 of the BOS middle-layer wave (docs/plans/bos-middle-layer.md), 2026-10-11: IfcPropData.cs:59 calls GetString(2) on an unset attribute. IfcEntity.GetOptionalString (205bdd6) is the reader to use.
