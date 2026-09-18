# Ara3D.Ifc.DuckDb

One function, `IfcDuckDbBuild.Build`, that turns an IFC file into a DuckDB
database: convert to BIM Open Schema with `Ara3D.Ifc.Bos`, load the tables
with `BosToDuckDB`, and create the text views with `BosDuckDbViews`. It is the
data-layer twin of the MCP server's `IfcBosArtifacts`, kept separate so flow
projects (which may not reference `src/mcp`) and tests can build a database
from a committed sample by one repeatable call.

`Ara3D.BimOpenSchema.DuckDb` stays free of the IFC loader; this project is the
only place the two meet.
