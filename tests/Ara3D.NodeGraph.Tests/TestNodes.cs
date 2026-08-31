using Ara3D.DataFlowEngine.Abstractions;

namespace Ara3D.NodeGraph.Tests;

internal sealed class SpecOnlyNode(NodeSpec spec) : IFlowNode
{
    public NodeSpec Spec { get; } = spec;

    public IReadOnlyList<FlowValue> Eval(IEvalContext context, IReadOnlyList<FlowValue> inputs, ParamValues parameters)
        => throw new NotSupportedException("Test node: spec only");
}

internal static class TestNodes
{
    private static NodeSpec Spec(string kind, PortSpec[] inputs, PortSpec[] outputs, ParamSpec[]? parameters = null)
        => new(kind, 1, NodeCapability.Pure, inputs, outputs, parameters ?? Array.Empty<ParamSpec>());

    public static readonly INodeRegistry Registry = new NodeRegistry(new IFlowNode[]
    {
        new SpecOnlyNode(Spec("test.const",
            Array.Empty<PortSpec>(),
            new[] { new PortSpec("out", PortType.Integer) },
            new[] { new ParamSpec("value", ParamKind.Integer) })),
        new SpecOnlyNode(Spec("test.negate",
            new[] { new PortSpec("in", PortType.Integer) },
            new[] { new PortSpec("out", PortType.Integer) })),
        new SpecOnlyNode(Spec("test.text",
            Array.Empty<PortSpec>(),
            new[] { new PortSpec("out", PortType.Text) })),
        new SpecOnlyNode(Spec("test.sink",
            new[] { new PortSpec("in", PortType.Any) },
            Array.Empty<PortSpec>())),
        new SpecOnlyNode(Spec("test.anySource",
            Array.Empty<PortSpec>(),
            new[] { new PortSpec("out", PortType.Any) })),
    });
}
