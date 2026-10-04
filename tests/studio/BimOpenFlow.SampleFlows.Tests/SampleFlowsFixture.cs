using System.Collections.Concurrent;
using BimOpenFlow.Host;
using BimOpenFlow.Host.Store;
using BimOpenFlow.Nodes.Relations;
using BimOpenToolkit.TestSupport;
using BimOpenFlow.Studio;

namespace BimOpenFlow.SampleFlows.Tests;

/// <summary>
/// One place that seeds and evaluates every committed sample analysis into both host
/// studio profiles, through the same StudioComposition profiles (registry, model roots,
/// seeding) HostRunner uses at start-up (TKT-85): a graph a profile
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
    public const string BimProfile = StudioComposition.BimProfile;

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

    /// <summary>Builds every profile's generated sample files (the NRC DuckDBs and BOS file in
    /// samples/nrc, git-ignored) before any profile seeds, as the host does after its port opens.
    /// Without this, a fresh clone has no duplex-base source and its graphs fail; a checkout where
    /// the host has already run would hide that. Jobs whose output is current are skipped, and a
    /// job that fails throws here rather than surfacing later as an unknown source.</summary>
    private static readonly Lazy<IReadOnlyDictionary<string, ProfileData>> Data =
        new(() =>
        {
            Prepare();
            return Profiles.ToDictionary(p => p, Seed);
        });

    private static void Prepare()
    {
        var jobs = Profiles
            .SelectMany(p => StudioComposition.Profiles[p].Preparation(Root))
            .DistinctBy(j => j.Output)
            .Where(j => !j.IsCurrent)
            .ToList();
        foreach (var job in jobs)
            job.Run();
    }

    private static readonly Lazy<IReadOnlyDictionary<(string Profile, string Id), EvalSnapshot>> Snapshots =
        new(EvaluateAll);

    public static ProfileData Profile(string profile)
        => Data.Value[profile];

    public static EvalSnapshot Snapshot(string profile, string id)
        => Snapshots.Value[(profile, id)];

    /// <summary>Every (profile, id) pair a profile actually seeded, in the order Seed
    /// returned it, for TestCaseSource properties.</summary>
    public static IEnumerable<(string Profile, string Id)> Cases
        => Data.Value.Values.SelectMany(d => d.SeededIds.Select(id => (d.Profile, id)));

    private static ProfileData Seed(string profile)
    {
        var host = StudioComposition.Profiles[profile];
        var runtime = RelationRuntime.FromRoots(host.SeededModelRoots(Root));
        var registry = host.Packs(runtime);
        var storeDir = Path.Combine(Path.GetTempPath(), "bof-sample-flows-tests", profile,
            Guid.NewGuid().ToString("N"));
        var store = new AnalysisStore(storeDir);
        var log = new StringWriter();
        var seeded = host.Seed(store, Root, registry, log);
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
