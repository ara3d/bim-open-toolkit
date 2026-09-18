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
        ["EntityText", "ParameterText", "RelationText"];

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
