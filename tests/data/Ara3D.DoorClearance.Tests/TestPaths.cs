using BimOpenToolkit.TestSupport;

namespace Ara3D.DoorClearance.Tests;

public static class TestPaths
{
    /// <summary>Repo-root data/ folder, populated by data/get-test-data.ps1 (never committed).</summary>
    public static string TestKitFolder => RepoPaths.Data();
    public static string DuplexIfc => Path.Combine(TestKitFolder, "duplex.ifc");

    public static string RulesJson
        => Path.Combine(TestContext.CurrentContext.TestDirectory, "rules", "door-clearance-rules.json");

    /// <summary>
    /// Repo-relative artifacts folder, so generated files survive a rebuild of bin/. Nested under
    /// the project name because artifacts/ is also the NuGet package output path.
    /// </summary>
    public static string OutputFolder
    {
        get
        {
            var r = RepoPaths.Artifacts("Ara3D.DoorClearance.Tests");
            Directory.CreateDirectory(r);
            return r;
        }
    }

    public static void RequireTestKit()
    {
        if (!File.Exists(DuplexIfc))
            Assert.Ignore($"Test kit not found at {TestKitFolder}");
    }
}
