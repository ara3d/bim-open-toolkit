using BimOpenFlow.Host;
using BimOpenToolkit.TestSupport;

namespace BimOpenFlow.NrcWorkflows.Tests;

/// <summary>Where the NRC sample data and graphs live in this checkout, named through the
/// same SampleSeeding helpers the host uses.</summary>
public static class NrcPaths
{
    public static string Root => RepoPaths.Root;

    /// <summary>samples/nrc: the CSVs and duplex-enriched.ifc; source name "nrc".</summary>
    public static string SamplesDir => SampleSeeding.NrcSamplesDir(Root);

    /// <summary>samples/nrc-analyses: one graph document per analysis id.</summary>
    public static string AnalysesDir => SampleSeeding.NrcAnalyses(Root).AnalysesDir;

    public static string Ifc => Path.Combine(SamplesDir, "duplex-enriched.ifc");

    public static string Graph(string id) => Path.Combine(AnalysesDir, id + ".json");
}
