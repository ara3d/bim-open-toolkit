using Ara3D.NodeGraph;

namespace Ara3D.DataFlowEngine.Tests;

[TestFixture]
public class ErrorTests
{
    private static GraphDocument WithThrow()
        => GraphDocument.Empty
            .AddNode("a", "test.const", 1).SetParam("a", "value", "1")
            .AddNode("bad", "test.throw", 1)
            .AddNode("after", "test.probe", 1)
            .AddNode("b", "test.const", 1).SetParam("b", "value", "2")
            .AddNode("nb", "test.negate", 1)
            .Connect("a.out", "bad.in")
            .Connect("bad.out", "after.in")
            .Connect("b.out", "nb.in");

    [Test]
    public void Throwing_node_reports_error_without_crashing_the_pass()
    {
        var snapshot = WithThrow().Evaluate(TestNodes.Registry);
        var bad = snapshot.Results["bad"];
        Assert.That(bad.Status, Is.EqualTo(NodeStatus.Error));
        Assert.That(bad.Error, Is.EqualTo("InvalidOperationException: boom"));
        Assert.That(bad.ExecutionCount, Is.EqualTo(1));
    }

    [Test]
    public void Error_propagates_downstream_as_unavailable()
    {
        var snapshot = WithThrow().Evaluate(TestNodes.Registry);
        var after = snapshot.Results["after"];
        Assert.That(after.Status, Is.EqualTo(NodeStatus.Unavailable));
        Assert.That(after.BlockingNodeId, Is.EqualTo("bad"));
    }

    [Test]
    public void Independent_branch_is_unaffected()
    {
        var snapshot = WithThrow().Evaluate(TestNodes.Registry);
        Assert.That(snapshot.Results["nb"].Status, Is.EqualTo(NodeStatus.Ok));
        Assert.That(snapshot.IntegerOutput("nb"), Is.EqualTo(-2));
    }

    [Test]
    public void Failed_evaluations_are_not_memoized()
    {
        var session = new EvalSession(TestNodes.Registry);
        session.SetDocument(WithThrow());
        var snapshot = session.SetDocument(session.Document);
        // Errors are retried on every pass (only successes enter the cache).
        Assert.That(snapshot.Executions("bad"), Is.EqualTo(2));
    }
}
