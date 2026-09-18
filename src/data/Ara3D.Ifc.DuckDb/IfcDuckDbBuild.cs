using Ara3D.Utils;

namespace Ara3D.Ifc.DuckDb;

/// <summary>Builds the DuckDB database for an IFC file. Contract C3 of the nrc-handoff wave;
/// the body belongs to track A.</summary>
public static class IfcDuckDbBuild
{
    /// <summary>Converts the IFC to BOS, loads it into a new DuckDB file, and creates the text
    /// views. Overwrites the database. Returns the database path.</summary>
    public static FilePath Build(FilePath ifc, FilePath duckDb)
        => throw new NotImplementedException("Track A fills in IfcDuckDbBuild.Build.");
}
