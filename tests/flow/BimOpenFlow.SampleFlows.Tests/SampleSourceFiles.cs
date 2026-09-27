using BimOpenToolkit.TestSupport;

namespace BimOpenFlow.SampleFlows.Tests;

/// <summary>
/// Finds a sample analysis's original committed file, placeholders intact, among the seven
/// directories SampleSeeding and BimSampleSeeding seed from. Used only for golden text: the
/// stored, path-rewritten copy (AnalysisStore.Load) is what gets evaluated, but GraphText.Print
/// wants the placeholder-bearing document so the golden file names no machine path.
/// </summary>
public static class SampleSourceFiles
{
    private static readonly string[] DirNames =
    [
        "analyses", "relations", "nrc-analyses", "showcase-analyses",
        "bim-analyses", "view3d-analyses", "snowdon-analyses",
    ];

    /// <summary>The original document for this analysis id, or null when no committed sample
    /// directory holds a file of that name (should not happen for a seeded id).</summary>
    public static GraphDocument? Load(string id)
    {
        var path = DirNames
            .Select(dir => Path.Combine(RepoPaths.Samples(dir), id + ".json"))
            .FirstOrDefault(File.Exists);
        return path is null ? null : GraphDocumentIO.Load(path);
    }
}
