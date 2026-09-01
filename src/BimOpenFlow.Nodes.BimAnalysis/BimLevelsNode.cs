using Ara3D.DataFlowEngine.Abstractions;

namespace BimOpenFlow.Nodes.BimAnalysis;

/// <summary>One row per level, ordered by elevation, with element and room counts.</summary>
public sealed class BimLevelsNode : IFlowNode
{
    public const string Kind = "bim.levels";

    public NodeSpec Spec { get; } = new(
        Kind, 1, NodeCapability.Pure,
        Inputs: [],
        Outputs: [new PortSpec("table", PortType.Table)],
        Params: [new ParamSpec("path", ParamKind.FilePath)],
        "Loads a .bos file into one row per level, ordered by elevation: EntityIndex, Name, "
        + "Elevation, ElementCount (elements whose Level parameter points here), RoomCount. "
        + "Levels are the elements carrying a level-elevation parameter or categorized as Levels.");

    public IReadOnlyList<FlowValue> Eval(IEvalContext context, IReadOnlyList<FlowValue> inputs, ParamValues parameters)
        => throw new NotImplementedException($"{Kind}: track SRC");
}
