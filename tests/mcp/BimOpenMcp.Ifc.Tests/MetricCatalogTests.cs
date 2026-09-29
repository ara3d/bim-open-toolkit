using System.Text.Json.Nodes;
using Ara3D.MCP;
using BimOpenToolkit.TestSupport;

namespace BimOpenMcp.Ifc.Tests;

/// <summary>MetricCatalog (TKT-48): the enriched Duplex names samples/nrc/nrc-metrics.csv in its
/// provenance set, so the table holds that dictionary; the unenriched Duplex names none, and a copy
/// of the enriched file without the dictionary beside it names a file that is not there, so both
/// get the table with no rows.</summary>
[TestFixture]
public sealed class MetricCatalogTests
{
    private IfcSessionCache _cache = null!;
    private McpServer _mcp = null!;
    private string _scratch = null!;

    [OneTimeSetUp]
    public void OneTimeSetUp()
    {
        _cache = new IfcSessionCache();
        _mcp = IfcMcpServer.Create(_cache, McpTransport.Stdio);
        _scratch = Path.Combine(Path.GetTempPath(), "bimopenmcp-ifc-tests", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(_scratch);
    }

    [OneTimeTearDown]
    public void OneTimeTearDown()
    {
        _mcp.Dispose();
        _cache.Dispose();
        try
        {
            Directory.Delete(_scratch, recursive: true);
        }
        catch (IOException)
        {
        }
    }

    [Test]
    public void EnrichedModel_ListsTheDictionaryItsProvenanceNames()
    {
        var path = RepoPaths.Samples("nrc", "duplex-enriched.ifc");
        var rows = _mcp.Rows(path,
            "SELECT PropertySet, PropertyName, Rollup FROM MetricCatalog WHERE MetricId = 'NRC.OC.ANNUAL' ORDER BY Level");

        // nrc-metrics.csv: the operational-carbon metric at building, element, and storey level.
        Assert.That(rows.Select(Cells), Is.EqualTo(new[]
        {
            new[] { "Pset_NRCBuildingSummary", "TotalOperationalCarbon_kgCO2e_per_year", "sum" },
            new[] { "Pset_NRCOperationalCarbon", "OperationalCarbon_kgCO2e_per_year", "none" },
            new[] { "Pset_NRCStoreySummary", "TotalOperationalCarbon_kgCO2e_per_year", "sum" },
        }));
        Assert.That(Count(path), Is.EqualTo(File.ReadLines(RepoPaths.Samples("nrc", "nrc-metrics.csv")).Count() - 1));
        Assert.That(_mcp.CallData("ifc_to_bos", new JsonObject { ["path"] = path })["metricDictionary"]!.GetValue<string>(),
            Is.EqualTo(Path.GetFullPath(RepoPaths.Samples("nrc", "nrc-metrics.csv"))));
    }

    [Test]
    public void ModelWithoutProvenance_HasAnEmptyCatalogWithTheDictionaryColumns()
    {
        var path = RepoPaths.Samples("nrc", "duplex-base.ifc");
        var table = _mcp.CallData("ifc_table", new JsonObject { ["path"] = path, ["table"] = "MetricCatalog" })["items"]![0]!;

        Assert.That(table["rowCount"]!.GetValue<long>(), Is.EqualTo(0));
        Assert.That(table["columns"]!.AsArray().Select(c => c!["name"]!.GetValue<string>()), Is.EqualTo(new[]
        {
            "MetricId", "Level", "PropertySet", "PropertyName", "ValueType", "Unit", "LifecycleStage", "Rollup",
            "Description", "Decimals",
        }));
    }

    [Test]
    public void DictionaryMissingBesideTheModel_LeavesTheCatalogEmpty()
    {
        var path = Path.Combine(_scratch, "duplex-enriched.ifc");
        File.Copy(RepoPaths.Samples("nrc", "duplex-enriched.ifc"), path);
        Assert.That(Count(path), Is.EqualTo(0));
    }

    private long Count(string path)
        => _mcp.Rows(path, "SELECT count(*) FROM MetricCatalog")[0]![0]!.GetValue<long>();

    private static string[] Cells(JsonNode? row)
        => row!.AsArray().Select(cell => cell!.GetValue<string>()).ToArray();
}
