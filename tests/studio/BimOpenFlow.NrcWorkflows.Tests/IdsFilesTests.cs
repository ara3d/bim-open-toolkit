using System.Diagnostics;
using BimOpenToolkit.TestSupport;

namespace BimOpenFlow.NrcWorkflows.Tests;

/// <summary>The IDS files under samples/nrc/ids stay what their sources say: the generated one
/// matches what scripts/nrc-ids.mjs makes from nrc-metrics.csv, and each file equals its copy
/// among bim-open-data's Ara3D.Ids test fixtures. Line endings are compared as LF, the way git
/// stores both files, because a checkout may convert them.</summary>
[TestFixture]
public sealed class IdsFilesTests
{
    private static readonly string IdsDir = Path.Combine(NrcPaths.SamplesDir, "ids");

    private static readonly string FixtureDir = RepoPaths.Deps("bim-open-data", "tests", "data", "Ara3D.Ids.Tests", "ids");

    public static IEnumerable<TestCaseData> IdsFiles
        => Directory.EnumerateFiles(IdsDir, "*.ids")
            .Order(StringComparer.Ordinal)
            .Select(f => new TestCaseData(Path.GetFileName(f)).SetArgDisplayNames(Path.GetFileName(f)));

    private static string Lf(string path) => File.ReadAllText(path).ReplaceLineEndings("\n");

    [Test]
    public void TheGeneratedIds_MatchesTheMetricDictionary()
    {
        var script = Path.Combine(NrcPaths.Root, "scripts", "nrc-ids.mjs");
        var output = Path.Combine(Path.GetTempPath(), "bof-ids", Guid.NewGuid().ToString("N") + ".ids");
        Directory.CreateDirectory(Path.GetDirectoryName(output)!);
        try
        {
            var start = new ProcessStartInfo("node") { RedirectStandardOutput = true, RedirectStandardError = true };
            foreach (var arg in new[] { script, "--out", output })
                start.ArgumentList.Add(arg);
            using var node = Process.Start(start) ?? throw new InvalidOperationException("node did not start; it is on PATH wherever deps.mjs ran");
            var stderr = node.StandardError.ReadToEndAsync();
            node.StandardOutput.ReadToEnd();
            node.WaitForExit();
            Assert.That(node.ExitCode, Is.EqualTo(0), stderr.Result);
            Assert.That(Lf(Path.Combine(IdsDir, "nrc-analytics.ids")), Is.EqualTo(Lf(output)),
                "samples/nrc/ids/nrc-analytics.ids is stale; run node scripts/nrc-ids.mjs");
        }
        finally
        {
            File.Delete(output);
        }
    }

    [TestCaseSource(nameof(IdsFiles))]
    public void EachIdsFile_EqualsItsBimOpenDataFixture(string name)
    {
        if (!Directory.Exists(RepoPaths.Deps("bim-open-data")))
            Assert.Ignore("deps/bim-open-data is not fetched; run node deps.mjs");
        var fixture = Path.Combine(FixtureDir, name);
        Assert.That(File.Exists(fixture), $"{fixture} is missing; copy samples/nrc/ids/{name} there");
        Assert.That(Lf(Path.Combine(IdsDir, name)), Is.EqualTo(Lf(fixture)),
            $"samples/nrc/ids/{name} and its bim-open-data copy differ; change both together");
    }
}
