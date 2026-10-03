using System.Text;
using System.Text.Json;
using Ara3D.NodeGraph;
using BimOpenFlow.Host;

namespace BimOpenFlow.Studio.Tests;

/// <summary>The studio composes the bim profile the generic host does not know: its packs, its
/// default, and an HTTP host over it serving the BIM node kinds and evaluating a view3d node.</summary>
[TestFixture]
public sealed class StudioCompositionTests
{
    private string _root = null!;
    private HostApp _host = null!;
    private HttpClient _client = null!;

    [OneTimeSetUp]
    public async Task StartHost()
    {
        _root = Path.Combine(Path.GetTempPath(), "bof-studio-bim-" + Guid.NewGuid().ToString("N"));
        var modelsDir = Path.Combine(_root, "models");
        Directory.CreateDirectory(modelsDir);
        var config = new HostConfig([modelsDir], Path.Combine(_root, "cache"),
            Path.Combine(_root, "analyses"), Port: 0, Profile: StudioComposition.BimProfile);
        _host = HostComposition.Build(config, StudioComposition.Bim);
        await _host.App.StartAsync();
        _client = new HttpClient { BaseAddress = new Uri(_host.App.Urls.First()) };
    }

    [OneTimeTearDown]
    public async Task StopHost()
    {
        _client.Dispose();
        await _host.App.StopAsync();
        await _host.App.DisposeAsync();
        try
        {
            Directory.Delete(_root, recursive: true);
        }
        catch (IOException)
        {
        }
    }

    [Test]
    public void Profiles_AreBimThenTables_AndStartWithBim()
        => Assert.Multiple(() =>
        {
            Assert.That(StudioComposition.Profiles.Names, Is.EqualTo(new[] { "bim", "tables" }));
            Assert.That(StudioComposition.Profiles.Default, Is.EqualTo("bim"));
            Assert.That(HostConfig.Resolve([], Path.Combine(_root, "no-settings"), StudioComposition.Profiles).Profile,
                Is.EqualTo("bim"));
        });

    [TestCase("bos.load")]
    [TestCase("view3d.instances")]
    [TestCase("check.rule")]
    [TestCase("sink.exportCsv")]
    public void BimPacks_ContainEachPack(string kind)
        => Assert.That(StudioComposition.BimPacks().Find(kind, 1), Is.Not.Null, kind);

    [Test]
    public async Task NodeCatalog_ServesTheBimPacks()
    {
        var response = await _client.GetAsync("/api/catalog/nodes");
        Assert.That((int)response.StatusCode, Is.EqualTo(200));
        using var catalog = JsonDocument.Parse(await response.Content.ReadAsStringAsync());
        var kinds = catalog.RootElement.GetProperty("nodes").EnumerateArray()
            .Select(n => n.GetProperty("kind").GetString())
            .ToList();
        Assert.That(kinds, Is.SupersetOf(new[] { "bos.load", "view3d.instances", "check.rule", "sink.exportCsv" }));
    }

    /// <summary>view3d.camera into table.sort: BIM-profile nodes that need no model file.</summary>
    [Test]
    public async Task CameraSort_EvaluatesOverHttp()
    {
        var graph = GraphDocument.Empty
            .AddNode("cam", "view3d.camera", 1)
            .SetParam("cam", "name", "front")
            .AddNode("sort", "table.sort", 1)
            .SetParam("sort", "by", "name")
            .Connect("cam.camera", "sort.table");
        var put = await _client.PutAsync("/api/analyses/camera",
            new StringContent(graph.ToCanonicalJson(), Encoding.UTF8, "application/json"));
        Assert.That((int)put.StatusCode, Is.EqualTo(200));

        using var update = JsonDocument.Parse(await (await _client.GetAsync("/api/analyses/camera/state")).Content.ReadAsStringAsync());
        Assert.That(update.RootElement.GetProperty("nodes").EnumerateArray().Select(n => n.GetProperty("status").GetString()),
            Is.EqualTo(new[] { "Ok", "Ok" }));
    }
}
