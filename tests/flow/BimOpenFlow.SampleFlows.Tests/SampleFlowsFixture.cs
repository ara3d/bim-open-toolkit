using System.Collections.Concurrent;
using BimOpenFlow.Host;
using BimOpenFlow.Host.Store;
using BimOpenFlow.Nodes.Relations;
using BimOpenToolkit.TestSupport;

namespace BimOpenFlow.SampleFlows.Tests;

/// <summary>
/// One place that seeds and evaluates every committed sample analysis into both host
/// profiles, through the same HostComposition registries and SampleSeeding /
/// BimSampleSeeding helpers HostRunner calls at start-up (TKT-85): a graph a profile
/// cannot validate is skipped here exactly as it would be by the host, never reported
/// as a failure.
///
/// Every sample flow evaluates in parallel, one fresh EvalSession per (profile, id), the
/// way many open analyses evaluate concurrently in the host: a flow review had found a
/// bfast file-lock bug that only showed under that concurrency, so a sequential test
/// suite would have missed it.
/// </summary>
public static class SampleFlowsFixture
{
    public const string TablesProfile = HostConfig.TablesProfile;
    public const string BimProfile = HostConfig.BimProfile;

    public static readonly IReadOnlyList<string> Profiles = [TablesProfile, BimProfile];

    public sealed record ProfileData(
        string Profile,
        NodeRegistry Registry,
        RelationRuntime Runtime,
        AnalysisStore Store,
        IReadOnlyList<string> SeededIds,
        string SeedLog,
        string StoreDir);

    private static readonly string Root = RepoPaths.Root;

    private static readonly Lazy<IReadOnlyDictionary<string, ProfileData>> Data =
        new(() => Profiles.ToDictionary(p => p, Seed));

    private static readonly Lazy<IReadOnlyDictionary<(string Profile, string Id), EvalSnapshot>> Snapshots =
        new(EvaluateAll);

    public static ProfileData Profile(string profile)
        => Data.Value[profile];

    public static EvalSnapshot Snapshot(string profile, string id)
        => Snapshots.Value[(profile, id)];

    /// <summary>Every (profile, id) pair a profile actually seeded, in the order SeedIfEmpty
    /// returned it, for TestCaseSource properties.</summary>
    public static IEnumerable<(string Profile, string Id)> Cases
        => Data.Value.Values.SelectMany(d => d.SeededIds.Select(id => (d.Profile, id)));

    private static ProfileData Seed(string profile)
    {
        var roots = profile == TablesProfile
            ? SampleSeeding.SeededModelRoots(Root)
            : BimSampleSeeding.SeededModelRoots(Root);
        var runtime = RelationRuntime.FromRoots(roots);
        var registry = HostComposition.Registry(profile, runtime);
        var storeDir = Path.Combine(Path.GetTempPath(), "bof-sample-flows-tests", profile,
            Guid.NewGuid().ToString("N"));
        var store = new AnalysisStore(storeDir);
        var log = new StringWriter();
        var seeded = profile == TablesProfile
            ? SampleSeeding.SeedIfEmpty(store, Root, registry, log)
            : BimSampleSeeding.SeedIfEmpty(store, Root, registry, log);
        return new(profile, registry, runtime, store, seeded, log.ToString(), storeDir);
    }

    private static IReadOnlyDictionary<(string, string), EvalSnapshot> EvaluateAll()
    {
        var results = new ConcurrentDictionary<(string, string), EvalSnapshot>();
        var tasks = Data.Value.Values.SelectMany(d => d.SeededIds.Select(id => Task.Run(() =>
        {
            var doc = d.Store.Load(id);
            results[(d.Profile, id)] = doc.Evaluate(d.Registry);
        }))).ToArray();
        Task.WaitAll(tasks);
        return results;
    }

    /// <summary>Deletes every temp store this fixture created. Safe to call whether or not
    /// seeding ever ran (a test run that filters every case out never touches disk).</summary>
    public static void DeleteTempStores()
    {
        if (!Data.IsValueCreated)
            return;
        foreach (var data in Data.Value.Values)
        {
            try
            {
                Directory.Delete(data.StoreDir, recursive: true);
            }
            catch (IOException)
            {
            }
        }
    }
}

/// <summary>Runs once after every test in the assembly, to clean up the fixture's temp
/// stores regardless of which tests ran.</summary>
[SetUpFixture]
public sealed class SampleFlowsAssemblyTeardown
{
    [OneTimeTearDown]
    public void Cleanup()
        => SampleFlowsFixture.DeleteTempStores();
}
