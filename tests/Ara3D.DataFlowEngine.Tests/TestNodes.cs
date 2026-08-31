using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.NodeGraph;

namespace Ara3D.DataFlowEngine.Tests;

// Minimal internal fakes; a TestKit project will formalize these later.

internal sealed class FakeNode(NodeSpec spec,
    Func<IEvalContext, IReadOnlyList<FlowValue>, ParamValues, IReadOnlyList<FlowValue>> eval) : IFlowNode
{
    public NodeSpec Spec { get; } = spec;

    public IReadOnlyList<FlowValue> Eval(IEvalContext context, IReadOnlyList<FlowValue> inputs, ParamValues parameters)
        => eval(context, inputs, parameters);
}

internal static class TestNodes
{
    private static PortSpec[] Ports(params PortSpec[] ports) => ports;
    private static PortSpec In(PortType type = PortType.Integer) => new("in", type);
    private static PortSpec Out(PortType type = PortType.Integer) => new("out", type);

    private static NodeSpec Spec(string kind, PortSpec[] inputs, PortSpec[] outputs,
        ParamSpec[]? parameters = null, NodeCapability capability = NodeCapability.Pure)
        => new(kind, 1, capability, inputs, outputs, parameters ?? Array.Empty<ParamSpec>());

    public static readonly INodeRegistry Registry = new NodeRegistry(new IFlowNode[]
    {
        // Integer constant from param "value".
        new FakeNode(Spec("test.const", Ports(), Ports(Out()), new[] { new ParamSpec("value", ParamKind.Integer) }),
            (_, _, p) => new FlowValue[] { new IntegerValue(p.GetInteger("value")) }),
        // Text constant from param "value".
        new FakeNode(Spec("test.text", Ports(), Ports(Out(PortType.Text)), new[] { new ParamSpec("value", ParamKind.Text) }),
            (_, _, p) => new FlowValue[] { new TextValue(p.GetText("value")) }),
        new FakeNode(Spec("test.negate", Ports(In()), Ports(Out())),
            (_, i, _) => new FlowValue[] { new IntegerValue(-((IntegerValue)i[0]).Value) }),
        new FakeNode(Spec("test.add", Ports(new("a", PortType.Integer), new("b", PortType.Integer)), Ports(Out())),
            (_, i, _) => new FlowValue[] { new IntegerValue(((IntegerValue)i[0]).Value + ((IntegerValue)i[1]).Value) }),
        // Identity over Any.
        new FakeNode(Spec("test.probe", Ports(In(PortType.Any)), Ports(Out(PortType.Any))),
            (_, i, _) => new[] { i[0] }),
        new FakeNode(Spec("test.throw", Ports(In(PortType.Any)), Ports(Out(PortType.Any))),
            (_, _, _) => throw new InvalidOperationException("boom")),
        // Warns then passes through.
        new FakeNode(Spec("test.warn", Ports(In(PortType.Any)), Ports(Out(PortType.Any))),
            (c, i, _) => { c.Warn("careful"); return new[] { i[0] }; }),
        new FakeNode(Spec("test.effect", Ports(In(PortType.Any)), Ports(Out(PortType.Any)),
                capability: NodeCapability.Effect),
            (_, i, _) => new[] { i[0] }),
    });

    /// <summary>const(value) -> negate -> probe, ids c/n/p.</summary>
    public static GraphDocument Chain(long value = 42)
        => GraphDocument.Empty
            .AddNode("c", "test.const", 1)
            .AddNode("n", "test.negate", 1)
            .AddNode("p", "test.probe", 1)
            .Connect("c.out", "n.in")
            .Connect("n.out", "p.in")
            .SetParam("c", "value", value.ToString());

    public static long IntegerOutput(this EvalSnapshot snapshot, string nodeId)
        => ((IntegerValue)snapshot.Results[nodeId].Outputs[0]).Value;

    public static int Executions(this EvalSnapshot snapshot, string nodeId)
        => snapshot.Results[nodeId].ExecutionCount;
}
