using BimOpenFlow.GraphText;
using BimOpenFlow.Host;
using BimOpenToolkit.TestSupport;
using GraphTextPrinter = BimOpenFlow.GraphText.GraphText;

namespace BimOpenFlow.SampleFlows.Tests;

/// <summary>
/// Each sample flow's graph text (TKT-57's format, over this flow's own evaluation) is
/// compared with a committed golden file at golden/&lt;profile&gt;/&lt;id&gt;.txt. The
/// document is printed as loaded from disk, placeholders intact ({SAMPLES}, {NRC}, ...), so
/// the golden file never carries a machine path; the evaluation comes from the seeded,
/// path-rewritten copy, matched back to the original document by node id (GraphText.Print's
/// documented contract).
///
/// Re-approve after an intentional change: set SAMPLE_FLOWS_APPROVE=1 and run this project's
/// tests once; every case rewrites its golden file and passes. Review the diff before
/// committing, the same as any other generated file.
/// </summary>
[TestFixture]
public sealed class GoldenTests
{
    private const string ApproveEnvVar = "SAMPLE_FLOWS_APPROVE";

    public static IEnumerable<TestCaseData> Cases
        => SampleFlowsFixture.Cases.Select(c => new TestCaseData(c.Profile, c.Id).SetArgDisplayNames($"{c.Profile}/{c.Id}"));

    [TestCaseSource(nameof(Cases))]
    public void MatchesGoldenFile(string profile, string id)
    {
        var data = SampleFlowsFixture.Profile(profile);
        var snapshot = SampleFlowsFixture.Snapshot(profile, id);
        var original = SampleSourceFiles.Load(id) ?? snapshot.Document;
        // No IRelationReader: a relation prints its plan text and plan hash only, never a
        // materialized content hash. samples/nrc's duckdb-backed relations (nrc-rollup,
        // nrc-enrich-run) returned a different content hash across two otherwise identical
        // evaluations in this project's own runs -- row order from an unordered DuckDB query
        // is not guaranteed stable, so a materialized golden here would be flaky through no
        // fault of the graph. See docs/sample-flows-test.md.
        var options = new GraphTextOptions
        {
            AnalysisId = id,
            PathAliases = ModelRoots(profile).Select(r => new PathAlias(r, "{MODELS}")).ToList(),
        };
        var text = GraphTextPrinter.Print(original, snapshot, data.Registry, options);
        var goldenPath = GoldenPath(profile, id);

        if (Environment.GetEnvironmentVariable(ApproveEnvVar) == "1")
        {
            Directory.CreateDirectory(Path.GetDirectoryName(goldenPath)!);
            File.WriteAllText(goldenPath, text);
            Assert.Pass($"approved {goldenPath}");
        }

        if (!File.Exists(goldenPath))
            Assert.Fail($"No golden file at {goldenPath}. Set {ApproveEnvVar}=1 and rerun to create it.");
        var expected = File.ReadAllText(goldenPath);
        Assert.That(text, Is.EqualTo(expected),
            $"{profile}/{id} graph text differs from {goldenPath}. If the change is intended, " +
            $"set {ApproveEnvVar}=1 and rerun to re-approve.");
    }

    private static string GoldenPath(string profile, string id)
        => Path.Combine(RepoPaths.Root, "tests", "flow", "BimOpenFlow.SampleFlows.Tests", "golden", profile, id + ".txt");

    private static IReadOnlyList<string> ModelRoots(string profile)
        => profile == SampleFlowsFixture.TablesProfile
            ? SampleSeeding.SeededModelRoots(RepoPaths.Root)
            : BimSampleSeeding.SeededModelRoots(RepoPaths.Root);
}
