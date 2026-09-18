using BimOpenToolkit.TestSupport;

namespace Ara3D.Ifc.Tests;

public static class TestData
{
    /// <summary>Repo-root data/ folder, populated by data/get-test-data.ps1 (never committed).</summary>
    public static string Folder => RepoPaths.Data();
    public static string DuplexIfc => Path.Combine(Folder, "duplex.ifc");
    public static string AnalyticsCsvPath => Path.Combine(Folder, "analytics_dataset_with_levels.csv");

    /// <summary>
    /// Repo-relative artifacts folder, so generated IFC files survive a rebuild of bin/. Nested
    /// under the project name because artifacts/ is also the NuGet package output path.
    /// </summary>
    public static string OutputFolder
    {
        get
        {
            var r = RepoPaths.Artifacts("Ara3D.Ifc.Tests");
            Directory.CreateDirectory(r);
            return r;
        }
    }

    public static void RequireTestKit()
    {
        if (!File.Exists(DuplexIfc) || !File.Exists(AnalyticsCsvPath))
            Assert.Ignore($"Test kit not found at {Folder}");
    }
}
