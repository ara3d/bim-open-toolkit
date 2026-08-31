using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.NodeGraph;

namespace Ara3D.DataFlowEngine.Tests;

[TestFixture]
public class CancellationTests
{
    [Test]
    public void Cancelled_pass_throws_and_keeps_the_previous_snapshot()
    {
        var session = new EvalSession(TestNodes.Registry);
        session.SetDocument(TestNodes.Chain(1));
        var before = session.Snapshot;
        using var cts = new CancellationTokenSource();
        cts.Cancel();
        Assert.Throws<OperationCanceledException>(
            () => session.UpdateDocument(d => d.SetParam("c", "value", "2"), cts.Token));
        Assert.That(session.Snapshot, Is.SameAs(before));
        Assert.That(session.Snapshot.IntegerOutput("c"), Is.EqualTo(1));
    }

    [Test]
    public void Cancellation_token_reaches_the_node()
    {
        using var cts = new CancellationTokenSource();
        var seen = CancellationToken.None;
        var registry = new NodeRegistry(new IFlowNode[]
        {
            new FakeNode(new("test.ct", 1, NodeCapability.Pure,
                    Array.Empty<PortSpec>(),
                    new[] { new PortSpec("out", PortType.Integer) },
                    Array.Empty<ParamSpec>()),
                (c, _, _) => { seen = c.Cancellation; return new FlowValue[] { new IntegerValue(0) }; }),
        });
        var doc = GraphDocument.Empty.AddNode("x", "test.ct", 1);
        doc.Evaluate(registry, cts.Token);
        Assert.That(seen, Is.EqualTo(cts.Token));
    }
}
