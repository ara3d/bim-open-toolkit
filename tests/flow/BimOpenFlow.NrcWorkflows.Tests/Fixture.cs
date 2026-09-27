using Ara3D.Ifc.DuckDb;
using Ara3D.Utils;
using BimOpenFlow.Host;

namespace BimOpenFlow.NrcWorkflows.Tests;

/// <summary>Builds duplex-enriched.duckdb and duplex-base.duckdb from the committed IFC files
/// into a temp folder, once per test run and only when a test first asks for the runtime, so a
/// CSV-only filter never pays the IFC conversion. Hands out a registry whose sources are "nrc"
/// (samples/nrc), "duplex-enriched", and "duplex-base" (the built databases), the same names the
/// host registers.</summary>
[SetUpFixture]
public sealed class Fixture
{
    private static readonly string Dir =
        Path.Combine(Path.GetTempPath(), "bimopenflow-nrc-tests", Guid.NewGuid().ToString("N"));

    private static readonly Lazy<string> Built = new(() =>
    {
        Directory.CreateDirectory(Dir);
        var database = Path.Combine(Dir, SampleSeeding.NrcDatabaseFileName);
        IfcDuckDbBuild.Build(new FilePath(NrcPaths.Ifc), new FilePath(database));
        IfcDuckDbBuild.Build(new FilePath(NrcPaths.BaseIfc),
            new FilePath(Path.Combine(Dir, SampleSeeding.NrcBaseDatabaseFileName)));
        return database;
    });

    /// <summary>The built duplex-enriched database's path; building both databases on first use.</summary>
    public static string Database => Built.Value;

    public static string DatabaseDir => Path.GetDirectoryName(Database)!;

    /// <summary>The roots every model graph test registers: samples/nrc and the built databases' folder,
    /// which comes later so its fresh databases win over any stale copy in samples/nrc.</summary>
    public static IReadOnlyList<string> Roots => [NrcPaths.SamplesDir, DatabaseDir];

    public static RelationRuntime Runtime => RelationRuntime.FromRoots(Roots);

    /// <summary>The bim-profile registry over the given sources, so every sample graph can evaluate.</summary>
    public static NodeRegistry Registry(RelationRuntime runtime)
        => HostComposition.AllPacks(runtime);

    [OneTimeTearDown]
    public void DeleteDatabase()
    {
        if (!Built.IsValueCreated)
            return;
        try { Directory.Delete(Dir, recursive: true); }
        catch (IOException) { }
    }
}
