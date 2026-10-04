using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.Utils;
using BimOpenFlow.Host;
using BimOpenFlow.Host.Store;
using BimOpenFlow.Nodes.BimAnalysis;

namespace BimOpenFlow.Studio;

/// <summary>
/// Seeds an analysis store with the committed BIM sample analyses:
/// samples/bim-analyses/*.json with {SAMPLES} pointed at samples/bim (the
/// sample.bos there is generated from BimSampleModel when absent — the model
/// binary is never committed), samples/view3d-analyses/*.json with {SAMPLES}
/// pointed at samples/nrc (they load its committed duplex-base.ifc), samples/nrc-analyses/*.json, which name
/// their sources, and samples/showcase-analyses/*.json over samples/nrc, by the rules of
/// SampleSeeding.Seed; graphs the registry cannot validate are skipped and reported.
/// </summary>
public static class BimSampleSeeding
{
    public const string SampleFileName = "sample.bos";

    public static IReadOnlyList<string> Seed(AnalysisStore store, string startDir,
        INodeRegistry? registry = null, TextWriter? log = null)
    {
        if (SampleSeeding.FindRepoRoot(startDir) is not { } root)
            return [];
        var samplesDir = Path.Combine(root, "samples", "bim");
        EnsureSampleModel(samplesDir);
        var sources = new List<(string, string, string)>
        {
            (Path.Combine(root, "samples", "bim-analyses"), SampleSeeding.PathPlaceholder, samplesDir),
            (Path.Combine(root, "samples", "view3d-analyses"), SampleSeeding.PathPlaceholder, NrcSamples.Dir(root)),
            NrcSamples.Analyses(root),
            NrcSamples.Showcase(root),
            NrcSamples.ShowcaseTables(root),
        };
        if (SnowdonPath() is { } snowdon)
            sources.Add((Path.Combine(root, "samples", "snowdon-analyses"), "{SNOWDON}", snowdon));
        return SampleSeeding.Seed(store, sources, registry, log);
    }

    /// <summary>The directories the seeded analyses' model paths point at
    /// (samples/bim and samples/nrc), and the repo data dir that data/get-test-data.ps1
    /// fills with further models, so the host can add them to the
    /// model catalog roots and serve those models' bytes over
    /// /api/models/{id}/bos. Empty outside a repo checkout.</summary>
    public static IReadOnlyList<string> SeededModelRoots(string startDir)
        => SampleSeeding.FindRepoRoot(startDir) is { } root
            ? new[] { Path.Combine(root, "samples", "bim"), Path.Combine(root, "data"), NrcSamples.Dir(root) }
                .Concat(SnowdonPath() is { } snowdon ? [Path.GetDirectoryName(snowdon)!] : Array.Empty<string>()).ToArray()
            : [];

    /// <summary>Local-only sample, optionally configured; model bytes are never distributed.</summary>
    public static string? SnowdonPath()
    {
        var path = Environment.GetEnvironmentVariable("BIMOPENFLOW_SNOWDON")
            ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments),
                "BIM Open Schema", "Snowdon Towers Sample Architectural.bos");
        return File.Exists(path) ? Path.GetFullPath(path) : null;
    }

    public static string EnsureSampleModel(string samplesDir)
    {
        var path = Path.Combine(samplesDir, SampleFileName);
        if (!File.Exists(path))
        {
            Directory.CreateDirectory(samplesDir);
            Ara3D.BimOpenSchema.IO.ParquetUtils.WriteToParquetZip(BimSampleModel.Build(), new FilePath(path));
        }
        return path;
    }
}
