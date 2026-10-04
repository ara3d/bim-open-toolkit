using BimOpenToolkit.TestSupport;
using BimOpenFlow.Host;
using BimOpenFlow.Studio;

namespace BimOpenFlow.SampleFlows.Tests;

/// <summary>
/// Finds a sample analysis's original committed file, placeholders intact, among the
/// directories SampleSeeding and BimSampleSeeding seed from: analyses and relations in
/// bim-open-flow's checkout (SampleSeeding.SamplesRoot), the rest in this one. Used only for golden text: the
/// stored, path-rewritten copy (AnalysisStore.Load) is what gets evaluated, but GraphText.Print
/// wants the placeholder-bearing document so the golden file names no machine path.
/// </summary>
public static class SampleSourceFiles
{
    private static readonly string[] Dirs =
    [
        .. SampleSeeding.TableSources(SampleSeeding.SamplesRoot(RepoPaths.Root) ?? RepoPaths.Root).Select(s => s.AnalysesDir),
        .. new[] { "nrc-analyses", "showcase-analyses", "showcase-tables", "bim-analyses", "view3d-analyses", "snowdon-analyses" }
            .Select(dir => RepoPaths.Samples(dir)),
    ];

    /// <summary>The original document for this analysis id, or null when no committed sample
    /// directory holds a file of that name (should not happen for a seeded id).</summary>
    public static GraphDocument? Load(string id)
    {
        var path = Dirs
            .Select(dir => Path.Combine(dir, id + ".json"))
            .FirstOrDefault(File.Exists);
        return path is null ? null : GraphDocumentIO.Load(path);
    }
}
