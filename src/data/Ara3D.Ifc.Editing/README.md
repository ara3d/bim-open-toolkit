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

## External document references

`IfcDocumentReferenceBuilder` attaches an external document (a CSV analytics
table, a report, a URL) to an existing object. One call emits three entities —
`IFCDOCUMENTINFORMATION`, `IFCDOCUMENTREFERENCE`, `IFCRELASSOCIATESDOCUMENT` —
through the same append/diff/remove path as the property-set builder:

```csharp
var builder = new IfcDocumentReferenceBuilder(
    file.MaxId + 1, file.FirstIdOfType("IFCOWNERHISTORY"), IfcSchema.Ifc2x3);
builder.AddDocumentReference(
    file.FirstIdOfType("IFCPROJECT"),
    new IfcDocumentInfo("Ara3D Analytics Table", "https://example.org/analytics/duplex.csv"),
    "Ara3D_Analytics:document");
File.WriteAllBytes(outputPath, IfcPatcher.Append(file, builder.Lines));
```

The two schemas order these attributes differently, so the constructor takes an
`IfcSchema`. Attribute lists were taken from
`submodules/parakeet/input/exp/IFC2X3.exp` and `IFC4.exp`. Two attributes of
`IfcDocumentInfo` only reach the file in IFC4: `CreationTime` (an
`IfcDateAndTime` entity reference in IFC2X3) and `Format` (an
`IfcDocumentElectronicFormat` entity reference in IFC2X3). Both builders share
`IfcStepLines`, which allocates ids and formats lines.
