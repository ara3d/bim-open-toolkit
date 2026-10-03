using BimOpenFlow.Host;
using BimOpenToolkit.TestSupport;
using BimOpenFlow.Studio;

namespace BimOpenFlow.NrcWorkflows.Tests;

/// <summary>Where the NRC sample data and graphs live in this checkout, named through the
/// same SampleSeeding helpers the host uses.</summary>
public static class NrcPaths
{
    public static string Root => RepoPaths.Root;

    /// <summary>samples/nrc: the CSVs, duplex-base.ifc, and duplex-enriched.ifc; source name "nrc".</summary>
    public static string SamplesDir => NrcSamples.Dir(Root);

    /// <summary>samples/nrc-analyses: one graph document per analysis id.</summary>
    public static string AnalysesDir => NrcSamples.Analyses(Root).AnalysesDir;

    public static string Ifc => Path.Combine(SamplesDir, NrcSamples.IfcFileName);

    /// <summary>The unenriched Duplex, the file nrc-enrich-run writes into.</summary>
    public static string BaseIfc => Path.Combine(SamplesDir, NrcSamples.BaseIfcFileName);

    public static string Graph(string id) => Path.Combine(AnalysesDir, id + ".json");
}
