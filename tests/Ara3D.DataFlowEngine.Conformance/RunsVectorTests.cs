using System.Text.Json;
using Ara3D.DataFlowEngine.TestKit;
using Ara3D.NodeGraph;

namespace Ara3D.DataFlowEngine.Conformance;

/// <summary>
/// spec/dataflow-graph/runs/conformance. The run-record implementation
/// (Ara3D.DataFlowEngine.Runs) is being built on a parallel track, so record
/// creation and replay steps are ignored here — but everything the canonical
/// engine can already compute (graph hash, node output value hashes, recorded
/// output values) is verified against the frozen expectations first.
/// </summary>
[TestFixture]
public class RunsVectorTests
{
    public static IEnumerable<TestCaseData> Vectors()
        => SpecVectors.Cases("runs");

    [TestCaseSource(nameof(Vectors))]
    public void Vector(string file)
    {
        var root = SpecVectors.Root(file);
        var input = root.GetProperty("input");
        if (!input.TryGetProperty("document", out var document))
            Assert.Ignore("No document to evaluate; record/replay steps pending Ara3D.DataFlowEngine.Runs");

        var doc = GraphDocumentIO.Parse(document.GetRawText());
        Assert.That(doc.Validate(TestNodes.Registry), Is.Empty);

        var session = new FlowTestSession();
        session.Evaluate(doc);

        var record = root.GetProperty("expect").GetProperty("record");
        SpecVectors.AssertFrozen(file, "record.graphHash",
            record.GetProperty("graphHash").GetString()!, doc.ComputeGraphHash());

        foreach (var output in record.GetProperty("nodeOutputs").EnumerateObject())
            SpecVectors.AssertFrozen(file, $"record.nodeOutputs['{output.Name}']",
                output.Value.GetString()!, ValueHash.Compute(session.Output(output.Name)));

        foreach (var recorded in record.GetProperty("recordedOutputs").EnumerateObject())
            Assert.That(ValueHash.Compute(session.Output(recorded.Name)),
                Is.EqualTo(ValueHash.Compute(SpecVectors.ReadFlowValue(recorded.Value))),
                $"recordedOutputs['{recorded.Name}']");

        Assert.Ignore("Hashes verified against the engine; record creation and replay pending Ara3D.DataFlowEngine.Runs");
    }
}
