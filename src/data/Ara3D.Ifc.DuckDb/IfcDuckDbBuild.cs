using Ara3D.BimOpenSchema.DuckDb;
using Ara3D.BimOpenSchema.IO;
using Ara3D.Utils;

namespace Ara3D.Ifc.DuckDb;

/// <summary>Builds the DuckDB database for an IFC file. The data-layer twin of the MCP server's
/// <c>IfcBosArtifacts</c>, for callers that may not reference <c>src/mcp</c>.</summary>
public static class IfcDuckDbBuild
{
    /// <summary>Converts the IFC to BOS, loads it into a new DuckDB file, and creates the text
    /// views. Overwrites the database. Returns the database path.</summary>
    public static FilePath Build(FilePath ifc, FilePath duckDb)
    {
        var folder = Path.Combine(Path.GetTempPath(), "ara3d-ifc-duckdb", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(folder);
        try
        {
            var bos = new FilePath(Path.Combine(folder, Path.GetFileNameWithoutExtension(ifc.FullPath) + ".bos"));
            SaveBos(ifc, bos);

            var directory = Path.GetDirectoryName(duckDb.FullPath);
            if (!string.IsNullOrEmpty(directory))
                Directory.CreateDirectory(directory);

            // A database left from an earlier build keeps tables this one no longer writes, so
            // replacing tables in place is not enough to make the result reproducible.
            File.Delete(duckDb.FullPath);

            bos.BosToDuckDB(duckDb);
            BosDuckDbViews.CreateViews(duckDb);
            return duckDb;
        }
        finally
        {
            TryDelete(folder);
        }
    }

    /// <summary>Runs the converter directly rather than through <c>IfcToBosConverter.Convert</c>,
    /// which never disposes the <c>IfcFile</c> it opens; that leaks a pinned whole-file buffer and
    /// a native web-ifc model for the life of the process.</summary>
    private static void SaveBos(FilePath ifc, FilePath bos)
    {
        var converter = new IfcToBosConverter(ifc);
        try
        {
            converter.SaveToBos(bos);
        }
        finally
        {
            converter.IfcFile?.Dispose();
        }
    }

    private static void TryDelete(string folder)
    {
        try
        {
            Directory.Delete(folder, recursive: true);
        }
        catch (IOException)
        {
        }
    }
}
