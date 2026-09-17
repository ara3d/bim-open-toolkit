# src/data

The BIM data layer: the C# reference implementation of BIM Open Schema and the
IFC stack. Nothing here references `src/flow` or `src/mcp`; those build on this.

| Project | Role |
|---|---|
| `Ara3D.BimOpenSchema.ObjectModel` | Builders, accessors, and a navigable object graph over the spec types (the `bim-open-schema` submodule) |
| `Ara3D.BimOpenSchema.IO` | Reading and writing `.bos` archives, with Excel, DuckDB, and BFAST export |
| `Ara3D.BimOpenSchema.DuckDb` | Loading BOS into DuckDB, views, and queries |
| `Ara3D.BimOpenSchema.Harmonizer` | Canonical names and SI units across models from different tools |
| `Ara3D.BimOpenSchema.DataModel`, `.DataModel.IO` | Relational snapshot model with validation and spatial index |
| `Ara3D.BimOpenSchema.BuildingModel`, `.Source`, `.Workflows`, `.Workflows.IO`, `.DuckDb` | Typed building model with source mapping and DuckDB projection |
| `Ara3D.IfcTypes` | Generated IFC entity types (shared project, see `tools/Ara3D.IfcTypeGen`) |
| `Ara3D.IfcLoader` | STEP parsing and web-ifc geometry |
| `Ara3D.Ifc.Mesher` | Pure C# tessellation |
| `Ara3D.Ifc.Editing` | Byte-exact property-set patching |
| `Ara3D.Ifc.Bos` | IFC to BOS conversion |

Tests are under `tests/data`.
