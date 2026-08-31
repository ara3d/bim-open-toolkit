using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.NodeGraph;

namespace Ara3D.DataFlowEngine.Tests;

[TestFixture]
public class ObserverTests
{
    [Test]
    public void Global_observer_sees_every_pass_with_a_consistent_snapshot()
    {
        var session = new EvalSession(TestNodes.Registry);
        var seen = new List<EvalSnapshot>();
        session.Subscribe(seen.Add);
        session.SetDocument(TestNodes.Chain(1));
        session.UpdateDocument(d => d.SetParam("c", "value", "2"));
        Assert.That(seen, Has.Count.EqualTo(2));
        Assert.That(seen[0].IntegerOutput("p"), Is.EqualTo(-1));
        Assert.That(seen[1].IntegerOutput("p"), Is.EqualTo(-2));
        Assert.That(seen[1].IntegerOutput("c"), Is.EqualTo(2));
    }

    [Test]
    public void Node_observer_fires_only_when_that_node_changes()
    {
        var session = new EvalSession(TestNodes.Registry);
        session.SetDocument(TwoBranches());
        var changes = new List<NodeResult>();
        session.Subscribe("nb", changes.Add);
        session.UpdateDocument(d => d.SetParam("a", "value", "10"));
        Assert.That(changes, Is.Empty);
        session.UpdateDocument(d => d.SetParam("b", "value", "20"));
        Assert.That(changes, Has.Count.EqualTo(1));
        Assert.That(((IntegerValue)changes[0].Outputs[0]).Value, Is.EqualTo(-20));
    }

    [Test]
    public void Node_observer_fires_on_first_appearance()
    {
        var session = new EvalSession(TestNodes.Registry);
        var changes = new List<NodeResult>();
        session.Subscribe("c", changes.Add);
        session.SetDocument(TestNodes.Chain());
        Assert.That(changes, Has.Count.EqualTo(1));
    }

    [Test]
    public void Disposed_subscription_stops_notifications()
    {
        var session = new EvalSession(TestNodes.Registry);
        var count = 0;
        var subscription = session.Subscribe(_ => count++);
        session.SetDocument(TestNodes.Chain());
        subscription.Dispose();
        session.UpdateDocument(d => d.SetParam("c", "value", "7"));
        Assert.That(count, Is.EqualTo(1));
    }

    [Test]
    public void Unchanged_pass_does_not_notify_node_observers()
    {
        var session = new EvalSession(TestNodes.Registry);
        session.SetDocument(TestNodes.Chain());
        var changes = new List<NodeResult>();
        session.Subscribe("p", changes.Add);
        session.SetDocument(session.Document);
        Assert.That(changes, Is.Empty);
    }

    private static GraphDocument TwoBranches()
        => GraphDocument.Empty
            .AddNode("a", "test.const", 1).SetParam("a", "value", "1")
            .AddNode("b", "test.const", 1).SetParam("b", "value", "2")
            .AddNode("na", "test.negate", 1)
            .AddNode("nb", "test.negate", 1)
            .Connect("a.out", "na.in")
            .Connect("b.out", "nb.in");
}
