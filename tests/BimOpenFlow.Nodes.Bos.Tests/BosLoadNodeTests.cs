using Ara3D.BimOpenSchema;
using Ara3D.BimOpenSchema.IO;
using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.Utils;

namespace BimOpenFlow.Nodes.Bos.Tests;

[TestFixture]
public sealed class BosLoadNodeTests
{
    private string _folder = null!;
    private string _bosPath = null!;

    /// <summary>One wall in one document, mirroring the DuckDb test dataset:
    /// category and type entities plus a string, number, and entity parameter.</summary>
    private static BimData BuildTinyData()
    {
        var bdb = new BimDataBuilder();
        var doc = bdb.AddDocument("TestDoc", "test.ifc");
        var category = bdb.AddEntity(1, "guid-cat", doc, "Walls", BimDataBuilder.InvalidEntityIndex, BimDataBuilder.InvalidEntityIndex);
        var type = bdb.AddEntity(2, "guid-type", doc, "BasicWall", category, BimDataBuilder.InvalidEntityIndex);
        var wall = bdb.AddEntity(3, "guid-wall", doc, "Wall-001", category, type);
        bdb.AddParameter(wall, "Concrete", "Material", "", "Construction");
        bdb.AddParameter(wall, 2.5, "Height", "m", "Dimensions");
        bdb.AddParameter(wall, type, "TypeRef", "", "Refs");
        bdb.AddRelation(wall, type, RelationType.MemberOf);
        return bdb.Build();
    }

    [OneTimeSetUp]
    public void OneTimeSetUp()
    {
        _folder = Path.Combine(Path.GetTempPath(), "bimopenflow-bos-tests", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(_folder);
        _bosPath = Path.Combine(_folder, "tiny.bos");
        BuildTinyData().WriteToParquetZip(new FilePath(_bosPath));
    }

    [OneTimeTearDown]
    public void OneTimeTearDown()
    {
        try
        {
            Directory.Delete(_folder, recursive: true);
        }
        catch (IOException)
        {
        }
    }

    [Test]
    public void Load_OutputsTheThreeTextViewTables()
    {
        var outputs = new BosLoadNode().Eval(null, ("path", _bosPath));
        Assert.That(outputs, Has.Count.EqualTo(3));

        var entities = ((TableValue)outputs[0]).Table;
        var parameters = ((TableValue)outputs[1]).Table;
        var relations = ((TableValue)outputs[2]).Table;

        Assert.That(entities.Rows, Has.Count.EqualTo(3));
        Assert.That(entities.ColumnNames(), Does.Contain("Name").And.Contain("Category"));
        Assert.That(entities.Cell("Name", 2), Is.EqualTo("Wall-001"));
        Assert.That(parameters.Rows, Has.Count.EqualTo(3));
        Assert.That(relations.Rows, Has.Count.EqualTo(1));
    }

    [Test]
    public void Load_CachesByContentHash()
    {
        var node = new BosLoadNode();
        var first = ((TableValue)node.Eval(null, ("path", _bosPath))[0]).Table;

        var copy = Path.Combine(_folder, "copy.bos");
        File.Copy(_bosPath, copy, overwrite: true);
        var second = ((TableValue)new BosLoadNode().Eval(null, ("path", copy))[0]).Table;

        Assert.That(ReferenceEquals(first, second), Is.True,
            "Same content (even at a different path) should hit the cache.");
    }

    [Test]
    public void Load_Harmonize_AddsCanonicalParameters()
    {
        var plain = ((TableValue)new BosLoadNode().Eval(null, ("path", _bosPath))[1]).Table;
        var harmonized = ((TableValue)new BosLoadNode().Eval(null,
            ("path", _bosPath), ("harmonize", "true"))[1]).Table;
        Assert.That(harmonized.Rows.Count, Is.GreaterThanOrEqualTo(plain.Rows.Count));
    }

    [Test]
    public void Load_MissingFile_Throws()
        => Assert.That(
            () => new BosLoadNode().Eval(null, ("path", Path.Combine(_folder, "absent.bos"))),
            Throws.InstanceOf<FileNotFoundException>());

    [Test]
    public void Load_MissingPathParameter_Throws()
        => Assert.That(() => new BosLoadNode().Eval(null), Throws.ArgumentException);

    [Test]
    [Category("RequiresData")]
    public void Load_RealModel_WhenSampleDataPresent()
    {
        var path = FindData("rac_basic_sample_project-2025.bos");
        var outputs = new BosLoadNode().Eval(null, ("path", path));
        Assert.That(((TableValue)outputs[0]).Table.Rows, Has.Count.GreaterThan(100));
        Assert.That(((TableValue)outputs[1]).Table.Rows, Has.Count.GreaterThan(100));
    }

    private static string FindData(string fileName)
    {
        var dir = new DirectoryInfo(TestContext.CurrentContext.TestDirectory);
        while (dir != null)
        {
            var candidate = Path.Combine(dir.FullName, "data", fileName);
            if (File.Exists(candidate))
                return candidate;
            dir = dir.Parent;
        }

        Assert.Ignore($"Sample model {fileName} not found under a 'data' folder.");
        return "";
    }
}
