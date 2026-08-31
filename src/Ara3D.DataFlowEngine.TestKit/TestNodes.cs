using System;
using System.Collections.Generic;
using Ara3D.DataFlowEngine.Abstractions;

namespace Ara3D.DataFlowEngine.TestKit;

/// <summary>
/// The conformance test vocabulary (spec semantics part §8): test.const,
/// test.negate, test.add, test.probe, test.effect — plus test.throw and
/// test.warn for failure and warning paths. Executions are observable through
/// NodeResult.ExecutionCount; Effect nodes execute only inside a Run.
/// </summary>
public static class TestNodes
{
    private static readonly string[] KindNames = { "Boolean", "Integer", "Number", "Text", "Table" };
    private static readonly ParamSpec[] NoParams = Array.Empty<ParamSpec>();

    /// <summary>Emits the value parsed from params kind (Enum, default Integer) and value (canonical string, format §4).</summary>
    public static readonly IFlowNode Const = new DelegateNode(
        new("test.const", 1, NodeCapability.Pure,
            Array.Empty<PortSpec>(),
            new PortSpec[] { new("out", PortType.Any) },
            new ParamSpec[]
            {
                new("kind", ParamKind.Enum, "Integer", KindNames),
                new("value", ParamKind.Text),
            }),
        (_, _, p) => One(CanonicalValue.Parse(p.GetText("kind", "Integer"), p.GetText("value"))));

    public static readonly IFlowNode Negate = new DelegateNode(
        new("test.negate", 1, NodeCapability.Pure, In(PortType.Integer), Out(PortType.Integer), NoParams),
        (_, i, _) => One(new IntegerValue(-((IntegerValue)i[0]).Value)));

    public static readonly IFlowNode Add = new DelegateNode(
        new("test.add", 1, NodeCapability.Pure,
            new PortSpec[] { new("a", PortType.Integer), new("b", PortType.Integer) },
            Out(PortType.Integer), NoParams),
        (_, i, _) => One(new IntegerValue(((IntegerValue)i[0]).Value + ((IntegerValue)i[1]).Value)));

    /// <summary>Identity over Any; each execution shows in ExecutionCount.</summary>
    public static readonly IFlowNode Probe = new DelegateNode(
        new("test.probe", 1, NodeCapability.Pure, In(PortType.Any), Out(PortType.Any), NoParams),
        (_, i, _) => One(i[0]));

    /// <summary>Effect passthrough: pending during standing evaluation, executes only inside a Run.</summary>
    public static readonly IFlowNode Effect = new DelegateNode(
        new("test.effect", 1, NodeCapability.Effect, In(PortType.Any), Out(PortType.Any), NoParams),
        (_, i, _) => One(i[0]));

    /// <summary>Always throws, for poisoned-downstream tests.</summary>
    public static readonly IFlowNode Throw = new DelegateNode(
        new("test.throw", 1, NodeCapability.Pure, In(PortType.Any), Out(PortType.Any), NoParams),
        (_, _, _) => throw new InvalidOperationException("test.throw always fails"));

    /// <summary>Warns "careful", then passes its input through.</summary>
    public static readonly IFlowNode Warn = new DelegateNode(
        new("test.warn", 1, NodeCapability.Pure, In(PortType.Any), Out(PortType.Any), NoParams),
        (c, i, _) =>
        {
            c.Warn("careful");
            return One(i[0]);
        });

    public static IReadOnlyList<IFlowNode> All { get; } =
        new[] { Const, Negate, Add, Probe, Effect, Throw, Warn };

    public static readonly INodeRegistry Registry = new NodeRegistry(All);

    private static PortSpec[] In(PortType type)
        => new PortSpec[] { new("in", type) };

    private static PortSpec[] Out(PortType type)
        => new PortSpec[] { new("out", type) };

    private static IReadOnlyList<FlowValue> One(FlowValue value)
        => new[] { value };
}
