using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.NodeGraph;

namespace Ara3D.DataFlowEngine.Tests;

/// <summary>
/// Spec semantics §2: only a required input port with no edge makes a node
/// unready. An unconnected optional port evaluates with MissingValue in that
/// position and stays out of the memo key.
/// </summary>
[TestFixture]
public class OptionalPortTests
{
    /// <summary>concat(a, b?) → a + "+" + (b or "none").</summary>
    private static readonly IFlowNode Concat = new FakeNode(
        new NodeSpec("test.concat", 1, NodeCapability.Pure,
            new PortSpec[]
            {
                new("a", PortType.Text),
                new("b", PortType.Text, Optional: true),
            },
            new PortSpec[] { new("out", PortType.Text) },
            Array.Empty<ParamSpec>()),
        (_, inputs, _) => new FlowValue[]
        {
            new TextValue(((TextValue)inputs[0]).Value + "+"
                + (inputs[1] is TextValue b ? b.Value : "none")),
        });

    private static readonly INodeRegistry Registry =
        NodeRegistry.Combine(TestNodes.Registry.Nodes, new[] { Concat });

    private static GraphDocument Sources()
        => GraphDocument.Empty
            .AddNode("x", "test.text", 1).SetParam("x", "value", "left")
            .AddNode("y", "test.text", 1).SetParam("y", "value", "right")
            .AddNode("c", "test.concat", 1);

    private static string TextOutput(EvalSnapshot snapshot, string nodeId)
        => ((TextValue)snapshot.Results[nodeId].Outputs[0]).Value;

    [Test]
    public void Unconnected_optional_port_evaluates_with_the_placeholder()
    {
        var snapshot = Sources().Connect("x.out", "c.a").Evaluate(Registry);
        Assert.That(snapshot.Results["c"].Status, Is.EqualTo(NodeStatus.Ok));
        Assert.That(TextOutput(snapshot, "c"), Is.EqualTo("left+none"));
    }

    [Test]
    public void Connected_optional_port_receives_the_value()
    {
        var snapshot = Sources().Connect("x.out", "c.a").Connect("y.out", "c.b").Evaluate(Registry);
        Assert.That(TextOutput(snapshot, "c"), Is.EqualTo("left+right"));
    }

    [Test]
    public void Unconnected_required_port_is_still_unready()
    {
        var snapshot = Sources().Connect("y.out", "c.b").Evaluate(Registry);
        Assert.That(snapshot.Results["c"].Status, Is.EqualTo(NodeStatus.Unready));
    }

    [Test]
    public void Connecting_the_optional_port_changes_the_memo_key()
    {
        var session = new EvalSession(Registry);
        session.SetDocument(Sources().Connect("x.out", "c.a"));
        var snapshot = session.UpdateDocument(doc => doc.Connect("y.out", "c.b"));
        Assert.That(TextOutput(snapshot, "c"), Is.EqualTo("left+right"));
        Assert.That(snapshot.Executions("c"), Is.EqualTo(2));
    }
}
