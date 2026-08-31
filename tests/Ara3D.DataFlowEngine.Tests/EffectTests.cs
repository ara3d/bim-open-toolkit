using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.NodeGraph;

namespace Ara3D.DataFlowEngine.Tests;

[TestFixture]
public class EffectTests
{
    private static GraphDocument WithEffect()
        => GraphDocument.Empty
            .AddNode("c", "test.const", 1).SetParam("c", "value", "3")
            .AddNode("e", "test.effect", 1)
            .AddNode("after", "test.probe", 1)
            .Connect("c.out", "e.in")
            .Connect("e.out", "after.in");

    [Test]
    public void Effect_node_is_skipped_but_its_inputs_are_computed()
    {
        var snapshot = WithEffect().Evaluate(TestNodes.Registry);
        var effect = snapshot.Results["e"];
        Assert.That(effect.Status, Is.EqualTo(NodeStatus.EffectPending));
        Assert.That(effect.ExecutionCount, Is.EqualTo(0));
        Assert.That(effect.Outputs, Is.Empty);
        Assert.That(((IntegerValue)effect.EffectInputs[0]).Value, Is.EqualTo(3));
        Assert.That(snapshot.Executions("c"), Is.EqualTo(1));
    }

    [Test]
    public void Downstream_of_a_pending_effect_is_unavailable()
    {
        var snapshot = WithEffect().Evaluate(TestNodes.Registry);
        var after = snapshot.Results["after"];
        Assert.That(after.Status, Is.EqualTo(NodeStatus.Unavailable));
        Assert.That(after.BlockingNodeId, Is.EqualTo("e"));
        Assert.That(snapshot.Executions("after"), Is.EqualTo(0));
    }

    [Test]
    public void Effect_inputs_track_upstream_changes()
    {
        var session = new EvalSession(TestNodes.Registry);
        session.SetDocument(WithEffect());
        var snapshot = session.UpdateDocument(d => d.SetParam("c", "value", "8"));
        Assert.That(((IntegerValue)snapshot.Results["e"].EffectInputs[0]).Value, Is.EqualTo(8));
    }
}
