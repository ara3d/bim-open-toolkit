using System.Runtime.CompilerServices;
using BimOpenFlow.Host;

namespace BimOpenFlow.NrcWorkflows.Tests;

/// <summary>Where the NRC sample data and graphs live in this checkout. The root is found
/// from this source file's location, not the test binary's, so builds that put output
/// outside the checkout (a private --artifacts-path) still resolve it.</summary>
public static class NrcPaths
{
    public static string Root { get; } = SampleSeeding.FindRepoRoot(Path.GetDirectoryName(SourceFile())!)
        ?? throw new InvalidOperationException("BimOpenToolkit.sln not found above " + SourceFile());

    private static string SourceFile([CallerFilePath] string path = "") => path;

    /// <summary>samples/nrc: the CSVs and duplex-enriched.ifc; source name "nrc".</summary>
    public static string SamplesDir => SampleSeeding.NrcSamplesDir(Root);

    /// <summary>samples/nrc-analyses: one graph document per analysis id.</summary>
    public static string AnalysesDir => SampleSeeding.NrcAnalyses(Root).AnalysesDir;

    public static string Ifc => Path.Combine(SamplesDir, "duplex-enriched.ifc");

    public static string Graph(string id) => Path.Combine(AnalysesDir, id + ".json");
}
