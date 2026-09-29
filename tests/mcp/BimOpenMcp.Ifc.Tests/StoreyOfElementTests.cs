using System.Text.Json.Nodes;
using Ara3D.MCP;
using BimOpenToolkit.TestSupport;

namespace BimOpenMcp.Ifc.Tests;

/// <summary>TKT-18 and TKT-48: StoreyOfEntity also maps a storey to itself (Depth 0), so joining it
/// straight to ParameterText double-counted a storey's embodied carbon while the Duplex storeys
/// carried a rollup under the element property's own name. Since TKT-48 the storeys carry their
/// totals as Pset_NRCStoreySummary.TotalEmbodiedCarbon_A1A3_kgCO2e, so both views give the element
/// sum; StoreyOfElement still removes the self-mapped row for models that repeat a property.</summary>
[TestFixture]
public sealed class StoreyOfElementTests
{
    private const string A1A3 = "EmbodiedCarbon_A1A3_kgCO2e";

    private IfcSessionCache _cache = null!;
    private McpServer _mcp = null!;
    private string _path = null!;

    [SetUp]
    public void SetUp()
    {
        _path = RepoPaths.Samples("nrc", "duplex-enriched.ifc");
        Assert.That(File.Exists(_path), Is.True, $"Sample model not found at {_path}.");
        _cache = new IfcSessionCache();
        _mcp = IfcMcpServer.Create(_cache, McpTransport.Stdio);
    }

    [TearDown]
    public void TearDown()
    {
        _mcp.Dispose();
        _cache.Dispose();
    }

    /// <summary>The naive join the TKT-18 transcript used gave twice 49,451.2 (98,902.4) while the
    /// storey carried its own rollup of the element property. With the total stored under its own
    /// name, the same query gives the element sum (expected_answers.json Q8, Level 1).</summary>
    [Test]
    public void StoreyOfEntity_JoinedStraightToParameterText_NoLongerDoublesTheStoreyTotal()
    {
        var total = StoreyTotal("StoreyOfEntity", "Level 1", A1A3);
        Assert.That(total, Is.EqualTo(49451.2).Within(0.05));
    }

    [Test]
    public void StoreyOfElement_JoinedToParameterText_MatchesTheExpectedStoreyTotal()
    {
        var total = StoreyTotal("StoreyOfElement", "Level 1", A1A3);
        Assert.That(total, Is.EqualTo(49451.2).Within(0.05));
    }

    /// <summary>The storey's own summary, read through the Depth 0 row only StoreyOfEntity has,
    /// equals the sum of its elements.</summary>
    [Test]
    public void StoreySummary_EqualsTheSumOfItsElements()
    {
        var total = StoreyTotal("StoreyOfEntity", "Level 1", "TotalEmbodiedCarbon_A1A3_kgCO2e", "Pset_NRCStoreySummary");
        Assert.That(total, Is.EqualTo(49451.2).Within(0.05));
    }

    [Test]
    public void StoreyOfElement_NeverMapsAnEntityToItself()
    {
        var data = _mcp.CallData("ifc_sql", new JsonObject
        {
            ["path"] = _path,
            ["sql"] = "SELECT count(*) AS n FROM StoreyOfElement WHERE EntityIndex = StoreyIndex",
        });

        Assert.That(data["rows"]!.AsArray()[0]!.AsArray()[0]!.GetValue<long>(), Is.EqualTo(0));
    }

    private double StoreyTotal(string storeyView, string storeyName, string property, string set = "Pset_NRCEmbodiedCarbon")
    {
        var data = _mcp.CallData("ifc_sql", new JsonObject
        {
            ["path"] = _path,
            ["sql"] = $"""
                SELECT sum(CAST(pt.Value AS DOUBLE)) AS total
                FROM ParameterText pt
                JOIN {storeyView} so ON so.EntityIndex = pt.EntityIndex
                WHERE pt.ParameterGroup = '{set}'
                  AND pt.Name = '{property}'
                  AND so.StoreyName = '{storeyName}'
                """,
        });

        return data["rows"]!.AsArray()[0]!.AsArray()[0]!.GetValue<double>();
    }
}
