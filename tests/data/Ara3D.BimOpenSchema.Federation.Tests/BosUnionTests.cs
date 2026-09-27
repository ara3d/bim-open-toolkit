using Ara3D.BimOpenSchema.DuckDb;
using Ara3D.BimOpenSchema.IO;
using Ara3D.Utils;

namespace Ara3D.BimOpenSchema.Federation.Tests;

/// <summary>Runs entirely over FederationExample, so it needs no private IFC files.</summary>
[TestFixture]
public sealed class BosUnionTests
{
    [Test]
    public void Union_HasFiveDocumentsInInputOrder()
    {
        var union = FederationExample.Union();
        var titles = union.Documents.Select(d => union.Strings[(int)d.Title]).ToArray();
        Assert.That(titles, Is.EqualTo(new[] { "Arch", "Struct", "Elec", "Site", "Plumb" }));
    }

    [Test]
    public void Union_EntityCountIsTheSumOfEachDocuments()
    {
        var inputs = FederationExample.Documents();
        var expected = inputs.Sum(i => i.Data.Entities.Length);
        var union = BosUnion.Union(inputs);
        Assert.That(union.Entities.Length, Is.EqualTo(expected));
    }

    [Test]
    public void Union_HasNoGeometry()
        => Assert.That(FederationExample.Union().Geometry, Is.Null);

    [Test]
    public void WriteBos_RoundTripsThroughReadBimDataFromParquetZip()
    {
        var union = FederationExample.Union();
        var path = new FilePath(Path.Combine(Path.GetTempPath(), $"federation-union-{Guid.NewGuid():N}.bos"));
        try
        {
            BosUnion.WriteBos(union, path);
            var roundTripped = path.ReadBimDataFromParquetZip();
            Assert.That(roundTripped.Entities.Length, Is.EqualTo(union.Entities.Length));
            Assert.That(roundTripped.Documents.Length, Is.EqualTo(union.Documents.Length));
            Assert.That(roundTripped.Strings, Is.EqualTo(union.Strings));
        }
        finally
        {
            File.Delete(path);
        }
    }

    [Test]
    public void WriteDuckDb_HasTheBosTextAndStoreyViews()
    {
        var union = FederationExample.Union();
        var path = new FilePath(Path.Combine(Path.GetTempPath(), $"federation-union-{Guid.NewGuid():N}.duckdb"));
        try
        {
            BosUnion.WriteDuckDb(union, path);
            using var conn = BosDuckDb.Open(path);
            Assert.That(conn.GetTableNames(includeViews: true), Is.SupersetOf(new[] { "EntityText", "StoreyOfEntity" }));
        }
        finally
        {
            File.Delete(path);
        }
    }

    [Test]
    public void WriteDuckDb_DeletesAnExistingFileFirst()
    {
        var path = new FilePath(Path.Combine(Path.GetTempPath(), $"federation-union-{Guid.NewGuid():N}.duckdb"));
        File.WriteAllText(path, "not a database");
        try
        {
            BosUnion.WriteDuckDb(FederationExample.Union(), path);
            using var conn = BosDuckDb.Open(path);
            Assert.That(conn.GetTableNames(includeViews: true), Does.Contain("EntityText"));
        }
        finally
        {
            File.Delete(path);
        }
    }

    [Test]
    public void Summarize_ReportsEachDocumentsDeclaredLengthUnit()
    {
        var summaries = BosUnion.Summarize(FederationExample.Union());
        Assert.That(summaries.Select(s => s.Title), Is.EqualTo(new[] { "Arch", "Struct", "Elec", "Site", "Plumb" }));

        // Numbers are stored as float (BimOpenSchema.Numbers), so the round trip through
        // BosUnion.Summarize loses double precision; compare within a tight tolerance.
        var arch = summaries.Single(s => s.Title == "Arch");
        Assert.That(arch.LengthUnit, Is.EqualTo("FOOT"));
        Assert.That(arch.LengthUnitToMetre, Is.EqualTo(0.3048).Within(1e-6));

        var site = summaries.Single(s => s.Title == "Site");
        Assert.That(site.LengthUnit, Is.EqualTo("METRE"));
        Assert.That(site.LengthUnitToMetre, Is.EqualTo(1.0).Within(1e-6));

        var plumb = summaries.Single(s => s.Title == "Plumb");
        Assert.That(plumb.LengthUnit, Is.Null);
        Assert.That(plumb.LengthUnitToMetre, Is.Null);
    }
}
