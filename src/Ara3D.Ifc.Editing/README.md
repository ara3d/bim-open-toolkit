# Ara3D.Ifc.Editing

The byte-exact IFC property-set write path, promoted from test code into a real
library. It reads a STEP/IFC file into entity spans without reformatting it
(`IfcSourceFile`, `IfcEntitySpan`), builds new property sets and values
(`IfcPropertySetBuilder`, `IfcPropertyValue`), and writes changes back as a
minimal patch so untouched bytes of the source file are preserved exactly
(`IfcPatcher`, `IfcDiff`).

The classes keep their original `Ara3D.Ifc.Tests` namespace so existing
consumers (the tier 4 test projects) work unchanged.

Provenance: copied from ara3d/ara3d-sdk `tests/Ara3D.Ifc.Tests`
(IfcSourceFile.cs, IfcEntitySpan.cs, IfcDiff.cs, IfcPatcher.cs,
IfcPropertySetBuilder.cs, IfcPropertyValue.cs, plus their helper files
IfcGuid.cs and IfcStepText.cs) @ 82df7322.
