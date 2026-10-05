using System.Runtime.CompilerServices;

namespace BimOpenToolkit.TestSupport;

/// <summary>Absolute paths inside this checkout, found from this source file's compile-time
/// location rather than the test binary's, so a build with an out-of-tree --artifacts-path
/// still resolves them. Every path is computed, never created.</summary>
public static class RepoPaths
{
    public const string SolutionFileName = "BimOpenToolkit.sln";

    /// <summary>The checkout root: the folder holding BimOpenToolkit.sln, two levels above this file.</summary>
    public static string Root { get; } = FindRoot();

    /// <summary>samples/&lt;parts&gt;: committed sample data and graphs.</summary>
    public static string Samples(params string[] parts)
        => Under("samples", parts);

    /// <summary>data/&lt;parts&gt;: fetched model fixtures (data/get-test-data.ps1), never committed.</summary>
    public static string Data(params string[] parts)
        => Under("data", parts);

    /// <summary>artifacts/&lt;parts&gt;: gitignored build and test output.</summary>
    public static string Artifacts(params string[] parts)
        => Under("artifacts", parts);

    /// <summary>&lt;deps root&gt;/&lt;parts&gt;: a fetched dependency checkout (deps.json, filled by
    /// `node deps.mjs`), following deps.mjs's rule: the checkout's siblings when its parent
    /// folder carries a .deps-root marker, else deps/ under the root.</summary>
    public static string Deps(params string[] parts)
        => Path.Combine([DepsRoot, .. parts]);

    /// <summary>bim-open-data's openly licensed sample buildings, converted to DuckDB
    /// (samples/public there; each file's counts are in its samples.json).</summary>
    public static string PublicDuckDb(string building)
        => Deps("bim-open-data", "samples", "public", building + ".duckdb");

    private static string DepsRoot
        => File.Exists(Path.Combine(Root, "..", ".deps-root"))
            ? Path.GetFullPath(Path.Combine(Root, ".."))
            : Path.Combine(Root, "deps");

    private static string Under(string top, string[] parts)
        => Path.Combine([Root, top, .. parts]);

    private static string FindRoot([CallerFilePath] string thisFile = "")
    {
        var root = Path.GetFullPath(Path.Combine(Path.GetDirectoryName(thisFile)!, "..", ".."));
        return File.Exists(Path.Combine(root, SolutionFileName))
            ? root
            : throw new InvalidOperationException($"{SolutionFileName} not found at {root}, two levels above {thisFile}");
    }
}
