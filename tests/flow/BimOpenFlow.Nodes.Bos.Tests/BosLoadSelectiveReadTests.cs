using Ara3D.BimOpenSchema;
using Ara3D.BimOpenSchema.DuckDb;
using Ara3D.BimOpenSchema.Harmonizer;
using Ara3D.BimOpenSchema.IO;
using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.DataTable;
using Ara3D.Utils;
using BimOpenToolkit.TestSupport;

namespace BimOpenFlow.Nodes.Bos.Tests;

/// <summary>bos.load reads only the entities, parameters, and relations tables (plus what they index).
/// A table left unread comes back empty, so a wrong choice would change the output without an error:
/// these tests build the three text views from a full read and compare every cell.</summary>
[TestFixture]
public sealed class BosLoadSelectiveReadTests
{
    [TestCase("duplex.bos", false)]
    [TestCase("duplex.bos", true)]
    [TestCase("schependomlaan.bos", false)]
    [TestCase("schependomlaan.bos", true)]
    public void Outputs_equal_the_views_of_a_full_read(string sample, bool harmonize)
    {
        var source = RepoPaths.Deps("bim-open-data", "samples", "public", sample);
        if (!File.Exists(source))
            Assert.Ignore($"{source} not found");
        // Both reads see one copy, so a sample regenerated while the test runs cannot split them.
        var path = Path.Combine(TestContext.CurrentContext.WorkDirectory, $"selective-{harmonize}-{sample}");
        File.Copy(source, path, overwrite: true);

        var actual = new BosLoadNode().Eval(null, ("path", path), ("harmonize", harmonize ? "true" : "false"));
        var expected = FullReadViews(path, harmonize);

        for (var i = 0; i < 3; i++)
        {
            var table = ((TableValue)actual[i]).Table;
            Assert.That(table.Rows.Count, Is.GreaterThan(0), $"output {i}");
            Assert.That(Lines(table), Is.EqualTo(Lines(expected[i])), $"output {i}");
        }
    }

    /// <summary>The same three queries BosLoadNode runs, over a full read.</summary>
    private static IDataTable[] FullReadViews(string path, bool harmonize)
    {
        IBimData data = new FilePath(path).ReadBimDataFromParquetZip();
        if (harmonize)
            data = BosHarmonizer.Harmonize(data);
        using var conn = data.ToDuckDb();
        return
        [
            conn.Query(BosLoadNode.EntitiesQuery, "entities"),
            conn.Query(BosLoadNode.ParametersQuery, "parameters"),
            conn.Query(BosLoadNode.RelationsQuery, "relations"),
        ];
    }

    /// <summary>The header, then each row's cells as text; a null cell reads as a marker no value can equal.</summary>
    private static List<string> Lines(IDataTable table)
    {
        var columns = table.Columns.Select(c => c.ColumnIndex).ToList();
        var lines = new List<string> { string.Join("|", table.ColumnNames()) };
        for (var r = 0; r < table.Rows.Count; r++)
            lines.Add(string.Join("|", columns.Select(c => table[c, r]?.ToString() ?? "\u0001null")));
        return lines;
    }
}
