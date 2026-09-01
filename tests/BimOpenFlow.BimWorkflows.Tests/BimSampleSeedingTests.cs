using BimOpenFlow.Host;
using BimOpenFlow.Host.Store;

namespace BimOpenFlow.BimWorkflows.Tests;

/// <summary>Bim-profile seeding: an empty store gets both the bim-analyses
/// samples ({SAMPLES} rewritten) and the view3d-analyses samples ({DATA}
/// rewritten to the repo data directory); a non-empty store is untouched.</summary>
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

    private static string Root
        => SampleSeeding.FindRepoRoot(AppContext.BaseDirectory)
            ?? throw new InvalidOperationException("repo root not found");

    private static IReadOnlyList<string> ExpectedIds(string analysesDirName)
        => Directory.EnumerateFiles(Path.Combine(Root, "samples", analysesDirName), "*.json")
            .Select(Path.GetFileNameWithoutExtension)
            .Order(StringComparer.Ordinal)
            .ToList()!;

    [Test]
    public void EmptyStore_SeedsBimAndView3dSamples()
    {
        var store = new AnalysisStore(_storeDir);
        var seeded = BimSampleSeeding.SeedIfEmpty(store, AppContext.BaseDirectory);
        Assert.That(seeded, Is.EqualTo(ExpectedIds("bim-analyses").Concat(ExpectedIds("view3d-analyses"))));
    }

    [Test]
    public void Seeding_RewritesBothPlaceholders()
    {
        var store = new AnalysisStore(_storeDir);
        foreach (var id in BimSampleSeeding.SeedIfEmpty(store, AppContext.BaseDirectory))
        {
            var values = store.Load(id).Values.SelectMany(n => n.Value.Values).ToList();
            Assert.That(values, Has.None.Contains(SampleSeeding.PathPlaceholder));
            Assert.That(values, Has.None.Contains(BimSampleSeeding.DataPlaceholder));
        }
    }

    [Test]
    public void NonEmptyStore_IsUntouched()
    {
        var store = new AnalysisStore(_storeDir);
        store.Create("existing");
        Assert.That(BimSampleSeeding.SeedIfEmpty(store, AppContext.BaseDirectory), Is.Empty);
        Assert.That(store.List().Select(e => e.Id), Is.EqualTo(new[] { "existing" }));
    }
}
