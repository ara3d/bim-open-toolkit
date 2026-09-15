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
