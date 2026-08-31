using Ara3D.DataFlowEngine;
using Ara3D.NodeGraph;

namespace Ara3D.DataFlowEngine.Runs.Tests;

[TestFixture]
public class ReplayTests
{
    private static readonly DateTimeOffset Timestamp = new(2026, 8, 31, 0, 0, 0, TimeSpan.Zero);
    private static readonly IReadOnlyList<RunInput> NoInputs = Array.Empty<RunInput>();

    private static RunRecord Freeze(GraphDocument doc, IReadOnlyList<RunInput>? inputs = null)
        => RunRecorder.Freeze(doc.Evaluate(TestGraphs.Registry), TestGraphs.Registry,
            inputs ?? NoInputs, "engine", Timestamp);

    [Test]
    public void UnchangedGraph_ReplaysOk()
    {
        var doc = TestGraphs.AddGraph();
        var result = RunReplay.Replay(Freeze(doc), doc, TestGraphs.Registry, NoInputs);
        Assert.That(result, Is.EqualTo(ReplayResult.Success));
    }

    [Test]
    public void EditedValues_GraphMismatch()
    {
        var record = Freeze(TestGraphs.AddGraph());
        var edited = TestGraphs.AddGraph(a: "6");
        var result = RunReplay.Replay(record, edited, TestGraphs.Registry, NoInputs);
        Assert.That(result.Outcome, Is.EqualTo(ReplayOutcome.GraphMismatch));
    }

    [Test]
    public void ChangedInputHash_InputMismatch()
    {
        var doc = TestGraphs.AddGraph();
        var record = Freeze(doc, new[] { new RunInput("a", "path", new string('a', 64)) });
        var result = RunReplay.Replay(record, doc, TestGraphs.Registry,
            new[] { new RunInput("a", "path", new string('b', 64)) });
        Assert.Multiple(() =>
        {
            Assert.That(result.Outcome, Is.EqualTo(ReplayOutcome.InputMismatch));
            Assert.That(result.Node, Is.EqualTo("a"));
            Assert.That(result.Param, Is.EqualTo("path"));
        });
    }

    [Test]
    public void MissingProvidedInput_InputMismatch()
    {
        var doc = TestGraphs.AddGraph();
        var record = Freeze(doc, new[] { new RunInput("a", "path", new string('a', 64)) });
        var result = RunReplay.Replay(record, doc, TestGraphs.Registry, NoInputs);
        Assert.That(result.Outcome, Is.EqualTo(ReplayOutcome.InputMismatch));
    }

    [Test]
    public void TamperedOutputHash_OutputMismatch()
    {
        var doc = TestGraphs.AddGraph();
        var record = Freeze(doc);
        var tampered = record with
        {
            NodeOutputs = new Dictionary<string, string>(record.NodeOutputs) { ["sum.out"] = new string('d', 64) },
        };
        var result = RunReplay.Replay(tampered, doc, TestGraphs.Registry, NoInputs);
        Assert.Multiple(() =>
        {
            Assert.That(result.Outcome, Is.EqualTo(ReplayOutcome.OutputMismatch));
            Assert.That(result.Node, Is.EqualTo("sum"));
            Assert.That(result.Port, Is.EqualTo("sum.out"));
        });
    }

    [Test]
    public void MissingRecordedOutput_ReportsFirstDivergenceInDependencyOrder()
    {
        var doc = TestGraphs.AddGraph();
        var record = Freeze(doc);
        var tampered = record with { NodeOutputs = new Dictionary<string, string>() };
        var result = RunReplay.Replay(tampered, doc, TestGraphs.Registry, NoInputs);
        Assert.Multiple(() =>
        {
            Assert.That(result.Outcome, Is.EqualTo(ReplayOutcome.OutputMismatch));
            Assert.That(result.Node, Is.EqualTo("a"), "first divergence: topological order, ties by id");
        });
    }
}
