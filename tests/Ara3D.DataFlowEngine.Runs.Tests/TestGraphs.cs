using System.Globalization;
using Ara3D.DataFlowEngine;
using Ara3D.DataFlowEngine.Abstractions;
using Ara3D.DataFlowEngine.Runs;
using Ara3D.NodeGraph;

namespace Ara3D.DataFlowEngine.Runs.Tests;

/// <summary>Minimal inline fakes for the spec's test vocabulary (semantics §8)
/// plus a fixed-table source. Deliberately independent of the TestKit.</summary>
internal static class TestGraphs
{
    public static readonly NodeRegistry Registry = new(new IFlowNode[]
    {
        new ConstNode(),
        new AddNode(),
        new TableNode(),
        new EffectNode(),
    });

    public static GraphDocument Doc(
        IReadOnlyList<GraphNode> nodes,
        IReadOnlyList<GraphEdge> edges,
        IReadOnlyDictionary<string, IReadOnlyDictionary<string, string>>? values = null)
        => new(nodes, edges, values ?? new Dictionary<string, IReadOnlyDictionary<string, string>>(),
            new Dictionary<string, NodeLayout>());

    public static IReadOnlyDictionary<string, string> Params(params (string Name, string Value)[] pairs)
        => pairs.ToDictionary(p => p.Name, p => p.Value);

    /// <summary>a + b via test.add; a=5, b=7 by default. Terminal output: sum.out.</summary>
    public static GraphDocument AddGraph(string a = "5", string b = "7")
        => Doc(
            new GraphNode[] { new("a", "test.const", 1), new("b", "test.const", 1), new("sum", "test.add", 1) },
            new GraphEdge[] { new("a.out", "sum.a"), new("b.out", "sum.b") },
            new Dictionary<string, IReadOnlyDictionary<string, string>>
            {
                ["a"] = Params(("kind", "Integer"), ("value", a)),
                ["b"] = Params(("kind", "Integer"), ("value", b)),
            });

    private sealed class ConstNode : IFlowNode
    {
        public NodeSpec Spec { get; } = new("test.const", 1, NodeCapability.Pure,
            Array.Empty<PortSpec>(),
            new PortSpec[] { new("out", PortType.Any) },
            new ParamSpec[]
            {
                new("kind", ParamKind.Enum, EnumValues: new[] { "Boolean", "Integer", "Number", "Text", "Table" }),
                new("value", ParamKind.Text),
            });

        public IReadOnlyList<FlowValue> Eval(IEvalContext context, IReadOnlyList<FlowValue> inputs, ParamValues parameters)
            => new FlowValue[]
            {
                parameters.GetText("kind") switch
                {
                    "Boolean" => new BooleanValue(bool.Parse(parameters.GetText("value"))),
                    "Integer" => new IntegerValue(long.Parse(parameters.GetText("value"), CultureInfo.InvariantCulture)),
                    "Number" => new NumberValue(double.Parse(parameters.GetText("value"), CultureInfo.InvariantCulture)),
                    "Text" => new TextValue(parameters.GetText("value")),
                    var k => throw new ArgumentException($"Unsupported const kind '{k}'"),
                },
            };
    }

    private sealed class AddNode : IFlowNode
    {
        public NodeSpec Spec { get; } = new("test.add", 1, NodeCapability.Pure,
            new PortSpec[] { new("a", PortType.Integer), new("b", PortType.Integer) },
            new PortSpec[] { new("out", PortType.Integer) },
            Array.Empty<ParamSpec>());

        public IReadOnlyList<FlowValue> Eval(IEvalContext context, IReadOnlyList<FlowValue> inputs, ParamValues parameters)
            => new FlowValue[] { new IntegerValue(((IntegerValue)inputs[0]).Value + ((IntegerValue)inputs[1]).Value) };
    }

    /// <summary>Outputs a fixed 3-row table covering all four cell kinds, nulls,
    /// and a non-finite Number.</summary>
    private sealed class TableNode : IFlowNode
    {
        public NodeSpec Spec { get; } = new("test.table", 1, NodeCapability.Pure,
            Array.Empty<PortSpec>(),
            new PortSpec[] { new("out", PortType.Table) },
            Array.Empty<ParamSpec>());

        public IReadOnlyList<FlowValue> Eval(IEvalContext context, IReadOnlyList<FlowValue> inputs, ParamValues parameters)
            => new FlowValue[] { new TableValue(FixedTable()) };

        public static RecordTable FixedTable()
            => new("fixture", new[]
            {
                new RecordColumn("flag", typeof(bool), new object?[] { true, null, false }, 0),
                new RecordColumn("count", typeof(long), new object?[] { 1L, 2L, null }, 1),
                new RecordColumn("ratio", typeof(double), new object?[] { 0.5, double.NaN, null }, 2),
                new RecordColumn("label", typeof(string), new object?[] { "x", null, "z" }, 3),
            });
    }

    private sealed class EffectNode : IFlowNode
    {
        public NodeSpec Spec { get; } = new("test.effect", 1, NodeCapability.Effect,
            new PortSpec[] { new("in", PortType.Any) },
            new PortSpec[] { new("out", PortType.Any) },
            Array.Empty<ParamSpec>());

        public IReadOnlyList<FlowValue> Eval(IEvalContext context, IReadOnlyList<FlowValue> inputs, ParamValues parameters)
            => new[] { inputs[0] };
    }
}
