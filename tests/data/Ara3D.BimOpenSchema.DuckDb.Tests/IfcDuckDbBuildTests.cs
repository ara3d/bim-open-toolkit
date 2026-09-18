using System.Runtime.CompilerServices;
using Ara3D.BimOpenSchema.IO;
using Ara3D.Ifc.DuckDb;
using Ara3D.Utils;

namespace Ara3D.BimOpenSchema.DuckDb.Tests;

/// <summary>Builds a database from the committed sample <c>samples/nrc/duplex-enriched.ifc</c> once
/// and asserts what a caller may rely on: the BOS tables, the text views, and rows behind them.
/// The conversion parses the whole file and loads geometry, so it is paid once for the fixture.</summary>
[TestFixture]
[Category("RequiresData")]
public sealed class IfcDuckDbBuildTests
{
    private static readonly string[] ExpectedTables =
        ["Descriptors", "Diagnostics", "Documents", "Entities", "Numbers", "Parameters", "Points", "Relations", "Strings"];

    private static readonly string[] ExpectedViews =
        ["EntityText", "ParameterText", "RelationText", "StoreyOfEntity"];

    private string _folder = "";
    private FilePath _database;

    [OneTimeSetUp]
    public void BuildDatabase()
    {
        _folder = Path.Combine(Path.GetTempPath(), "ara3d-ifc-duckdb-tests", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(_folder);
        _database = IfcDuckDbBuild.Build(
            new FilePath(SamplePath("duplex-enriched.ifc")),
            new FilePath(Path.Combine(_folder, "duplex-enriched.duckdb")));
    }

    [OneTimeTearDown]
    public void DeleteDatabase()
        => BosDuckDbTests.TryDelete(_folder);

    [Test]
    public void Build_ReturnsAnExistingDatabase()
    {
        Assert.That(_database.FullPath, Is.EqualTo(Path.Combine(_folder, "duplex-enriched.duckdb")));
        Assert.That(File.Exists(_database.FullPath), Is.True);
    }

    [Test]
    public void Build_CreatesEveryBosTable()
    {
        using var conn = BosDuckDb.Open(_database);
        Assert.That(conn.GetTableNames(), Is.EquivalentTo(ExpectedTables));
    }

    [Test]
    public void Build_CreatesEveryTextView()
    {
        using var conn = BosDuckDb.Open(_database);
        var views = conn.GetTableNames(includeViews: true).Except(ExpectedTables);
        Assert.That(views, Is.EquivalentTo(ExpectedViews));
    }

    [Test]
    public void Build_FillsTheTextViews()
    {
        using var conn = BosDuckDb.Open(_database);
        Assert.Multiple(() =>
        {
            Assert.That(conn.ScalarInt64("SELECT count(*) FROM EntityText"), Is.GreaterThan(100));
            Assert.That(conn.ScalarInt64("SELECT count(*) FROM EntityText WHERE GlobalId IS NOT NULL"), Is.GreaterThan(100));
            Assert.That(conn.ScalarInt64("SELECT count(*) FROM ParameterText WHERE Value IS NOT NULL"), Is.GreaterThan(100));
            Assert.That(conn.ScalarInt64("SELECT count(*) FROM RelationText"), Is.GreaterThan(100));
        });
    }

    /// <summary>A stale database from an earlier build must not leave tables behind, or a rebuilt
    /// sample would answer with rows no current input produced.</summary>
    [Test]
    public void Build_OverwritesAnExistingDatabase()
    {
        using (var conn = BosDuckDb.Open(_database))
            conn.Execute("CREATE OR REPLACE TABLE Leftover AS SELECT 1 AS One");

        IfcDuckDbBuild.Build(new FilePath(SamplePath("duplex-enriched.ifc")), _database);

        using var rebuilt = BosDuckDb.Open(_database);
        Assert.That(rebuilt.GetTableNames(), Is.EquivalentTo(ExpectedTables));
    }

    /// <summary>Every element the analytics CSV places on Level 1 reaches the storey named
    /// "Level 1" through the view. The 103 is the row count of
    /// <c>samples/nrc/nrc_analytics_elements.csv</c> for <c>Storey = 'Level 1'</c> and the
    /// <c>Elements</c> column of the Level 1 row of <c>samples/nrc/nrc_analytics_storeys.csv</c>.
    /// The proof-of-concept transcript got this number wrong by walking containment alone.</summary>
    [Test]
    public void StoreyOfEntity_PlacesEveryLevel1ElementOfTheAnalyticsCsvOnLevel1()
    {
        using var conn = BosDuckDb.Open(_database);
        var elements = ReadCsv("nrc_analytics_elements.csv");
        var storeys = ReadCsv("nrc_analytics_storeys.csv");

        Assert.Multiple(() =>
        {
            Assert.That(conn.ScalarInt64($"SELECT count(*) FROM {elements} WHERE Storey = 'Level 1'"),
                Is.EqualTo(103), "samples/nrc/nrc_analytics_elements.csv no longer holds 103 Level 1 elements");
            Assert.That(conn.ScalarInt64($"SELECT Elements FROM {storeys} WHERE Container = 'Level 1'"),
                Is.EqualTo(103), "samples/nrc/nrc_analytics_storeys.csv no longer reports 103 elements on Level 1");
            Assert.That(
                conn.ScalarInt64(
                    $"SELECT count(*) FROM {elements} c "
                    + "JOIN EntityText e ON e.GlobalId = c.GlobalId "
                    + "JOIN StoreyOfEntity s ON s.EntityIndex = e.EntityIndex "
                    + "WHERE c.Storey = 'Level 1' AND s.StoreyName = 'Level 1'"),
                Is.EqualTo(103));
        });
    }

    /// <summary>The same agreement for all four storeys, against the per-storey element counts of
    /// <c>samples/nrc/nrc_analytics_storeys.csv</c> (Level 1 103, Level 2 93, Roof 8, T/FDN 14),
    /// joined by GlobalId through <c>samples/nrc/nrc_analytics_elements.csv</c>. No element of the
    /// CSV is left without a storey and none lands on the wrong one.</summary>
    [Test]
    public void StoreyOfEntity_AgreesWithThePerStoreyCountsOfTheAnalyticsCsvs()
    {
        using var conn = BosDuckDb.Open(_database);
        var elements = ReadCsv("nrc_analytics_elements.csv");
        var storeys = ReadCsv("nrc_analytics_storeys.csv");

        Assert.That(
            conn.ScalarInt64(
                $"SELECT count(*) FROM {elements} c "
                + "LEFT JOIN EntityText e ON e.GlobalId = c.GlobalId "
                + "LEFT JOIN StoreyOfEntity s ON s.EntityIndex = e.EntityIndex "
                + "WHERE s.StoreyName IS DISTINCT FROM c.Storey"),
            Is.Zero,
            "every row of nrc_analytics_elements.csv must resolve to the storey the CSV names");

        Assert.That(
            conn.ScalarInt64(
                $"SELECT count(*) FROM (SELECT Container, Elements FROM {storeys} WHERE Container <> 'Building') t "
                + $"FULL JOIN (SELECT s.StoreyName, count(*) AS n FROM {elements} c "
                + "  JOIN EntityText e ON e.GlobalId = c.GlobalId "
                + "  JOIN StoreyOfEntity s ON s.EntityIndex = e.EntityIndex GROUP BY 1) v "
                + "ON v.StoreyName = t.Container WHERE v.n IS DISTINCT FROM t.Elements"),
            Is.Zero,
            "the per-storey counts must match nrc_analytics_storeys.csv exactly, storey for storey");
    }

    /// <summary>The view covers entities the analytics CSVs never list: the storey itself at depth 0,
    /// its spaces, and aggregates such as IfcStair and IfcRoof. Level 1 therefore holds 114 rows
    /// against the CSV's 103 elements, which is why the CSV join above is the assertion that
    /// matters.</summary>
    [Test]
    public void StoreyOfEntity_CoversMoreThanTheAnalyticsElements()
    {
        using var conn = BosDuckDb.Open(_database);
        Assert.Multiple(() =>
        {
            Assert.That(conn.ScalarInt64("SELECT count(*) FROM StoreyOfEntity WHERE StoreyName = 'Level 1'"),
                Is.EqualTo(114));
            Assert.That(conn.ScalarInt64("SELECT count(*) FROM StoreyOfEntity WHERE Depth = 0"),
                Is.EqualTo(4), "each of the four storeys resolves to itself");
            Assert.That(
                conn.ScalarInt64("SELECT count(*) FROM (SELECT EntityIndex FROM StoreyOfEntity GROUP BY 1 HAVING count(*) > 1)"),
                Is.Zero, "no entity may reach two storeys");
        });
    }

    private static string ReadCsv(string fileName)
        => $"read_csv_auto('{SamplePath(fileName).Replace('\\', '/')}')";

    /// <summary>The repository's <c>samples/nrc</c> folder. Located from this file's compile-time
    /// path because a build with <c>--artifacts-path</c> puts the test binaries outside the
    /// checkout, where walking up from the output folder finds no repository at all.</summary>
    internal static string SamplePath(string fileName, [CallerFilePath] string sourceFile = "")
    {
        var root = Path.GetFullPath(Path.Combine(Path.GetDirectoryName(sourceFile)!, "..", "..", ".."));
        var path = Path.Combine(root, "samples", "nrc", fileName);
        if (!File.Exists(path))
            Assert.Ignore($"Sample {fileName} not found at {path}.");
        return path;
    }
}
