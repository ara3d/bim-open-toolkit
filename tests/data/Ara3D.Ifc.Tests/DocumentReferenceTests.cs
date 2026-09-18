namespace Ara3D.Ifc.Tests;

/// <summary>
/// The NRC paper (3.4) asks for the external analytics table to be reachable from the IFC project
/// through IfcDocumentReference/IfcRelAssociatesDocument, not only through a property set.
/// </summary>
public static class DocumentReferenceTests
{
    private const string GuidKey = "Ara3D_Analytics:document";

    private static IfcDocumentInfo AnalyticsTable
        => new(
            Name: "Ara3D Analytics Table",
            Location: "https://example.org/analytics/duplex.csv",
            Identifier: "ARA3D-ANALYTICS-001",
            Description: "Per-element analytics exported alongside the model",
            Purpose: "Layer 2 analytics dataset",
            Format: "text/csv",
            CreationTime: "2026-09-18T00:00:00");

    private static IfcDocumentReferenceBuilder BuildForProject(IfcSourceFile file, out int projectId)
    {
        projectId = file.FirstIdOfType("IFCPROJECT");
        Assert.That(projectId, Is.GreaterThan(0), "duplex.ifc must contain an IFCPROJECT");
        var builder = new IfcDocumentReferenceBuilder(
            file.MaxId + 1, file.FirstIdOfType("IFCOWNERHISTORY"), IfcSchema.Ifc2x3);
        builder.AddDocumentReference(projectId, AnalyticsTable, GuidKey);
        return builder;
    }

    [Test]
    public static void AppendDocumentReferenceDiffsAndRestores()
    {
        TestData.RequireTestKit();
        using var original = IfcSourceFile.Load(TestData.DuplexIfc);
        var builder = BuildForProject(original, out var projectId);
        Assert.That(builder.Lines, Has.Count.EqualTo(3));

        var modifiedPath = Path.Combine(TestData.OutputFolder, "duplex-document.ifc");
        File.WriteAllBytes(modifiedPath, IfcPatcher.Append(original, builder.Lines));

        using var modified = IfcSourceFile.Load(modifiedPath);
        var diff = IfcDiff.Compare(original, modified);
        Assert.That(diff.Added, Is.EqualTo(builder.Ids));
        Assert.That(diff.Deleted, Is.Empty);
        Assert.That(diff.Changed, Is.Empty);

        Assert.That(modified.GetSpan(builder.Ids[0])!.Value.TypeName, Is.EqualTo("IFCDOCUMENTINFORMATION"));
        Assert.That(modified.GetSpan(builder.Ids[1])!.Value.TypeName, Is.EqualTo("IFCDOCUMENTREFERENCE"));

        // The relationship parses as its own entity and names the project and the reference.
        var rel = modified.GetSpan(builder.Ids[2])!.Value;
        Assert.That(rel.TypeName, Is.EqualTo("IFCRELASSOCIATESDOCUMENT"));
        var relText = modified.GetText(rel);
        Assert.That(relText, Does.Contain($"(#{projectId})"));
        Assert.That(relText, Does.EndWith($",#{builder.Ids[1]});"));

        var restoredPath = Path.Combine(TestData.OutputFolder, "duplex-document-restored.ifc");
        File.WriteAllBytes(restoredPath, IfcPatcher.Remove(modified, diff.Added));
        Assert.That(File.ReadAllBytes(restoredPath), Is.EqualTo(File.ReadAllBytes(TestData.DuplexIfc)),
            "Removing the added entities must restore the original file byte-for-byte");
    }

    [Test]
    public static void TwoBuildsProduceIdenticalLines()
    {
        TestData.RequireTestKit();
        using var original = IfcSourceFile.Load(TestData.DuplexIfc);
        var a = BuildForProject(original, out _);
        var b = BuildForProject(original, out _);
        Assert.That(b.Lines, Is.EqualTo(a.Lines));
        Assert.That(b.Ids, Is.EqualTo(a.Ids));
    }

    [Test]
    public static void Ifc2x3LayoutMatchesTheSchema()
    {
        var builder = new IfcDocumentReferenceBuilder(100, 7, IfcSchema.Ifc2x3);
        builder.AddDocumentReference(42, AnalyticsTable, GuidKey);

        // DocumentId, Name, Description, DocumentReferences, Purpose, then 12 unset attributes.
        Assert.That(AttributeCount(builder.Lines[0]), Is.EqualTo(17));
        Assert.That(builder.Lines[0], Does.StartWith(
            "#100=IFCDOCUMENTINFORMATION('ARA3D-ANALYTICS-001','Ara3D Analytics Table'," +
            "'Per-element analytics exported alongside the model',(#101),'Layer 2 analytics dataset',"));
        Assert.That(builder.Lines[0], Does.EndWith("$,$,$,$,$,$,$,$,$,$,$,$);"));

        // Location, ItemReference, Name - Name absent so WR1 holds via ReferenceToDocument.
        Assert.That(builder.Lines[1], Is.EqualTo(
            "#101=IFCDOCUMENTREFERENCE('https://example.org/analytics/duplex.csv','ARA3D-ANALYTICS-001',$);"));

        Assert.That(AttributeCount(builder.Lines[2]), Is.EqualTo(6));
        Assert.That(builder.Lines[2], Does.Contain(",#7,'Ara3D Analytics Table',"));
        Assert.That(builder.Lines[2], Does.EndWith("(#42),#101);"));
    }

    [Test]
    public static void Ifc4LayoutMatchesTheSchema()
    {
        var builder = new IfcDocumentReferenceBuilder(100, 7, IfcSchema.Ifc4);
        builder.AddDocumentReference(42, AnalyticsTable, GuidKey);

        // Identification, Name, Description, Location, Purpose, ..., CreationTime, ..., ElectronicFormat, ...
        Assert.That(AttributeCount(builder.Lines[0]), Is.EqualTo(17));
        Assert.That(SplitAttributes(builder.Lines[0])[3], Is.EqualTo("'https://example.org/analytics/duplex.csv'"));
        Assert.That(SplitAttributes(builder.Lines[0])[10], Is.EqualTo("'2026-09-18T00:00:00'"));
        Assert.That(SplitAttributes(builder.Lines[0])[12], Is.EqualTo("'text/csv'"));

        // Location, Identification, Name, Description, ReferencedDocument.
        Assert.That(builder.Lines[1], Is.EqualTo(
            "#101=IFCDOCUMENTREFERENCE('https://example.org/analytics/duplex.csv','ARA3D-ANALYTICS-001',$," +
            "'Per-element analytics exported alongside the model',#100);"));

        Assert.That(builder.Lines[2], Does.EndWith("(#42),#101);"));
    }

    [Test]
    public static void IdentifierFallsBackToTheName()
    {
        var builder = new IfcDocumentReferenceBuilder(1, 7, IfcSchema.Ifc4);
        builder.AddDocumentReference(42, new IfcDocumentInfo("Table", "table.csv"), "k");
        Assert.That(SplitAttributes(builder.Lines[0])[0], Is.EqualTo("'Table'"));
        Assert.That(SplitAttributes(builder.Lines[1])[1], Is.EqualTo("$"));
    }

    /// <summary>Top-level attributes of one emitted line; the test data has no nested lists or commas.</summary>
    private static string[] SplitAttributes(string line)
    {
        var open = line.IndexOf('(');
        var body = line.Substring(open + 1, line.Length - open - 3);
        return body.Replace("(", "").Replace(")", "").Split(',');
    }

    private static int AttributeCount(string line)
        => SplitAttributes(line).Length;
}
