using BimOpenFlow.Host;
using BimOpenToolkit.TestSupport;

namespace BimOpenFlow.Studio.Tests;

/// <summary>docs/nodes.catalog.json is what GET /api/catalog/nodes answers, over the nodes of both
/// studio profiles, committed so tools can size the BIM samples' node cards without a running host
/// (`npm run relayout-samples -- --catalog docs/nodes.catalog.json --samples ...` in
/// bimopenflow/web/packages/graph, whose own tests use the generic catalog beside them). This test fails when a pack changes and the
/// file is not regenerated; run `dotnet run --project src/studio/BimOpenFlow.Studio -- nodedocs`
/// (or rerun this test with BOF_WRITE_NODE_CATALOG=1) and commit the file.</summary>
public sealed class NodeCatalogFileTests
{
    private static readonly string CatalogPath = Path.Combine(RepoPaths.Root, "docs", NodeCatalogFile.FileName);

    [Test]
    public void CommittedCatalog_MatchesThePacks()
    {
        var expected = NodeCatalogFile.Text(StudioComposition.Profiles);
        if (Environment.GetEnvironmentVariable("BOF_WRITE_NODE_CATALOG") == "1")
            File.WriteAllText(CatalogPath, expected);
        var committed = File.Exists(CatalogPath) ? File.ReadAllText(CatalogPath).ReplaceLineEndings("\n") : "";
        Assert.That(committed, Is.EqualTo(expected),
            $"{CatalogPath} is stale: run bimopenflow-studio nodedocs and commit the file");
    }
}
