# Ara3D.Ifc.Bos

The IFC to BIM Open Schema conversion path (`IfcToBosConverter`,
`IfcRelationMapping`), moved out of `Ara3D.BimOpenSchema.IO`.

It exists to break a dependency cycle at the group level. `Ara3D.IfcLoader`
referenced `Ara3D.BimOpenSchema`, and `Ara3D.BimOpenSchema.IO` referenced
`Ara3D.IfcLoader`, so the schema could not be built or shipped without dragging
in the native web-ifc loader. The converter is the only code that genuinely
needed both sides, so it lives here instead, referencing
`Ara3D.BimOpenSchema.IO` and `Ara3D.IfcLoader`. `Ara3D.BimOpenSchema` and
`Ara3D.BimOpenSchema.IO` now have no path to any IFC project.

The classes keep their original `Ara3D.BimOpenSchema.IO` namespace so existing
consumers work unchanged; only a project reference has to be added.

## Length unit and grid axis tag (TKT-30 C2)

`IfcLengthUnit.Read(IfcFile)` resolves the project's `LENGTHUNIT`: the
`UnitsInContext` of the file's `IFCPROJECT`. It returns `null` when the file
declares none.

- For an `IfcSIUnit`, the result combines the SI prefix (if any) with
  `METRE`, e.g. no prefix gives `("METRE", 1.0)`, and `.MILLI.,.METRE.` gives
  `("MILLIMETRE", 0.001)`.
- For an `IfcConversionBasedUnit` (or `IfcConversionBasedUnitWithOffset`),
  the result is the unit's own name (e.g. `'FOOT'`) and its
  `IfcMeasureWithUnit` factor multiplied by the `ToMetre` of the SI unit it
  is defined against. Snowdon Structural's `FOOT` unit resolves this way to
  `("FOOT", 0.3048)`.

`IfcToBosConverter` writes the result as two parameters on the `IFCPROJECT`
entity: `Ifc:LengthUnit` (String) and `Ifc:LengthUnitToMetre` (Number), both
in group `IFCPROJECT`. A file with no length unit gets neither parameter.

`IfcToBosConverter` also writes `Ifc:AxisTag` (String, group `IFCGRIDAXIS`)
on each `IFCGRIDAXIS` entity, taken from attribute 0. `IFCGRIDAXIS` is not an
`IfcRoot`, so its attribute 0 is the tag rather than a `GlobalId`; the
converter's generic property loop (`ProcessAttributeAsProp`) assumes
`GlobalId`/`OwnerHistory`/`Name` occupy attributes 0-2 and starts reading
properties at attribute 3, so without this special case (mirroring the
existing one for `IFCSPACE`'s room number) the tag is never stored. Before
this chunk, no `IFCGRIDAXIS` parameter reached the BOS at all (see
`samples/snowdon-analyses/README.md`, "Converter facts").
