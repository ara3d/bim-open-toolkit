using Ara3D.DataFlowEngine.Abstractions;

namespace BimOpenFlow.Nodes.BimAnalysis;

/// <summary>The wide element table: one row per instance element with the columns
/// everyone groups by — category, type, level, room, document, workset, group.</summary>
public sealed class BimElementsNode : IFlowNode
{
    public const string Kind = "bim.elements";

    public NodeSpec Spec { get; } = new(
        Kind, 1, NodeCapability.Pure,
        Inputs: [],
        Outputs: [new PortSpec("table", PortType.Table)],
        Params: [new ParamSpec("path", ParamKind.FilePath)],
        "Loads a .bos file into one row per element: EntityIndex, LocalId, GlobalId, Name, "
        + "Category, CategoryType, Type, ClassName, Level, Elevation, Room, Document, Workset, Group. "
        + "The grouping workhorse: feed it to table.aggregate, bim.discipline, or bim.classifyRooms.");

    public IReadOnlyList<FlowValue> Eval(IEvalContext context, IReadOnlyList<FlowValue> inputs, ParamValues parameters)
        => throw new NotImplementedException($"{Kind}: track SRC");
}
