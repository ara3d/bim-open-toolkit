using System.Text.Json;
using Ara3D.DataFlowEngine.TestKit;
using Ara3D.NodeGraph;

namespace Ara3D.DataFlowEngine.Conformance;

/// <summary>
/// Runs spec/dataflow-graph/format/conformance: document validity, invalid
/// reasons, graph hash pinning, and layout/session-stripped hash equivalence.
/// </summary>
[TestFixture]
public class FormatVectorTests
{
    public static IEnumerable<TestCaseData> Vectors()
        => SpecVectors.Cases("format");

    [TestCaseSource(nameof(Vectors))]
    public void Vector(string file)
    {
        var root = SpecVectors.Root(file);
        var documentJson = root.GetProperty("input").GetProperty("document").GetRawText();
        var expect = root.GetProperty("expect");

        if (expect.GetProperty("valid").GetBoolean())
            AssertValid(file, documentJson, root, expect);
        else
            AssertInvalid(documentJson, expect.GetProperty("reason").GetString()!);
    }

    private static void AssertValid(string file, string documentJson, JsonElement root, JsonElement expect)
    {
        var doc = GraphDocumentIO.Parse(documentJson);
        Assert.That(doc.Validate(TestNodes.Registry), Is.Empty, "expected a valid document");

        var hash = doc.ComputeGraphHash();
        if (expect.TryGetProperty("equalGraphHash", out var equal) && equal.GetBoolean())
        {
            var stripped = GraphDocumentIO.Parse(
                root.GetProperty("input").GetProperty("strippedDocument").GetRawText());
            Assert.That(stripped.ComputeGraphHash(), Is.EqualTo(hash),
                "stripping layout/session must not change the graph hash");
        }
        if (expect.TryGetProperty("graphHash", out var expected))
            SpecVectors.AssertFrozen(file, "graphHash", expected.GetString()!, hash);
    }

    private static void AssertInvalid(string documentJson, string reason)
    {
        // unknown-layer and bad-node-id are parse-level; the rest are validation errors.
        GraphDocument doc;
        try
        {
            doc = GraphDocumentIO.Parse(documentJson);
        }
        catch (Exception e) when (e is FormatException or ArgumentException)
        {
            Assert.That(reason, Is.AnyOf("unknown-layer", "bad-node-id"),
                $"parse rejected the document ({e.Message}) but the vector expects reason '{reason}'");
            return;
        }

        var errors = doc.Validate(TestNodes.Registry);
        Assert.That(errors, Is.Not.Empty, $"expected an invalid document (reason '{reason}')");
        Assert.That(errors.Select(e => e.Kind), Does.Contain(ExpectedErrorKind(reason)),
            $"reason '{reason}'; got: {string.Join("; ", errors.Select(e => e.Message))}");
    }

    private static GraphErrorKind ExpectedErrorKind(string reason)
        => reason switch
        {
            "duplicate-node-id" => GraphErrorKind.DuplicateNodeId,
            "dangling-edge" => GraphErrorKind.DanglingEdgeEndpoint,
            "cycle" => GraphErrorKind.Cycle,
            "duplicate-input-edge" => GraphErrorKind.MultipleEdgesIntoPort,
            _ => throw new InvalidOperationException($"Unknown invalid-reason '{reason}' — extend the runner"),
        };
}
