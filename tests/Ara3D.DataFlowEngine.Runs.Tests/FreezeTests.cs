using Ara3D.DataFlowEngine;
using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.NodeGraph;

namespace Ara3D.DataFlowEngine.Runs.Tests;

[TestFixture]
public class FreezeTests
{
    private static readonly DateTimeOffset Timestamp = new(2026, 8, 31, 14, 3, 22, 117, TimeSpan.Zero);
    private const string Engine = "Ara3D.DataFlowEngine 0.1.0";

    private static RunRecord Freeze(EvalSnapshot snapshot, IReadOnlyList<RunInput>? inputs = null)
        => RunRecorder.Freeze(snapshot, TestGraphs.Registry, inputs ?? Array.Empty<RunInput>(), Engine, Timestamp);

    [Test]
    public void PureGraph_RecordsHashesAndTerminalOutputs()
    {
        var doc = TestGraphs.AddGraph();
        var record = Freeze(doc.Evaluate(TestGraphs.Registry));

        Assert.Multiple(() =>
        {
            Assert.That(record.GraphHash, Is.EqualTo(doc.ComputeGraphHash()));
            Assert.That(record.TimestampUtc, Is.EqualTo("2026-08-31T14:03:22.117Z"));
            Assert.That(record.NodeOutputs.Keys, Is.EquivalentTo(new[] { "a.out", "b.out", "sum.out" }));
            Assert.That(record.NodeOutputs["sum.out"], Is.EqualTo(ValueHash.Compute(new IntegerValue(12))));
            Assert.That(record.RecordedOutputs.Keys, Is.EqualTo(new[] { "sum.out" }));
            Assert.That(record.RecordedOutputs["sum.out"], Is.EqualTo(new IntegerValue(12)));
            Assert.That(record.Inputs, Is.Empty);
            Assert.That(record.Effects, Is.Empty);
            Assert.That(record.FirstCorruptOutput(), Is.Null);
        });
    }

    [Test]
    public void UnreadyNode_ExcludedFromOutputs()
    {
        var doc = TestGraphs.Doc(
            new GraphNode[] { new("a", "test.const", 1), new("sum", "test.add", 1) },
            new GraphEdge[] { new("a.out", "sum.a") },
            new Dictionary<string, IReadOnlyDictionary<string, string>>
            {
                ["a"] = TestGraphs.Params(("kind", "Integer"), ("value", "5")),
            });
        var record = Freeze(doc.Evaluate(TestGraphs.Registry));

        Assert.That(record.NodeOutputs.Keys, Is.EqualTo(new[] { "a.out" }));
        Assert.That(record.RecordedOutputs, Is.Empty, "a.out feeds an edge, so it is not terminal");
    }

    [Test]
    public void PendingEffect_ExcludedFromEffectsAndOutputs()
    {
        var doc = TestGraphs.Doc(
            new GraphNode[] { new("a", "test.const", 1), new("sink", "test.effect", 1) },
            new GraphEdge[] { new("a.out", "sink.in") },
            new Dictionary<string, IReadOnlyDictionary<string, string>>
            {
                ["a"] = TestGraphs.Params(("kind", "Integer"), ("value", "5")),
            });
        var snapshot = doc.Evaluate(TestGraphs.Registry);
        Assert.That(snapshot.Results["sink"].Status, Is.EqualTo(NodeStatus.EffectPending));

        var record = Freeze(snapshot);
        Assert.That(record.Effects, Is.Empty);
        Assert.That(record.NodeOutputs.Keys, Is.EqualTo(new[] { "a.out" }));
    }

    [Test]
    public void ExecutedEffects_RecordedInTopologicalOrder()
    {
        // Hand-built snapshot: the engine has no Run mode yet, so an executed
        // Effect node's Ok/Error state is constructed directly.
        var doc = TestGraphs.Doc(
            new GraphNode[] { new("a", "test.const", 1), new("s2", "test.effect", 1), new("s1", "test.effect", 1) },
            new GraphEdge[] { new("a.out", "s1.in"), new("a.out", "s2.in") },
            new Dictionary<string, IReadOnlyDictionary<string, string>>
            {
                ["a"] = TestGraphs.Params(("kind", "Integer"), ("value", "5")),
            });
        var five = new IntegerValue(5);
        var hash = ValueHash.Compute(five);
        var results = new Dictionary<string, NodeResult>
        {
            ["a"] = new("a", NodeStatus.Ok, new FlowValue[] { five }, new[] { hash },
                NodeResult.NoValues, NodeResult.NoStrings),
            ["s1"] = new("s1", NodeStatus.Ok, new FlowValue[] { five }, new[] { hash },
                NodeResult.NoValues, NodeResult.NoStrings),
            ["s2"] = new("s2", NodeStatus.Error, NodeResult.NoValues, NodeResult.NoStrings,
                NodeResult.NoValues, NodeResult.NoStrings, Error: "disk full"),
        };
        var record = Freeze(new EvalSnapshot(doc, results, Array.Empty<string>()));

        Assert.Multiple(() =>
        {
            Assert.That(record.Effects, Is.EqualTo(new[]
            {
                new EffectRecord("s1", EffectStatus.Ok),
                new EffectRecord("s2", EffectStatus.Failed, "disk full"),
            }));
            Assert.That(record.NodeOutputs.Keys, Is.EquivalentTo(new[] { "a.out", "s1.out" }));
        });
    }

    [Test]
    public void Inputs_SortedByNodeThenParam()
    {
        var h = new string('a', 64);
        var record = Freeze(TestGraphs.AddGraph().Evaluate(TestGraphs.Registry), new[]
        {
            new RunInput("m2", "path", h),
            new RunInput("m1", "second", h),
            new RunInput("m1", "path", h, "models/x.bos"),
        });

        Assert.That(record.Inputs.Select(i => $"{i.Node}.{i.Param}"),
            Is.EqualTo(new[] { "m1.path", "m1.second", "m2.path" }));
    }

    [Test]
    public void Warnings_CapturedFromSnapshot()
    {
        var doc = TestGraphs.AddGraph();
        var snapshot = doc.Evaluate(TestGraphs.Registry);
        var record = Freeze(snapshot with { Warnings = new[] { "sum: something odd" } });
        Assert.That(record.Warnings, Is.EqualTo(new[] { "sum: something odd" }));
    }
}
