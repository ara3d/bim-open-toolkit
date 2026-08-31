using Ara3D.NodeGraph;

namespace Ara3D.DataFlowEngine.Tests;

[TestFixture]
public class DirtyPropagationTests
{
    private static GraphDocument TwoBranches()
        => GraphDocument.Empty
            .AddNode("a", "test.const", 1).SetParam("a", "value", "1")
            .AddNode("b", "test.const", 1).SetParam("b", "value", "2")
            .AddNode("na", "test.negate", 1)
            .AddNode("nb", "test.negate", 1)
            .Connect("a.out", "na.in")
            .Connect("b.out", "nb.in");

    [Test]
    public void Param_change_re_executes_only_the_affected_branch()
    {
        var session = new EvalSession(TestNodes.Registry);
        session.SetDocument(TwoBranches());
        var snapshot = session.UpdateDocument(d => d.SetParam("a", "value", "10"));
        Assert.That(snapshot.Executions("a"), Is.EqualTo(2));
        Assert.That(snapshot.Executions("na"), Is.EqualTo(2));
        Assert.That(snapshot.Executions("b"), Is.EqualTo(1));
        Assert.That(snapshot.Executions("nb"), Is.EqualTo(1));
        Assert.That(snapshot.IntegerOutput("na"), Is.EqualTo(-10));
    }

    [Test]
    public void Param_change_with_identical_output_stops_propagation()
    {
        var session = new EvalSession(TestNodes.Registry);
        session.SetDocument(TestNodes.Chain(1));
        // "01" parses to the same integer: c re-executes, output hash is
        // unchanged, so downstream memo keys are unchanged and nothing else runs.
        var snapshot = session.UpdateDocument(d => d.SetParam("c", "value", "01"));
        Assert.That(snapshot.Executions("c"), Is.EqualTo(2));
        Assert.That(snapshot.Executions("n"), Is.EqualTo(1));
        Assert.That(snapshot.Executions("p"), Is.EqualTo(1));
    }

    [Test]
    public void Edge_rewire_re_executes_the_rewired_consumer()
    {
        var session = new EvalSession(TestNodes.Registry);
        session.SetDocument(TwoBranches());
        var snapshot = session.UpdateDocument(d => d.Connect("b.out", "na.in"));
        Assert.That(snapshot.Executions("a"), Is.EqualTo(1));
        Assert.That(snapshot.Executions("b"), Is.EqualTo(1));
        Assert.That(snapshot.IntegerOutput("na"), Is.EqualTo(-2));
        // na's new key equals nb's existing entry, so the rewire is a memo hit.
        Assert.That(snapshot.Executions("na") + snapshot.Executions("nb"), Is.EqualTo(2));
    }

    [Test]
    public void Node_add_executes_only_the_new_node()
    {
        var session = new EvalSession(TestNodes.Registry);
        session.SetDocument(TestNodes.Chain(5));
        var snapshot = session.UpdateDocument(d => d
            .AddNode("p2", "test.negate", 1)
            .Connect("n.out", "p2.in"));
        Assert.That(snapshot.Executions("c"), Is.EqualTo(1));
        Assert.That(snapshot.Executions("n"), Is.EqualTo(1));
        Assert.That(snapshot.Executions("p2"), Is.EqualTo(1));
        Assert.That(snapshot.IntegerOutput("p2"), Is.EqualTo(5));
    }

    [Test]
    public void Node_remove_drops_its_result_and_leaves_the_rest()
    {
        var session = new EvalSession(TestNodes.Registry);
        session.SetDocument(TestNodes.Chain());
        var snapshot = session.UpdateDocument(d => d.RemoveNode("p"));
        Assert.That(snapshot.Results.ContainsKey("p"), Is.False);
        Assert.That(snapshot.Executions("c"), Is.EqualTo(1));
        Assert.That(snapshot.Executions("n"), Is.EqualTo(1));
    }

    [Test]
    public void Removed_then_readded_node_starts_a_fresh_execution_count()
    {
        var session = new EvalSession(TestNodes.Registry);
        session.SetDocument(TestNodes.Chain());
        session.UpdateDocument(d => d.RemoveNode("p"));
        var snapshot = session.UpdateDocument(d => d
            .AddNode("p", "test.probe", 1)
            .Connect("n.out", "p.in"));
        // Same memo key as before removal: reused, not re-executed.
        Assert.That(snapshot.Executions("p"), Is.EqualTo(0));
        Assert.That(snapshot.Results["p"].Status, Is.EqualTo(NodeStatus.Ok));
    }
}
