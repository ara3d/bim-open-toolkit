using Ara3D.Ifc.DuckDb;
using Ara3D.Utils;
using BimOpenFlow.Host;

namespace BimOpenFlow.NrcWorkflows.Tests;

/// <summary>Builds duplex-enriched.duckdb from the committed IFC into a temp folder once per
/// test run, and hands out a registry whose sources are "nrc" (samples/nrc) and
/// "duplex-enriched" (the built database), the same names the host registers.
/// Contract C6 of the nrc-handoff wave; the body belongs to track A.</summary>
[SetUpFixture]
public sealed class Fixture
{
    public static string DatabaseDir { get; private set; } = "";

    public static string Database => Path.Combine(DatabaseDir, "duplex-enriched.duckdb");

    /// <summary>The roots every graph test registers: samples/nrc and the built database's folder.</summary>
    public static IReadOnlyList<string> Roots => [NrcPaths.SamplesDir, DatabaseDir];

    public static RelationRuntime Runtime => RelationRuntime.FromRoots(Roots);

    /// <summary>The bim-profile registry over the given sources, so every sample graph can evaluate.</summary>
    public static NodeRegistry Registry(RelationRuntime runtime)
        => HostComposition.AllPacks(runtime);

    [OneTimeSetUp]
    public void BuildDatabase()
    {
        DatabaseDir = Path.Combine(Path.GetTempPath(), "bimopenflow-nrc-tests", Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(DatabaseDir);
        IfcDuckDbBuild.Build(new FilePath(NrcPaths.Ifc), new FilePath(Database));
    }

    [OneTimeTearDown]
    public void DeleteDatabase()
    {
        try { Directory.Delete(DatabaseDir, recursive: true); }
        catch (IOException) { }
    }
}
