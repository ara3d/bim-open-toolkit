using System.Text.Json.Nodes;
using Ara3D.MCP;
using BimOpenToolkit.TestSupport;

namespace BimOpenMcp.Ifc.Tests;

/// <summary>Reproduces TKT-18: joining ParameterText straight to StoreyOfEntity double-counts a
/// storey's embodied carbon, because StoreyOfEntity also maps a storey to itself (Depth 0) and the
/// Duplex sample's storeys each carry a precomputed rollup of that same property. StoreyOfElement
/// removes the self-mapped row, so the same sum comes out right.</summary>
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

    /// <summary>Documents the bug: the naive join the transcript used reports Level 1's A1-A3 total
    /// as exactly twice the expected 49,451.2, because it also picks up the storey entity's own
    /// precomputed rollup of the same property.</summary>
    [Test]
    public void StoreyOfEntity_JoinedStraightToParameterText_DoublesTheStoreyTotal()
    {
        var total = StoreyTotal("StoreyOfEntity", "Level 1");
        Assert.That(total, Is.EqualTo(98902.4).Within(0.05));
    }

    /// <summary>The fix: StoreyOfElement excludes the self-mapped row, so the same query gives the
    /// expected, undoubled total. This query fails outright before the fix, because StoreyOfElement
    /// does not exist yet.</summary>
    [Test]
    public void StoreyOfElement_JoinedToParameterText_MatchesTheExpectedStoreyTotal()
    {
        var total = StoreyTotal("StoreyOfElement", "Level 1");
        Assert.That(total, Is.EqualTo(49451.2).Within(0.05));
    }

    [Test]
    public void StoreyOfElement_NeverMapsAnEntityToItself()
    {
        var data = CallData("ifc_sql", new JsonObject
        {
            ["path"] = _path,
            ["sql"] = "SELECT count(*) AS n FROM StoreyOfElement WHERE EntityIndex = StoreyIndex",
        });

        Assert.That(data["rows"]!.AsArray()[0]!.AsArray()[0]!.GetValue<long>(), Is.EqualTo(0));
    }

    private double StoreyTotal(string storeyView, string storeyName)
    {
        var data = CallData("ifc_sql", new JsonObject
        {
            ["path"] = _path,
            ["sql"] = $"""
                SELECT sum(CAST(pt.Value AS DOUBLE)) AS total
                FROM ParameterText pt
                JOIN {storeyView} so ON so.EntityIndex = pt.EntityIndex
                WHERE pt.ParameterGroup = 'Pset_NRCEmbodiedCarbon'
                  AND pt.Name = '{A1A3}'
                  AND so.StoreyName = '{storeyName}'
                """,
        });

        return data["rows"]!.AsArray()[0]!.AsArray()[0]!.GetValue<double>();
    }

    private JsonNode CallData(string tool, JsonObject arguments)
    {
        var payload = Call(tool, arguments);
        Assert.That(payload["ok"]!.GetValue<bool>(), Is.True, payload["error"]?.GetValue<string>());
        return payload["data"]!;
    }

    private JsonObject Call(string tool, JsonObject arguments)
    {
        var request = new JsonObject
        {
            ["jsonrpc"] = "2.0",
            ["id"] = 1,
            ["method"] = "tools/call",
            ["params"] = new JsonObject { ["name"] = tool, ["arguments"] = arguments },
        };

        var result = _mcp.HandlePost(request.ToJsonString());
        var response = JsonNode.Parse(result.JsonBody!)!;
        Assert.That(response["error"], Is.Null, response["error"]?.ToJsonString());
        var text = response["result"]!["content"]![0]!["text"]!.GetValue<string>();
        return (JsonObject)JsonNode.Parse(text)!;
    }
}
