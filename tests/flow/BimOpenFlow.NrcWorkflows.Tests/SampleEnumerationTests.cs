using System.Runtime.CompilerServices;
using System.Text.RegularExpressions;
using BimOpenFlow.Host;

namespace BimOpenFlow.NrcWorkflows.Tests;

/// <summary>Every samples/nrc-analyses/*.json parses, validates against the bim-profile registry
/// (which includes rel.*), and is the subject of a named test in CsvGraphTests or ModelGraphTests,
/// so a graph cannot land in the folder without a test that checks its answer. Coverage is read
/// from those two source files: every "nrc-..." string literal they contain is a graph id.</summary>
[TestFixture]
public sealed class SampleEnumerationTests
{
    private static readonly Regex GraphIdLiteral = new("\"(nrc-[a-z0-9-]+)\"");

    private static readonly IReadOnlyList<string> CoveringTestSources = ["CsvGraphTests.cs", "ModelGraphTests.cs"];

    public static IEnumerable<TestCaseData> SampleFiles
        => Directory.EnumerateFiles(NrcPaths.AnalysesDir, "*.json")
            .Order(StringComparer.Ordinal)
            .Select(f => new TestCaseData(f).SetArgDisplayNames(Path.GetFileNameWithoutExtension(f)));

    /// <summary>The graph ids the named tests reference, read from their source next to this file.</summary>
    public static IReadOnlySet<string> CoveredIds([CallerFilePath] string thisFile = "")
        => CoveringTestSources
            .Select(name => Path.Combine(Path.GetDirectoryName(thisFile)!, name))
            .SelectMany(file => GraphIdLiteral.Matches(File.ReadAllText(file)).Select(m => m.Groups[1].Value))
            .ToHashSet(StringComparer.Ordinal);

    [Test]
    public void ThereAreSampleGraphs()
        => Assert.That(SampleFiles.Count(), Is.GreaterThanOrEqualTo(8));

    [TestCaseSource(nameof(SampleFiles))]
    public void ParsesAndValidates(string file)
    {
        var doc = GraphDocumentIO.Load(file);
        Assert.That(doc.Nodes, Is.Not.Empty);
        Assert.That(doc.FindNode("answer"), Is.Not.Null, "every NRC graph ends in a node named answer");
        Assert.That(doc.Validate(HostComposition.AllPacks()), Is.Empty);
    }

    [TestCaseSource(nameof(SampleFiles))]
    public void IsCoveredByANamedTest(string file)
        => Assert.That(CoveredIds(), Does.Contain(Path.GetFileNameWithoutExtension(file)));

    [Test]
    public void EveryCoveredIdIsASampleFile()
        => Assert.That(CoveredIds(), Is.SubsetOf(SampleFiles.Select(t => Path.GetFileNameWithoutExtension((string)t.Arguments[0]!))));
}
