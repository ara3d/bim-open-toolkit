using Ara3D.BimOpenSchema.DuckDb;
using Ara3D.BimOpenSchema.IO;
using Ara3D.Logging;
using Ara3D.Utils;

namespace Ara3D.BimOpenSchema.Federation;

/// <summary>One document to add to a union, and the title and path it is recorded under.</summary>
public sealed record UnionInput(IBimData Data, string Title, string Path);

/// <summary>One document's entity count and declared length unit, as recorded on its
/// IFCPROJECT entity by the converter (C2). LengthUnit is null when the document declares
/// none, which storey matching treats as unknown rather than guessing metres.</summary>
public sealed record DocumentSummary(string Title, string Path, int Entities, string? LengthUnit, double? LengthUnitToMetre);

/// <summary>Converts IFC files one at a time and unions the results into one geometry-free
/// document, with no matching or federation logic: that lives in the match graph (C5, C6) and
/// the studio views (C8). Keeping the two apart lets the union stay mechanical and the rules
/// stay in SQL.</summary>
public static class BosUnion
{
    // Read as string literals rather than IfcLengthUnit's constants: C2 (Ara3D.Ifc.Bos) may not
    // have committed its parameter names yet, and Summarize only needs to match by name.
    private const string LengthUnitNameParameter = "Ifc:LengthUnit";
    private const string LengthUnitScaleParameter = "Ifc:LengthUnitToMetre";
    private const string ProjectCategory = "IFCPROJECT";

    /// <summary>Converts each file with IfcToBosConverter, disposing its IfcFile before the
    /// next so peak memory reflects one file, not all of them. Title is the file name without
    /// its extension.</summary>
    public static IReadOnlyList<UnionInput> ConvertIfc(IReadOnlyList<FilePath> ifcFiles, ILogger? logger = null)
    {
        var result = new List<UnionInput>(ifcFiles.Count);
        foreach (var file in ifcFiles)
        {
            var converter = new IfcToBosConverter(file, logger);
            try
            {
                result.Add(new UnionInput(converter.BimDataBuilder.Build(), file.GetFileNameWithoutExtension(), file.FullPath));
            }
            finally
            {
                converter.IfcFile.Dispose();
            }
        }
        return result;
    }

    /// <summary>One document per input, in input order, via AddBimData(bd, title, path).
    /// Geometry is never merged: AddBimData does not touch it, so the result's Geometry is
    /// always null.</summary>
    public static BimData Union(IReadOnlyList<UnionInput> inputs)
    {
        var builder = new BimDataBuilder();
        foreach (var input in inputs)
            builder.AddBimData(input.Data, input.Title, input.Path);
        return builder.Build();
    }

    /// <summary>Parquet zip of the non-geometry tables; ReadBimDataFromParquetZip reads it back.</summary>
    public static void WriteBos(IBimData union, FilePath output)
        => union.WriteToParquetZip(output);

    /// <summary>Deletes then writes a DuckDB file: BOS tables via BosDuckDb.LoadBimData, then
    /// BosDuckDbViews.CreateViews. This load path avoids the enum shift the DuckDb README warns
    /// about for parquet-derived databases.</summary>
    public static void WriteDuckDb(IBimData union, FilePath output)
    {
        if (File.Exists(output))
            File.Delete(output);
        using var conn = BosDuckDb.Open(output);
        conn.LoadBimData(union);
        conn.CreateViews();
    }

    /// <summary>One row per document, with its entity count and the length unit declared on
    /// its IFCPROJECT entity (null when the document declares none).</summary>
    public static IReadOnlyList<DocumentSummary> Summarize(IBimData union)
    {
        var entityCounts = new int[union.Documents.Length];
        foreach (var e in union.Entities)
            entityCounts[(int)e.Document]++;

        var result = new DocumentSummary[union.Documents.Length];
        for (var d = 0; d < union.Documents.Length; d++)
        {
            var doc = union.Documents[d];
            var (name, scale) = ReadLengthUnit(union, (DocumentIndex)d);
            result[d] = new DocumentSummary(union.Strings[(int)doc.Title], union.Strings[(int)doc.Path], entityCounts[d], name, scale);
        }
        return result;
    }

    private static (string? Name, double? Scale) ReadLengthUnit(IBimData union, DocumentIndex document)
    {
        string? name = null;
        double? scale = null;
        for (var e = 0; e < union.Entities.Length; e++)
        {
            var entity = union.Entities[e];
            if (entity.Document != document || !IsCategory(union, entity.Category, ProjectCategory))
                continue;
            foreach (var p in union.Parameters)
            {
                if ((int)p.Entity != e)
                    continue;
                var descriptor = union.Descriptors[(int)p.Descriptor];
                var descriptorName = union.Strings[(int)descriptor.Name];
                if (descriptorName == LengthUnitNameParameter)
                    name = union.Strings[p.Value];
                else if (descriptorName == LengthUnitScaleParameter)
                    scale = union.Numbers[p.Value];
            }
        }
        return (name, scale);
    }

    private static bool IsCategory(IBimData union, EntityIndex category, string name)
        => (int)category >= 0 && union.Strings[(int)union.Entities[(int)category].Name] == name;
}
