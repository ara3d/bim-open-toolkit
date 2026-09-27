using Ara3D.BimOpenSchema.DuckDb;
using DuckDB.NET.Data;

namespace Ara3D.BimOpenSchema.Federation.Tests;

/// <summary>Checks that FederationExample matches the plan's "FederationExample contents"
/// table for the facts other chunks' rules depend on. This is not a full re-statement of that
/// table: the match graph tests (C5, C6) and FederationStore tests (C8) check the rest.</summary>
[TestFixture]
public sealed class FederationExampleTests
{
    private DuckDBConnection _conn = null!;

    [OneTimeSetUp]
    public void OneTimeSetUp()
        => _conn = FederationExample.Union().ToDuckDb();

    [OneTimeTearDown]
    public void OneTimeTearDown()
        => _conn.Dispose();

    [Test]
    public void ElecLightFixture_HasElecL1AsItsStorey()
    {
        var table = _conn.Query("""
            SELECT docTitle.Strings AS Document, s.StoreyName
            FROM StoreyOfEntity s
            JOIN EntityText e ON e.EntityIndex = s.EntityIndex
            JOIN Entities storeyEntity ON storeyEntity.rowid = s.StoreyIndex
            JOIN Documents doc ON doc.rowid = storeyEntity.Document
            JOIN Strings docTitle ON docTitle.rowid = doc.Title
            WHERE e.Category = 'IFCLIGHTFIXTURE'
            """);

        Assert.That(table.Rows, Has.Count.EqualTo(1));
        Assert.That(table.Rows[0][0], Is.EqualTo("Elec"));
        Assert.That(table.Rows[0][1], Is.EqualTo("L1"));
    }

    [Test]
    public void ArchRoom101_CarriesOtherCategoryRoomsAndItsRoomNumber()
    {
        var table = _conn.Query("""
            SELECT p2.Value
            FROM ParameterText p1
            JOIN ParameterText p2 ON p2.EntityIndex = p1.EntityIndex
            WHERE p1.Name = 'Ifc:Room:Number' AND p1.Value = '101'
              AND p2.ParameterGroup = 'Other' AND p2.Name = 'Category'
            """);

        Assert.That(table.Rows, Has.Count.EqualTo(1));
        Assert.That(table.Rows[0][0], Is.EqualTo("Rooms"));
    }

    [Test]
    public void FiveDocuments_EachWithOneIfcProjectEntity()
    {
        var table = _conn.Query("""
            SELECT docTitle.Strings, COUNT(*)
            FROM EntityText e
            JOIN Entities entity ON entity.rowid = e.EntityIndex
            JOIN Documents doc ON doc.rowid = entity.Document
            JOIN Strings docTitle ON docTitle.rowid = doc.Title
            WHERE e.Category = 'IFCPROJECT'
            GROUP BY docTitle.Strings
            """);

        Assert.That(table.Rows, Has.Count.EqualTo(5));
        foreach (var row in table.Rows)
            Assert.That(row[1], Is.EqualTo(1L), $"document {row[0]} should have exactly one IFCPROJECT entity");
    }
}
