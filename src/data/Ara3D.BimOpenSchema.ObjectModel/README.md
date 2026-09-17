# Ara3D.BimOpenSchema.ObjectModel

In-memory helpers over the BIM Open Schema spec types: `BimDataBuilder` and
`BimGeometryBuilder` for constructing data without duplicate strings, points, or
descriptors; `IBimData` and `BimGeometry` accessor extensions; `BimObjectModel`, a
denormalized object graph for navigation; and JSON projections of entities, rooms,
and fixtures.

The types this project builds on live in the spec package `Ara3D.BimOpenSchema`
(the `bim-open-schema` submodule). Everything here keeps the `Ara3D.BimOpenSchema`
namespace, so consumers only add a project reference. Serialization is in
[Ara3D.BimOpenSchema.IO](../Ara3D.BimOpenSchema.IO).
