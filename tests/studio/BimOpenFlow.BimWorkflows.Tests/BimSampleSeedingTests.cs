using System.Text.RegularExpressions;
using BimOpenFlow.Host;
using BimOpenFlow.Host.Store;
using BimOpenToolkit.TestSupport;
using BimOpenFlow.Studio;

namespace BimOpenFlow.BimWorkflows.Tests;

/// <summary>Bim-profile seeding: an empty store gets the bim-analyses samples
/// ({SAMPLES} rewritten), the view3d-analyses samples ({DATA} rewritten to the repo
/// data directory), the nrc-analyses samples (named sources), and the snowdon-analyses
/// samples only when the local-only Snowdon model exists; a non-empty store is untouched.</summary>
[TestFixture]
public sealed class BimSampleSeedingTests
{
    private string _storeDir = null!;

    [SetUp]
    public void NewStoreDir()
    {
        _storeDir = Path.Combine(Path.GetTempPath(), "bimopenflow-bim-seeding-tests", Guid.NewGuid().ToString("N"));
    }

    [TearDown]
    public void DeleteStoreDir()
    {
        try
        {
            Directory.Delete(_storeDir, recursive: true);
        }
        catch (IOException)
        {
        }
    }

    private static IReadOnlyList<string> ExpectedIds(string analysesDirName)
        => Directory.EnumerateFiles(RepoPaths.Samples(analysesDirName), "*.json")
            .Select(Path.GetFileNameWithoutExtension)
            .Order(StringComparer.Ordinal)
            .ToList()!;

    /// <summary>Seed order follows the source order in BimSampleSeeding.Seed.</summary>
    private static IEnumerable<string> ExpectedSeedIds()
        => ExpectedIds("bim-analyses")
            .Concat(ExpectedIds("view3d-analyses"))
            .Concat(ExpectedIds("nrc-analyses"))
            .Concat(ExpectedIds("showcase-analyses"))
            .Concat(ExpectedIds("showcase-tables"))
            .Concat(BimSampleSeeding.SnowdonPath() is null ? [] : ExpectedIds("snowdon-analyses").Where(id => !HoldsOtherPlaceholder("snowdon-analyses", id, "{SNOWDON}")));

    /// <summary>True when a sample still holds a placeholder its source does not fill, such as
    /// federation-match's {FEDERATION_*} parameters; seeding skips and logs such a sample (TKT-83).</summary>
    private static bool HoldsOtherPlaceholder(string analysesDirName, string id, string filled)
        => Regex.IsMatch(File.ReadAllText(RepoPaths.Samples(analysesDirName, id + ".json")).Replace(filled, ""), @"\{[A-Z_]+\}");

    [Test]
    public void EmptyStore_SeedsEverySampleSource()
    {
        var store = new AnalysisStore(_storeDir);
        var seeded = BimSampleSeeding.Seed(store, AppContext.BaseDirectory);
        Assert.That(seeded, Is.EqualTo(ExpectedSeedIds()));
    }

    [Test]
    public void Seeding_RewritesBothPlaceholders()
    {
        var store = new AnalysisStore(_storeDir);
        foreach (var id in BimSampleSeeding.Seed(store, AppContext.BaseDirectory))
        {
            var values = store.Load(id).Values.SelectMany(n => n.Value.Values).ToList();
            Assert.That(values, Has.None.Contains(SampleSeeding.PathPlaceholder));
            Assert.That(values, Has.None.Contains(BimSampleSeeding.DataPlaceholder));
        }
    }

    [Test]
    public void StoreHoldingNoneOfTheSamples_IsUntouched()
    {
        var store = new AnalysisStore(_storeDir);
        store.Create("existing");
        Assert.That(BimSampleSeeding.Seed(store, AppContext.BaseDirectory), Is.Empty);
        Assert.That(store.List().Select(e => e.Id), Is.EqualTo(new[] { "existing" }));
    }
}
